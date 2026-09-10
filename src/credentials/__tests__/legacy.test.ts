import fs from "fs";
import os from "os";
import path from "path";

import Database from "better-sqlite3";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  getSelectedStorageBackend: vi.fn(() => "gnome_libsecret"),
  encryptString: vi.fn((plaintext: string) => Buffer.from(`enc:${plaintext}`)),
  decryptString: vi.fn((ciphertext: Buffer) =>
    ciphertext.toString().replace(/^enc:/, ""),
  ),
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

import { getCredential, listCredentialKeys } from "../store";
import { sweepLegacyOAuthCredentials } from "../legacy";

const ACCOUNT_ID = 3;
const NAMESPACE = "account-3";
const SESSION_SECRET = JSON.stringify({
  dpopJwk: { kty: "EC", d: "private-dpop-key-material" },
  tokenSet: { refresh_token: "refresh-token-value" },
});
const STATE_SECRET = JSON.stringify({ verifier: "pkce-verifier-value" });

let dbDir = "";
let dbPath = "";
let db: Database.Database;

const openDatabase = (): Database.Database => {
  const database = new Database(dbPath, {});
  database.pragma("journal_mode = WAL");
  database.exec("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT)");
  return database;
};

const readAllDatabaseBytes = (): string =>
  ["", "-wal", "-shm"]
    .map((suffix) =>
      fs.existsSync(`${dbPath}${suffix}`)
        ? fs.readFileSync(`${dbPath}${suffix}`).toString("latin1")
        : "",
    )
    .join("");

describe("sweepLegacyOAuthCredentials", () => {
  beforeEach(() => {
    settingsPathHolder.value = fs.mkdtempSync(
      path.join(os.tmpdir(), "cyd-credentials-legacy-"),
    );
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "cyd-legacy-db-"));
    dbPath = path.join(dbDir, "data.sqlite3");
    db = openDatabase();
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dbDir, { recursive: true, force: true });
    fs.rmSync(settingsPathHolder.value, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  const seedLegacyRows = () => {
    const insert = db.prepare("INSERT INTO config (key, value) VALUES (?, ?)");
    insert.run("blueskySessionStore-did:web:cyd", SESSION_SECRET);
    insert.run("blueskyStateStore-abc123", STATE_SECRET);
    // The old code blanked rows instead of deleting them.
    insert.run("blueskyStateStore-old", "");
    insert.run("blueskyDID", "did:web:cyd");
  };

  test("moves legacy OAuth rows into protected storage", () => {
    seedLegacyRows();

    const result = sweepLegacyOAuthCredentials(db, ACCOUNT_ID);

    expect(result.moved.sort()).toEqual([
      "blueskySessionStore-did:web:cyd",
      "blueskyStateStore-abc123",
    ]);
    expect(result.discarded).toEqual([]);
    expect(getCredential(NAMESPACE, "blueskySessionStore-did:web:cyd")).toBe(
      SESSION_SECRET,
    );
    expect(getCredential(NAMESPACE, "blueskyStateStore-abc123")).toBe(
      STATE_SECRET,
    );
  });

  test("removes every legacy row, including blanked ones", () => {
    seedLegacyRows();

    sweepLegacyOAuthCredentials(db, ACCOUNT_ID);

    const remaining = db
      .prepare("SELECT key FROM config ORDER BY key")
      .all() as { key: string }[];
    expect(remaining.map((row) => row.key)).toEqual(["blueskyDID"]);
  });

  test("leaves no plaintext credential in the database file or its WAL", () => {
    seedLegacyRows();
    expect(readAllDatabaseBytes()).toContain("refresh-token-value");

    sweepLegacyOAuthCredentials(db, ACCOUNT_ID);

    const bytes = readAllDatabaseBytes();
    expect(bytes).not.toContain("refresh-token-value");
    expect(bytes).not.toContain("private-dpop-key-material");
    expect(bytes).not.toContain("pkce-verifier-value");
  });

  test("discards legacy credentials when storage is unavailable", () => {
    seedLegacyRows();
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    const result = sweepLegacyOAuthCredentials(db, ACCOUNT_ID);

    expect(result.moved).toEqual([]);
    expect(result.discarded.sort()).toEqual([
      "blueskySessionStore-did:web:cyd",
      "blueskyStateStore-abc123",
    ]);
    // Rows are still removed: an unprotected credential is worse than none.
    const remaining = db.prepare("SELECT key FROM config").all() as {
      key: string;
    }[];
    expect(remaining.map((row) => row.key)).toEqual(["blueskyDID"]);
    expect(readAllDatabaseBytes()).not.toContain("refresh-token-value");
  });

  test("does nothing on an account with no legacy rows", () => {
    db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run(
      "blueskyDID",
      "did:web:cyd",
    );

    const result = sweepLegacyOAuthCredentials(db, ACCOUNT_ID);

    expect(result.moved).toEqual([]);
    expect(result.discarded).toEqual([]);
    expect(listCredentialKeys(NAMESPACE)).toEqual([]);
  });

  test("is idempotent", () => {
    seedLegacyRows();

    sweepLegacyOAuthCredentials(db, ACCOUNT_ID);
    const second = sweepLegacyOAuthCredentials(db, ACCOUNT_ID);

    expect(second.moved).toEqual([]);
    expect(second.discarded).toEqual([]);
    expect(getCredential(NAMESPACE, "blueskySessionStore-did:web:cyd")).toBe(
      SESSION_SECRET,
    );
  });

  test("tolerates a database with no config table", () => {
    const scratch = new Database(":memory:");
    expect(() =>
      sweepLegacyOAuthCredentials(scratch, ACCOUNT_ID),
    ).not.toThrow();
    scratch.close();
  });
});
