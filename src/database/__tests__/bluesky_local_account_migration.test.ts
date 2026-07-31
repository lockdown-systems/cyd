import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

import { replaceDormantBlueskyAccountsMigration } from "../migrations";
import { runMigrations } from "../common";

describe("Bluesky local account forward migration", () => {
  let db: Database.Database | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  test("replaces the abandoned model without adapting its rows", () => {
    db = new Database(":memory:");
    db.exec(`CREATE TABLE account (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'unknown',
      sortOrder INTEGER NOT NULL DEFAULT 0,
      xAccountId INTEGER DEFAULT NULL,
      uuid TEXT NOT NULL,
      blueskyAccountID INTEGER DEFAULT NULL,
      facebookAccountID INTEGER DEFAULT NULL
    );
    CREATE TABLE blueskyAccount (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT
    );`);

    db.prepare(
      "INSERT INTO blueskyAccount (username) VALUES ('abandoned.test')",
    ).run();
    db.prepare(
      `INSERT INTO account
        (type, sortOrder, blueskyAccountID, uuid)
       VALUES ('Bluesky', 0, 1, '00000000-0000-4000-8000-000000000001')`,
    ).run();
    db.prepare(
      `INSERT INTO account
        (type, sortOrder, uuid)
       VALUES ('X', 1, '00000000-0000-4000-8000-000000000002')`,
    ).run();

    runMigrations(db, [replaceDormantBlueskyAccountsMigration]);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).not.toContain("blueskyAccount");
    expect(tables.map(({ name }) => name)).toContain("blueskyLocalAccount");

    const accountColumns = db
      .prepare("PRAGMA table_info(account)")
      .all() as Array<{
      name: string;
    }>;
    expect(accountColumns.map(({ name }) => name)).not.toContain(
      "blueskyAccountID",
    );
    expect(db.prepare("SELECT type, uuid FROM account").all()).toEqual([
      {
        type: "X",
        uuid: "00000000-0000-4000-8000-000000000002",
      },
    ]);

    db.prepare(
      `INSERT INTO account (type, sortOrder, uuid) VALUES
        ('Bluesky', 2, '00000000-0000-4000-8000-000000000003'),
        ('Bluesky', 3, '00000000-0000-4000-8000-000000000004')`,
    ).run();
    db.prepare(
      `INSERT INTO blueskyLocalAccount (uuid, did, handle)
       VALUES (?, ?, ?)`,
    ).run(
      "00000000-0000-4000-8000-000000000003",
      "did:plc:alice",
      "alice.test",
    );
    expect(() =>
      db!
        .prepare(
          `INSERT INTO blueskyLocalAccount (uuid, did, handle)
         VALUES (?, ?, ?)`,
        )
        .run(
          "00000000-0000-4000-8000-000000000004",
          "did:plc:alice",
          "renamed.test",
        ),
    ).toThrow();
  });
});
