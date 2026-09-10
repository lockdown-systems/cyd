import Database from "better-sqlite3";
import log from "electron-log/main";

import { exec } from "../database/common";
import {
  CredentialStorageUnavailableError,
  accountCredentialNamespace,
  setCredential,
} from "./store";

// Cyd once serialized the X-to-Bluesky migration's OAuth state and session,
// which carry access tokens, refresh tokens, and a private DPoP key, into the
// account's plaintext SQLite config table. These are the keys it used.
const LEGACY_CREDENTIAL_KEY_PATTERNS = [
  "blueskyStateStore-%",
  "blueskySessionStore-%",
];

export type LegacyCredentialSweep = {
  // Keys that now live in protected storage.
  moved: string[];
  // Keys that were destroyed because Cyd could not protect them. The user
  // reconnects; nothing they saved is lost.
  discarded: string[];
};

type ConfigRow = { key: string; value: string | null };

const hasConfigTable = (db: Database.Database): boolean =>
  db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='config'",
    )
    .get() !== undefined;

/**
 * Purge SQLite of the WAL and free-page remnants of a deleted row.
 *
 * Deleting a row leaves its bytes in the database file and its write-ahead
 * log until both are rewritten, so a credential is not really gone until this
 * runs. It only runs when a sweep actually removed something.
 */
const purgeDeletedRowRemnants = (db: Database.Database): void => {
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch (error) {
    log.warn(
      "sweepLegacyOAuthCredentials: could not checkpoint the WAL",
      error,
    );
  }
  try {
    db.exec("VACUUM");
  } catch (error) {
    log.warn(
      "sweepLegacyOAuthCredentials: could not vacuum the database",
      error,
    );
  }
  try {
    // VACUUM rebuilds the database through the WAL, so truncate it again.
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch (error) {
    log.warn(
      "sweepLegacyOAuthCredentials: could not checkpoint the WAL",
      error,
    );
  }
};

/**
 * Move an account's legacy plaintext OAuth credentials into protected storage
 * and erase the rows that held them.
 *
 * Called whenever an account database opens, this is the only path that reads
 * those legacy rows. It is idempotent, and when no credential facility is
 * available it destroys the credentials rather than leaving them readable.
 */
export const sweepLegacyOAuthCredentials = (
  db: Database.Database,
  accountID: number,
): LegacyCredentialSweep => {
  const sweep: LegacyCredentialSweep = { moved: [], discarded: [] };

  if (!hasConfigTable(db)) {
    return sweep;
  }

  const whereClause = LEGACY_CREDENTIAL_KEY_PATTERNS.map(
    () => "key LIKE ?",
  ).join(" OR ");
  const rows = exec(
    db,
    `SELECT key, value FROM config WHERE ${whereClause}`,
    LEGACY_CREDENTIAL_KEY_PATTERNS,
    "all",
  ) as ConfigRow[];

  if (rows.length === 0) {
    return sweep;
  }

  const namespace = accountCredentialNamespace(accountID);

  for (const row of rows) {
    // The old store blanked rows rather than deleting them, so an empty value
    // is a tombstone, not a credential.
    if (!row.value) {
      continue;
    }
    try {
      setCredential(namespace, row.key, row.value);
      sweep.moved.push(row.key);
    } catch (error) {
      if (!(error instanceof CredentialStorageUnavailableError)) {
        log.error(
          `sweepLegacyOAuthCredentials: could not migrate ${row.key}`,
          error,
        );
      }
      sweep.discarded.push(row.key);
    }
  }

  exec(db, `DELETE FROM config WHERE ${whereClause}`, [
    ...LEGACY_CREDENTIAL_KEY_PATTERNS,
  ]);
  purgeDeletedRowRemnants(db);

  log.info(
    `sweepLegacyOAuthCredentials: migrated ${sweep.moved.length} and discarded ${sweep.discarded.length} legacy credentials for account ${accountID}`,
  );

  return sweep;
};
