import fs from "fs";
import path from "path";

import Database from "better-sqlite3";
import log from "electron-log/main";

import { getAccountDataPath } from "../util";

/**
 * The X migration's half of deriving who still depends on a Bluesky OAuth
 * session.
 *
 * An X account holds a Bluesky identity exactly when its account database
 * records a connected migration, so the answer is read from that database
 * rather than from a counter that a crash could leave stale. The read is
 * read-only and applies no migrations: asking who holds a session must not
 * have side effects on an account nobody opened.
 */

// The X account's own config table names the identity its migration is
// connected to. It is a public identifier, not a credential; the credentials
// it points at live in the shared Bluesky OAuth store.
export const X_BLUESKY_DID_KEY = "blueskyDID";

export const xAccountDatabasePath = (username: string): string =>
  path.join(getAccountDataPath("X", username), "data.sqlite3");

/**
 * The Bluesky identity this X account's migration is connected to, or null
 * when it has none. An account that was never set up, or whose database has
 * not been created yet, simply holds nothing.
 */
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
      .get(X_BLUESKY_DID_KEY) as { value: string | null } | undefined;
    return row?.value ? row.value : null;
  } catch (error) {
    // A database Cyd cannot read cannot be shown to hold anything. Saying so
    // out loud matters: an unreadable account here would otherwise look like
    // a released hold and could take a live session down with it.
    log.error(
      `xBlueskyMigrationDID: could not read the Bluesky migration state for an X account`,
      error instanceof Error ? error.message : error,
    );
    throw error;
  } finally {
    db?.close();
  }
};
