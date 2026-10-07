import fs from "fs";
import os from "os";
import path from "path";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import { safeStorageMock } from "../../__tests__/platform-fixtures/electronMocks";

const settingsPathHolder = vi.hoisted(() => ({ value: "" }));

// Each test gets its own settings directory, so one test's vaults can never be
// read by another.
vi.mock("../../util", async () => {
  const actual =
    await vi.importActual<typeof import("../../util")>("../../util");
  return { ...actual, getSettingsPath: () => settingsPathHolder.value };
});

import {
  accountCredentials,
  credentialsDirectoryPath,
} from "../../credentials";
import {
  createAccount,
  runMainMigrations,
  selectAccountType,
} from "../../database";
import {
  blueskyOAuthCredentials,
  blueskyOAuthSessionStore,
  blueskyOAuthStateStore,
  deleteStoredBlueskyOAuthSession,
  hasStoredBlueskyOAuthSession,
  migrateAccountBlueskyOAuthCredentials,
  migrateAllAccountBlueskyOAuthCredentials,
  storedBlueskyOAuthAppState,
  storedBlueskyOAuthDIDs,
  storedBlueskyOAuthStateKeys,
} from "../store";

const SESSION = {
  dpopJwk: { kty: "EC", d: "private-dpop-key-material" },
  tokenSet: { refresh_token: "refresh-token-value" },
};

const STATE = {
  dpopJwk: { kty: "EC", d: "private-dpop-key-material" },
  verifier: "pkce-verifier-value",
  appState: "X:7",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const sessionStore = () => blueskyOAuthSessionStore() as any;
const stateStore = () => blueskyOAuthStateStore() as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("shared Bluesky OAuth credential store", () => {
  beforeEach(() => {
    settingsPathHolder.value = fs.mkdtempSync(
      path.join(os.tmpdir(), "cyd-bluesky-oauth-"),
    );
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    safeStorageMock.getSelectedStorageBackend.mockReturnValue(
      "gnome_libsecret",
    );
  });

  afterEach(() => {
    fs.rmSync(settingsPathHolder.value, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  test("keeps sessions in one vault that belongs to no account", async () => {
    await sessionStore().set("did:plc:one", SESSION);

    expect(
      fs.existsSync(
        path.join(credentialsDirectoryPath(), "shared-bluesky-oauth.json"),
      ),
    ).toBe(true);
    // Nothing lands in an account vault, which is what used to make a session
    // authorized under one account invisible to another.
    expect(accountCredentials(7).keys()).toEqual([]);
  });

  test("one authorization is readable from every platform", async () => {
    // The X migration authorizes; the Bluesky platform reads the same entry a
    // moment later through its own handle on the store.
    await sessionStore().set("did:plc:shared", SESSION);

    await expect(sessionStore().get("did:plc:shared")).resolves.toEqual(
      SESSION,
    );
    expect(hasStoredBlueskyOAuthSession("did:plc:shared")).toBe(true);
  });

  test("never writes session material in plaintext", async () => {
    await sessionStore().set("did:plc:one", SESSION);

    const onDisk = fs.readFileSync(
      path.join(credentialsDirectoryPath(), "shared-bluesky-oauth.json"),
      "utf-8",
    );
    expect(onDisk).not.toContain("refresh-token-value");
    expect(onDisk).not.toContain("private-dpop-key-material");
  });

  test("deleting one identity's session leaves every other alone", async () => {
    await sessionStore().set("did:plc:one", SESSION);
    await sessionStore().set("did:plc:two", SESSION);

    deleteStoredBlueskyOAuthSession("did:plc:one");

    expect(hasStoredBlueskyOAuthSession("did:plc:one")).toBe(false);
    expect(hasStoredBlueskyOAuthSession("did:plc:two")).toBe(true);
  });

  test("lists the identities it holds sessions for", async () => {
    await sessionStore().set("did:plc:one", SESSION);
    await sessionStore().set("did:plc:two", SESSION);
    await stateStore().set("state-key", STATE);

    expect(storedBlueskyOAuthDIDs().sort()).toEqual([
      "did:plc:one",
      "did:plc:two",
    ]);
    expect(storedBlueskyOAuthStateKeys()).toEqual(["state-key"]);
  });

  test("reads a flow identifier out of a stored authorization state", async () => {
    await stateStore().set("state-key", STATE);

    expect(storedBlueskyOAuthAppState("state-key")).toBe("X:7");
    expect(storedBlueskyOAuthAppState("other-key")).toBeNull();
  });

  test("carries an account's existing sessions forward into the shared store", () => {
    // What an install that authorized through the X migration wizard before
    // the store was shared looks like on disk.
    const accountVault = accountCredentials(7);
    accountVault.set(
      "blueskySessionStore-did:plc:migrated",
      JSON.stringify(SESSION),
    );
    accountVault.set("blueskyStateStore-state-key", JSON.stringify(STATE));

    const moved = migrateAccountBlueskyOAuthCredentials(7);

    expect(moved).toBe(2);
    expect(hasStoredBlueskyOAuthSession("did:plc:migrated")).toBe(true);
    expect(storedBlueskyOAuthAppState("state-key")).toBe("X:7");
    // Nothing is left behind in the account vault to go stale.
    expect(accountVault.keys()).toEqual([]);
  });

  test("migrating forward twice is the same as migrating once", () => {
    accountCredentials(7).set(
      "blueskySessionStore-did:plc:migrated",
      JSON.stringify(SESSION),
    );

    expect(migrateAccountBlueskyOAuthCredentials(7)).toBe(1);
    expect(migrateAccountBlueskyOAuthCredentials(7)).toBe(0);
    expect(storedBlueskyOAuthDIDs()).toEqual(["did:plc:migrated"]);
  });

  test("a stale account copy never overwrites a live shared session", async () => {
    await sessionStore().set("did:plc:migrated", SESSION);
    accountCredentials(7).set(
      "blueskySessionStore-did:plc:migrated",
      JSON.stringify({ tokenSet: { refresh_token: "stale-token" } }),
    );

    migrateAccountBlueskyOAuthCredentials(7);

    await expect(sessionStore().get("did:plc:migrated")).resolves.toEqual(
      SESSION,
    );
  });

  test("carries every account forward, not just the one being opened", () => {
    runMainMigrations();
    const first = selectAccountType(createAccount().id, "X");
    const second = selectAccountType(createAccount().id, "X");
    accountCredentials(first.id).set(
      "blueskySessionStore-did:plc:one",
      JSON.stringify(SESSION),
    );
    accountCredentials(second.id).set(
      "blueskySessionStore-did:plc:two",
      JSON.stringify(SESSION),
    );

    // Someone who upgrades and adds a Bluesky account before ever opening the
    // X account that authorized the identity must still find the session.
    const moved = migrateAllAccountBlueskyOAuthCredentials();

    expect(moved).toBe(2);
    expect(storedBlueskyOAuthDIDs().sort()).toEqual([
      "did:plc:one",
      "did:plc:two",
    ]);
  });

  test("leaves an account's other credentials where they are", () => {
    const accountVault = accountCredentials(7);
    accountVault.set("someOtherCredential", "value");

    migrateAccountBlueskyOAuthCredentials(7);

    expect(accountVault.keys()).toEqual(["someOtherCredential"]);
    expect(blueskyOAuthCredentials().keys()).toEqual([]);
  });
});
