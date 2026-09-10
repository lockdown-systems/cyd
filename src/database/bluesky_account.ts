import { exec, getMainDatabase, Sqlite3Info } from "./common";
import { BlueskyAccount } from "../shared_types";

// Types

export interface BlueskyAccountRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  did: string | null;
  handle: string | null;
  displayName: string | null;
  profileImageDataURI: string | null;
}

// Functions

const blueskyAccountFromRow = (row: BlueskyAccountRow): BlueskyAccount => {
  return {
    id: row.id,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    accessedAt: new Date(row.accessedAt),
    did: row.did,
    handle: row.handle,
    displayName: row.displayName,
    profileImageDataURI: row.profileImageDataURI,
  };
};

// Get a single Bluesky local account by ID
export const getBlueskyAccount = (id: number): BlueskyAccount | null => {
  const row: BlueskyAccountRow | undefined = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyAccount WHERE id = ?",
    [id],
    "get",
  ) as BlueskyAccountRow | undefined;
  if (!row) {
    return null;
  }
  return blueskyAccountFromRow(row);
};

// Get the Bluesky local account that represents a Bluesky identity
export const getBlueskyAccountByDID = (did: string): BlueskyAccount | null => {
  const row: BlueskyAccountRow | undefined = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyAccount WHERE did = ?",
    [did],
    "get",
  ) as BlueskyAccountRow | undefined;
  if (!row) {
    return null;
  }
  return blueskyAccountFromRow(row);
};

// Get all Bluesky local accounts
export const getBlueskyAccounts = (): BlueskyAccount[] => {
  const rows: BlueskyAccountRow[] = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyAccount",
    [],
    "all",
  ) as BlueskyAccountRow[];
  return rows.map(blueskyAccountFromRow);
};

// Create a new Bluesky local account
export const createBlueskyAccount = (): BlueskyAccount => {
  const info: Sqlite3Info = exec(
    getMainDatabase(),
    "INSERT INTO blueskyAccount DEFAULT VALUES",
  ) as Sqlite3Info;
  const account = getBlueskyAccount(info.lastInsertRowid);
  if (!account) {
    throw new Error("Failed to create account");
  }
  return account;
};

// Update the Bluesky local account based on account.id
export const saveBlueskyAccount = (account: BlueskyAccount) => {
  exec(
    getMainDatabase(),
    `
        UPDATE blueskyAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            did = ?,
            handle = ?,
            displayName = ?,
            profileImageDataURI = ?
        WHERE id = ?
    `,
    [
      account.did,
      account.handle,
      account.displayName,
      account.profileImageDataURI,
      account.id,
    ],
  );
};

// Delete a Bluesky local account's settings row
export const deleteBlueskyAccount = (id: number) => {
  exec(getMainDatabase(), "DELETE FROM blueskyAccount WHERE id = ?", [id]);
};
