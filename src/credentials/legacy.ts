import Database from "better-sqlite3";
import log from "electron-log/main";

import { exec } from "../database/common";
import { CREDENTIAL_KEY_PREFIXES } from "./keys";
import { accountCredentials } from "./store";

// Cyd once serialized the X-to-Bluesky migration's OAuth state and session,
// which carry access tokens, refresh tokens, and a private DPoP key, into the
// account's plaintext SQLite config table, under these keys.
const LEGACY_CREDENTIAL_KEY_PATTERNS = CREDENTIAL_KEY_PREFIXES.map(
  (prefix) => `${prefix}%`,
);

// The DID names the Bluesky identity a session belonged to. When credentials
// are discarded rather than saved, this goes too, so the account does not
// keep claiming a connection it can no longer use.
const BLUESKY_DID_KEY = "blueskyDID";

export type LegacyCredentialSweep = {
  // Keys that now live in protected storage.
  moved: string[];
  // Keys that could not be moved, and were destroyed along with the rows
  // that held them. The user reconnects; nothing they saved is lost.
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
  // A failure here leaves remnants behind but must not stop the sweep, which
  // has already removed the rows themselves.
  const attempt = (what: string, purge: () => void) => {
    try {
      purge();
    } catch (error) {
      log.warn(`sweepLegacyOAuthCredentials: could not ${what}`, error);
    }
  };

  const checkpoint = () => {
    db.pragma("wal_checkpoint(TRUNCATE)");
  };

  attempt("checkpoint the WAL", checkpoint);
  attempt("vacuum the database", () => db.exec("VACUUM"));
  // VACUUM rebuilds the database through the WAL, so truncate it again.
  attempt("checkpoint the WAL", checkpoint);
};

/**
 * Move an account's legacy plaintext OAuth credentials into protected storage
 * and erase the rows that held them.
 *
 * Called whenever an account database opens, this is the only path that reads
 * those legacy rows. It is idempotent. The credential store persists on every
 * desktop, protected where the operating system offers protection and in the
 * clear where it does not, so a sweep normally moves everything. A credential
 * that cannot be stored at all is destroyed rather than left readable here.
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

  const credentials = accountCredentials(accountID);

  for (const row of rows) {
    // The old store blanked rows rather than deleting them, so an empty value
    // is a tombstone, not a credential.
    if (!row.value) {
      continue;
    }
    try {
      credentials.set(row.key, row.value);
      sweep.moved.push(row.key);
    } catch (error) {
      // Credential names can carry a Bluesky DID, so the failure names the
      // account rather than the credential.
      log.error(
        `sweepLegacyOAuthCredentials: could not migrate a credential for account ${accountID}`,
        error,
      );
      sweep.discarded.push(row.key);
    }
  }

  exec(db, `DELETE FROM config WHERE ${whereClause}`, [
    ...LEGACY_CREDENTIAL_KEY_PATTERNS,
  ]);

  if (sweep.discarded.length > 0) {
    // Cyd cannot revoke a credential it just refused to hold, so the least it
    // can do is stop presenting the account as connected. Reconnecting
    // replaces the session Cyd threw away.
    exec(db, "DELETE FROM config WHERE key = ?", [BLUESKY_DID_KEY]);
  }

  purgeDeletedRowRemnants(db);

  log.info(
    `sweepLegacyOAuthCredentials: migrated ${sweep.moved.length} and discarded ${sweep.discarded.length} legacy credentials for account ${accountID}`,
  );

  return sweep;
};
