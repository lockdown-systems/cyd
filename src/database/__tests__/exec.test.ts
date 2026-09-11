import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import Database from "better-sqlite3";

const logMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("electron-log/main", () => ({ default: logMock }));

vi.mock("electron", () => ({
  app: { getVersion: vi.fn(() => "0.0.1"), getPath: vi.fn(() => "/tmp") },
  ipcMain: { handle: vi.fn() },
}));

import { exec, redactSQLParams } from "../common";

const SECRET = "eyJhbGciOiJIUzI1NiJ9.super-secret-refresh-token";

describe("exec", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec("CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT)");
    logMock.debug.mockClear();
  });

  afterEach(() => {
    db.close();
    vi.clearAllMocks();
  });

  test("never logs statement parameter values", () => {
    exec(db, "INSERT INTO config (key, value) VALUES (?, ?)", [
      "blueskySessionStore-did:web:cyd",
      SECRET,
    ]);

    const logged = JSON.stringify(logMock.debug.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).toContain("INSERT INTO config");
  });

  test("never puts parameter values in the error it throws", () => {
    let message = "";
    try {
      exec(db, "INSERT INTO nonexistent (key, value) VALUES (?, ?)", [
        "key",
        SECRET,
      ]);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toBe("");
    expect(message).not.toContain(SECRET);
    expect(message).toContain("nonexistent");
  });

  test("still runs the statement with its real parameters", () => {
    exec(db, "INSERT INTO config (key, value) VALUES (?, ?)", ["key", SECRET]);

    const row = db
      .prepare("SELECT value FROM config WHERE key = ?")
      .get("key") as { value: string };
    expect(row.value).toBe(SECRET);
  });

  test("redacts strings and buffers but keeps shape for debugging", () => {
    expect(
      redactSQLParams(["abc", 42, null, Buffer.from("1234"), BigInt(7)]),
    ).toEqual(["<string:3>", 42, null, "<buffer:4>", BigInt(7)]);
  });
});
