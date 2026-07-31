import { exec, getMainDatabase } from "./common";
import { BlueskyLocalAccount } from "../shared_types";

interface BlueskyLocalAccountRow {
  uuid: string;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  did: string | null;
  handle: string;
  displayName: string;
  avatarUrl: string;
}

const accountFromRow = (row: BlueskyLocalAccountRow): BlueskyLocalAccount => ({
  uuid: row.uuid,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
  accessedAt: new Date(row.accessedAt),
  did: row.did,
  handle: row.handle,
  displayName: row.displayName,
  avatarUrl: row.avatarUrl,
});

export const getBlueskyLocalAccount = (
  uuid: string,
): BlueskyLocalAccount | null => {
  const row = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyLocalAccount WHERE uuid = ?",
    [uuid],
    "get",
  ) as BlueskyLocalAccountRow | undefined;
  return row ? accountFromRow(row) : null;
};

export const getBlueskyLocalAccounts = (): BlueskyLocalAccount[] => {
  const rows = exec(
    getMainDatabase(),
    "SELECT * FROM blueskyLocalAccount",
    [],
    "all",
  ) as BlueskyLocalAccountRow[];
  return rows.map(accountFromRow);
};

export const createBlueskyLocalAccount = (
  uuid: string,
): BlueskyLocalAccount => {
  exec(getMainDatabase(), "INSERT INTO blueskyLocalAccount (uuid) VALUES (?)", [
    uuid,
  ]);
  const account = getBlueskyLocalAccount(uuid);
  if (!account) {
    throw new Error("Failed to create Bluesky local account");
  }
  return account;
};

export const saveBlueskyLocalAccount = (account: BlueskyLocalAccount): void => {
  const storedAccount = getBlueskyLocalAccount(account.uuid);
  if (storedAccount?.did && storedAccount.did !== account.did) {
    throw new Error("A Bluesky local account DID cannot be changed");
  }
  exec(
    getMainDatabase(),
    `UPDATE blueskyLocalAccount
     SET updatedAt = CURRENT_TIMESTAMP,
         accessedAt = CURRENT_TIMESTAMP,
         did = ?,
         handle = ?,
         displayName = ?,
         avatarUrl = ?
     WHERE uuid = ?`,
    [
      account.did,
      account.handle,
      account.displayName,
      account.avatarUrl,
      account.uuid,
    ],
  );
};
