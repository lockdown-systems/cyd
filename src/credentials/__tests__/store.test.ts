import fs from "fs";
import os from "os";
import path from "path";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
  encryptString: vi.fn((plaintext: string) => Buffer.from(`enc:${plaintext}`)),
  decryptString: vi.fn((ciphertext: Buffer) => {
    const text = ciphertext.toString();
    if (!text.startsWith("enc:")) {
      throw new Error("Unable to decrypt");
    }
    return text.slice("enc:".length);
  }),
}));

const settingsPathHolder = vi.hoisted(() => ({ value: "" }));

vi.mock("electron", () => ({
  safeStorage: safeStorageMock,
  app: { getPath: vi.fn(() => os.tmpdir()), getVersion: vi.fn(() => "0.0.1") },
  ipcMain: { handle: vi.fn() },
}));

vi.mock("../../util", () => ({
  getSettingsPath: () => settingsPathHolder.value,
}));

import {
  CredentialStorageUnavailableError,
  accountCredentialNamespace,
  credentialsDirectoryPath,
  deleteCredential,
  deleteCredentialNamespace,
  deleteCredentialsWithPrefix,
  getCredential,
  isCredentialStorageAvailable,
  listCredentialKeys,
  setCredential,
} from "../store";

const NAMESPACE = "account-7";

const vaultPath = () =>
  path.join(credentialsDirectoryPath(), `${NAMESPACE}.json`);

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
    setCredential(NAMESPACE, "blueskySessionStore-did:web:cyd", "the-token");

    expect(getCredential(NAMESPACE, "blueskySessionStore-did:web:cyd")).toBe(
      "the-token",
    );
  });

  test("never writes the credential value in plaintext", () => {
    setCredential(NAMESPACE, "session", "super-secret-refresh-token");

    const onDisk = fs.readFileSync(vaultPath(), "utf-8");
    expect(onDisk).not.toContain("super-secret-refresh-token");
    expect(safeStorageMock.encryptString).toHaveBeenCalledWith(
      "super-secret-refresh-token",
    );
  });

  test("returns null for credentials that were never stored", () => {
    expect(getCredential(NAMESPACE, "missing")).toBeNull();
    setCredential(NAMESPACE, "present", "value");
    expect(getCredential(NAMESPACE, "missing")).toBeNull();
  });

  test("deletes a single credential", () => {
    setCredential(NAMESPACE, "one", "1");
    setCredential(NAMESPACE, "two", "2");

    deleteCredential(NAMESPACE, "one");

    expect(getCredential(NAMESPACE, "one")).toBeNull();
    expect(getCredential(NAMESPACE, "two")).toBe("2");
  });

  test("deletes every credential sharing a prefix", () => {
    setCredential(NAMESPACE, "blueskyStateStore-a", "a");
    setCredential(NAMESPACE, "blueskySessionStore-b", "b");
    setCredential(NAMESPACE, "somethingElse", "c");

    deleteCredentialsWithPrefix(NAMESPACE, "bluesky");

    expect(listCredentialKeys(NAMESPACE)).toEqual(["somethingElse"]);
  });

  test("deleting a namespace removes its vault from disk", () => {
    setCredential(NAMESPACE, "one", "1");
    expect(fs.existsSync(vaultPath())).toBe(true);

    deleteCredentialNamespace(NAMESPACE);

    expect(fs.existsSync(vaultPath())).toBe(false);
    expect(listCredentialKeys(NAMESPACE)).toEqual([]);
  });

  test("deleting an unknown namespace is a no-op", () => {
    expect(() => deleteCredentialNamespace("account-999")).not.toThrow();
  });

  test.skipIf(process.platform === "win32")(
    "keeps the vault owner-only",
    () => {
      setCredential(NAMESPACE, "one", "1");

      expect(fs.statSync(vaultPath()).mode & 0o777).toBe(0o600);
      expect(fs.statSync(credentialsDirectoryPath()).mode & 0o777).toBe(0o700);
    },
  );

  test("refuses to persist when no credential backend is available", () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    expect(isCredentialStorageAvailable()).toBe(false);
    expect(() => setCredential(NAMESPACE, "one", "1")).toThrow(
      CredentialStorageUnavailableError,
    );
    expect(fs.existsSync(vaultPath())).toBe(false);
    expect(safeStorageMock.encryptString).not.toHaveBeenCalled();
  });

  test("drops credentials it can no longer decrypt", () => {
    setCredential(NAMESPACE, "one", "1");
    // A vault written under a different OS key, e.g. after the user moved the
    // profile to another machine, decrypts to nothing usable.
    fs.writeFileSync(
      vaultPath(),
      JSON.stringify({
        version: 1,
        credentials: { one: Buffer.from("garbage").toString("base64") },
      }),
    );

    expect(getCredential(NAMESPACE, "one")).toBeNull();
    // The unusable entry is removed rather than left to fail forever.
    expect(listCredentialKeys(NAMESPACE)).toEqual([]);
  });

  test("recovers from a corrupt vault file", () => {
    fs.mkdirSync(credentialsDirectoryPath(), { recursive: true });
    fs.writeFileSync(vaultPath(), "not json at all");

    expect(getCredential(NAMESPACE, "one")).toBeNull();
    setCredential(NAMESPACE, "one", "1");
    expect(getCredential(NAMESPACE, "one")).toBe("1");
  });

  test("rejects namespaces that could escape the credentials directory", () => {
    expect(() => setCredential("../evil", "one", "1")).toThrow();
    expect(() => getCredential("account/7", "one")).toThrow();
    expect(() => deleteCredentialNamespace("")).toThrow();
  });

  test("namespaces an account by its database ID", () => {
    expect(accountCredentialNamespace(7)).toBe("account-7");
  });
});
