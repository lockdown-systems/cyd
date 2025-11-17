import path from "path";
import fs from "fs";

import log from "electron-log/main";
import Database from "better-sqlite3";

import { getSettingsPath, packageExceptionForReport } from "../util";

// Types

export interface Sqlite3Info {
  lastInsertRowid: number;
  changes: number;
}

export interface Sqlite3Count {
  count: number;
}

// Check if the database is initialized
export const isDatabaseInitialized = (): boolean => {
  try {
    // Check if the database is accessible by running a simple query
    getMainDatabase().prepare("SELECT 1").get();
    return true;
  } catch (error) {
    log.error("Database initialization check failed:", error);
    return false;
  }
};

// Migrations

export type Migration = {
  name: string;
  sql: string[];
};

export const runMigrations = (
  db: Database.Database,
  migrations: Migration[],
) => {
  // Create a migrations table if necessary
  const migrationsTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
    )
    .get();
  if (!migrationsTable) {
    // Create the migrations table
    log.debug("Creating migrations table");
    db.prepare(
      `CREATE TABLE  migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    runAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
    ).run();
  }

  // Apply the migrations in order
  for (const migration of migrations) {
    const migrationRecord = db
      .prepare("SELECT * FROM migrations WHERE name = ?")
      .get(migration.name);
    if (!migrationRecord) {
      log.info(`Running migration: ${migration.name}`);
      for (const sql of migration.sql) {
        db.exec(sql);
      }
      db.prepare("INSERT INTO migrations (name) VALUES (?)").run(
        migration.name,
      );
    }
  }
};

// Main database

let mainDatabase: Database.Database | null = null;
let mainDatabasePath: string | null = null;

export const getMainDatabase = () => {
  const settingsPath = getSettingsPath();
  const dbPath = path.join(settingsPath, "db.sqlite");

  // Only reuse if database is open AND path matches AND file exists
  if (
    mainDatabase &&
    mainDatabase.open &&
    mainDatabasePath === dbPath &&
    fs.existsSync(dbPath)
  ) {
    return mainDatabase;
  }

  // Ensure settings directory exists before creating database
  if (!fs.existsSync(settingsPath)) {
    fs.mkdirSync(settingsPath, { recursive: true });
  }

  mainDatabase = new Database(dbPath, {});
  mainDatabasePath = dbPath;
  mainDatabase.pragma("journal_mode = WAL");
  return mainDatabase;
};

export const closeMainDatabase = () => {
  if (mainDatabase) {
    mainDatabase.close();
    mainDatabase = null;
    mainDatabasePath = null;
  }
};

// Utils

export const exec = (
  db: Database.Database | null,
  sql: string,
  params: Array<number | string | bigint | Buffer | Date | null> = [],
  cmd: "run" | "all" | "get" = "run",
) => {
  if (!db) {
    throw new Error("Database not initialized");
  }

  // Convert Date objects to ISO strings
  const paramsConverted: Array<number | string | bigint | Buffer | null> = [];
  for (const param of params) {
    if (param instanceof Date) {
      paramsConverted.push(param.toISOString());
    } else {
      paramsConverted.push(param);
    }
  }

  // Execute the query
  log.debug("Executing SQL:", sql, "Params:", paramsConverted);
  try {
    const stmt = db.prepare(sql);
    const ret = stmt[cmd](...paramsConverted);
    return ret;
  } catch (error) {
    const exception = JSON.parse(packageExceptionForReport(error as Error));
    throw new Error(
      JSON.stringify({
        exception: exception,
        sql: sql,
        params: paramsConverted,
      }),
    );
  }
};
