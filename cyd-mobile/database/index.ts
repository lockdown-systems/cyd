import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite/next";

import { migrations } from "./migrations";

let databasePromise: Promise<SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openAndMigrate();
  }

  return databasePromise;
}

async function openAndMigrate(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync("cyd-main.db");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await applyPendingMigrations(db);
  return db;
}

async function applyPendingMigrations(db: SQLiteDatabase) {
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  const currentVersion = versionRow?.user_version ?? 0;

  const pending = migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}
