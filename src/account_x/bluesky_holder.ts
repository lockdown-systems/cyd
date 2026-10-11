import fs from "fs";
import path from "path";

import Database from "better-sqlite3";
import log from "electron-log/main";

import { getAccounts } from "../database/account";
import { BLUESKY_DID_CONFIG_KEY } from "../credentials";
import { getAccountDataPath } from "../util";

// An X account holds a Bluesky identity exactly when its account database
// records a connected migration. The read is read-only and applies no
// migrations: asking who holds a session must not have side effects.

export const xAccountDatabasePath = (username: string): string =>
  path.join(getAccountDataPath("X", username), "data.sqlite3");

// Null when this account was never set up or has no database yet.
export const xBlueskyMigrationDID = (username: string): string | null => {
  const databasePath = xAccountDatabasePath(username);
  if (!fs.existsSync(databasePath)) {
    return null;
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(databasePath, { readonly: true, fileMustExist: true });
    const configTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='config'",
      )
      .get();
    if (!configTable) {
      // The database exists but has never been migrated, so this account has
      // never connected to anything.
      return null;
    }
    const row = db
      .prepare("SELECT value FROM config WHERE key = ?")
      .get(BLUESKY_DID_CONFIG_KEY) as { value: string | null } | undefined;
    return row?.value ? row.value : null;
  } catch (error) {
    // An unreadable database here would otherwise look like a released hold
    // and could take a live session down with it, so this throws. Only the
    // error's class is logged (a SQLite message carries the path).
    log.error(
      "xBlueskyMigrationDID: could not read an X account's Bluesky migration state",
      error instanceof Error ? error.name : typeof error,
    );
    throw error;
  } finally {
    db?.close();
  }
};

// Which accounts exist and how an X account records its migration both
// belong to X, so the shared OAuth module asks rather than looks.
export const xBlueskyHolderAccountIDs = (did: string): number[] => {
  const accountIDs: number[] = [];
  for (const account of getAccounts()) {
    if (account.type !== "X" || !account.xAccount?.username) {
      continue;
    }
    if (xBlueskyMigrationDID(account.xAccount.username) === did) {
      accountIDs.push(account.id);
    }
  }
  return accountIDs;
};
