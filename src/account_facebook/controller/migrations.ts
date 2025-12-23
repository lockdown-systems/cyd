import type { Migration } from "../../database";

/**
 * Database migrations for Facebook account controller.
 * These migrations are applied in order when initializing the database.
 */
export const migrations: Migration[] = [
  // Create the tables
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
    ],
  },
];
