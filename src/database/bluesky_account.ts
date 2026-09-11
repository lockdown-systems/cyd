import { exec, getMainDatabase } from "./common";
import { BlueskyLocalAccount } from "../shared_types";

// Types

export interface BlueskyLocalAccountRow {
  uuid: string;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  did: string | null;
  handle: string | null;
  displayName: string | null;
  profileImageDataURI: string | null;
  connectedAt: string | null;
}

// Functions

const blueskyLocalAccountFromRow = (
  row: BlueskyLocalAccountRow,
): BlueskyLocalAccount => {
  return {
    uuid: row.uuid,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    accessedAt: new Date(row.accessedAt),
    did: row.did,
    handle: row.handle,
    displayName: row.displayName,
    profileImageDataURI: row.profileImageDataURI,
    connectedAt: row.connectedAt ? new Date(row.connectedAt) : null,
  };
};

// Get a single Bluesky local account by its Cyd UUID
export const getBlueskyLocalAccount = (
  uuid: string,
): BlueskyLocalAccount | null => {
  const row: BlueskyLocalAccountRow | undefined = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyLocalAccount WHERE uuid = ?",
    [uuid],
    "get",
  ) as BlueskyLocalAccountRow | undefined;
  if (!row) {
    return null;
  }
  return blueskyLocalAccountFromRow(row);
};

// Get the Bluesky local account that represents a Bluesky identity
export const getBlueskyLocalAccountByDID = (
  did: string,
): BlueskyLocalAccount | null => {
  const row: BlueskyLocalAccountRow | undefined = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyLocalAccount WHERE did = ?",
    [did],
    "get",
  ) as BlueskyLocalAccountRow | undefined;
  if (!row) {
    return null;
  }
  return blueskyLocalAccountFromRow(row);
};

// Get all Bluesky local accounts
export const getBlueskyLocalAccounts = (): BlueskyLocalAccount[] => {
  const rows: BlueskyLocalAccountRow[] = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyLocalAccount",
    [],
    "all",
  ) as BlueskyLocalAccountRow[];
  return rows.map(blueskyLocalAccountFromRow);
};

// Create a new Bluesky local account, keyed by its account's Cyd UUID
export const createBlueskyLocalAccount = (
  uuid: string,
): BlueskyLocalAccount => {
  exec(getMainDatabase(), "INSERT INTO blueskyLocalAccount (uuid) VALUES (?)", [
    uuid,
  ]);
  const account = getBlueskyLocalAccount(uuid);
  if (!account) {
    throw new Error("Failed to create account");
  }
  return account;
};

// Update a Bluesky local account's identity and profile data
export const saveBlueskyLocalAccount = (account: BlueskyLocalAccount) => {
  // The DID is the durable social identity of this local account. Its handle
  // and display name change freely; the identity behind them does not.
  const storedAccount = getBlueskyLocalAccount(account.uuid);
  if (storedAccount?.did && storedAccount.did !== account.did) {
    throw new Error("A Bluesky local account's identity cannot change");
  }

  exec(
    getMainDatabase(),
    `
        UPDATE blueskyLocalAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            did = ?,
            handle = ?,
            displayName = ?,
            profileImageDataURI = ?
        WHERE uuid = ?
    `,
    [
      account.did,
      account.handle,
      account.displayName,
      account.profileImageDataURI,
      account.uuid,
    ],
  );
};

/**
 * Record that this installation is authorized to act on the account's
 * identity, or that it is no longer.
 *
 * Connection state is deliberately not part of `saveBlueskyLocalAccount`: the
 * renderer hands whole accounts to that function, and whether a shared OAuth
 * session still has a holder must only change on the connect and disconnect
 * paths that actually established or released the authorization.
 */
export const setBlueskyLocalAccountConnected = (
  uuid: string,
  connected: boolean,
) => {
  exec(
    getMainDatabase(),
    `
        UPDATE blueskyLocalAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            connectedAt = ?
        WHERE uuid = ?
    `,
    [connected ? new Date().toISOString() : null, uuid],
  );
};

/**
 * The Cyd account IDs of every connected Bluesky local account bound to this
 * identity. These are the Bluesky platform's holders of the identity's shared
 * OAuth session, derived from account state rather than counted.
 */
export const getConnectedBlueskyLocalAccountIDs = (did: string): number[] => {
  const rows: { id: number }[] = exec(
    getMainDatabase(),
    `
        SELECT account.id AS id
        FROM account
        JOIN blueskyLocalAccount ON blueskyLocalAccount.uuid = account.uuid
        WHERE account.type = 'Bluesky'
        AND blueskyLocalAccount.did = ?
        AND blueskyLocalAccount.connectedAt IS NOT NULL
    `,
    [did],
    "all",
  ) as { id: number }[];
  return rows.map((row) => row.id);
};

// Delete a Bluesky local account's row
export const deleteBlueskyLocalAccount = (uuid: string) => {
  exec(getMainDatabase(), "DELETE FROM blueskyLocalAccount WHERE uuid = ?", [
    uuid,
  ]);
};
