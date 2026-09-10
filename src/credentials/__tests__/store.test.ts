import fs from "fs";
import os from "os";
import path from "path";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import { safeStorageMock } from "../../__tests__/platform-fixtures/electronMocks";

const settingsPathHolder = vi.hoisted(() => ({ value: "" }));

// Each test gets its own settings directory, so vaults from one test can
// never be read by another.
vi.mock("../../util", async () => {
  const actual =
    await vi.importActual<typeof import("../../util")>("../../util");
  return { ...actual, getSettingsPath: () => settingsPathHolder.value };
});

import {
  CredentialStoreUnavailableError,
  accountCredentials,
  credentialsDirectoryPath,
  isCredentialStoreAvailable,
} from "../store";

const ACCOUNT_ID = 7;

const credentials = () => accountCredentials(ACCOUNT_ID);

const vaultPath = () =>
  path.join(credentialsDirectoryPath(), `account-${ACCOUNT_ID}.json`);

describe("credential store", () => {
  beforeEach(() => {
    settingsPathHolder.value = fs.mkdtempSync(
      path.join(os.tmpdir(), "cyd-credentials-"),
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

  test("round-trips a credential", () => {
    credentials().set("blueskySessionStore-did:web:cyd", "the-token");

    expect(credentials().get("blueskySessionStore-did:web:cyd")).toBe(
      "the-token",
    );
  });

  test("never writes the credential value in plaintext", () => {
    credentials().set("session", "super-secret-refresh-token");

    const onDisk = fs.readFileSync(vaultPath(), "utf-8");
    expect(onDisk).not.toContain("super-secret-refresh-token");
    expect(safeStorageMock.encryptString).toHaveBeenCalledWith(
      "super-secret-refresh-token",
    );
  });

  test("returns null for credentials that were never stored", () => {
    expect(credentials().get("missing")).toBeNull();
    credentials().set("present", "value");
    expect(credentials().get("missing")).toBeNull();
  });

  test("deletes a single credential", () => {
    credentials().set("one", "1");
    credentials().set("two", "2");

    credentials().delete("one");

    expect(credentials().get("one")).toBeNull();
    expect(credentials().get("two")).toBe("2");
  });

  test("deletes every credential sharing a prefix", () => {
    credentials().set("blueskyStateStore-a", "a");
    credentials().set("blueskySessionStore-b", "b");
    credentials().set("somethingElse", "c");

    credentials().deleteWithPrefix("bluesky");

    expect(credentials().keys()).toEqual(["somethingElse"]);
  });

  test("deleting a namespace removes its vault from disk", () => {
    credentials().set("one", "1");
    expect(fs.existsSync(vaultPath())).toBe(true);

    credentials().deleteAll();

    expect(fs.existsSync(vaultPath())).toBe(false);
    expect(credentials().keys()).toEqual([]);
  });

  test("deleting an account with no vault is a no-op", () => {
    expect(() => accountCredentials(999).deleteAll()).not.toThrow();
  });

  test.skipIf(process.platform === "win32")(
    "keeps the vault owner-only",
    () => {
      credentials().set("one", "1");

      expect(fs.statSync(vaultPath()).mode & 0o777).toBe(0o600);
      expect(fs.statSync(credentialsDirectoryPath()).mode & 0o777).toBe(0o700);
    },
  );

  test("refuses to persist when no credential backend is available", () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    expect(isCredentialStoreAvailable()).toBe(false);
    expect(() => credentials().set("one", "1")).toThrow(
      CredentialStoreUnavailableError,
    );
    expect(fs.existsSync(vaultPath())).toBe(false);
    expect(safeStorageMock.encryptString).not.toHaveBeenCalled();
  });

  test("drops credentials it can no longer decrypt", () => {
    credentials().set("one", "1");
    // A vault written under a different OS key, e.g. after the user moved the
    // profile to another machine, decrypts to nothing usable.
    fs.writeFileSync(
      vaultPath(),
      JSON.stringify({
        version: 1,
        credentials: { one: Buffer.from("garbage").toString("base64") },
      }),
    );

    expect(credentials().get("one")).toBeNull();
    // The unusable entry is removed rather than left to fail forever.
    expect(credentials().keys()).toEqual([]);
  });

  test("recovers from a corrupt vault file", () => {
    fs.mkdirSync(credentialsDirectoryPath(), { recursive: true });
    fs.writeFileSync(vaultPath(), "not json at all");

    expect(credentials().get("one")).toBeNull();
    credentials().set("one", "1");
    expect(credentials().get("one")).toBe("1");
  });

  test("rejects account IDs that could escape the credentials directory", () => {
    // A vault is named after its account, so an account ID that is not a
    // plain non-negative integer must never reach the filesystem.
    expect(() => accountCredentials(1.5)).toThrow();
    expect(() => accountCredentials(-1)).toThrow();
    expect(() => accountCredentials(NaN)).toThrow();
  });

  test("names an account's vault after the account", () => {
    credentials().set("one", "1");

    expect(fs.existsSync(vaultPath())).toBe(true);
  });

  test("discards a vault written by a future version of Cyd", () => {
    fs.mkdirSync(credentialsDirectoryPath(), { recursive: true });
    fs.writeFileSync(
      vaultPath(),
      JSON.stringify({ version: 99, credentials: { one: "whatever" } }),
    );

    expect(credentials().get("one")).toBeNull();
  });
});
