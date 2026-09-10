import type { Migration } from "../../database";

/**
 * Migrations for one Bluesky local account's private runtime database.
 *
 * This database belongs to a single account and is never a compatibility
 * surface: the Cyd Bluesky archive interchange schema is what travels between
 * clients.
 */
export const migrations: Migration[] = [
  {
    name: "initial",
    sql: [
      `CREATE TABLE job (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobType TEXT NOT NULL,
    status TEXT NOT NULL,
    scheduledAt DATETIME NOT NULL,
    startedAt DATETIME,
    finishedAt DATETIME,
    progressJSON TEXT,
    error TEXT
);`,
      `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`,
      // One row per unique asset in this account's content-addressed media
      // store. Deduplication is per account, so an account can be exported or
      // deleted without depending on another account's storage.
      `CREATE TABLE media (
    digest TEXT PRIMARY KEY,
    byteLength INTEGER NOT NULL,
    mediaType TEXT NOT NULL,
    createdAt DATETIME NOT NULL
);`,
    ],
  },
];
