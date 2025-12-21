import { exec, getMainDatabase, Sqlite3Info } from "./common";
import type { FacebookAccount } from "../shared_types";

interface FacebookAccountRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  username: string;
  profileImageDataURI: string;
  accountID: string | null;
  deleteWallPosts: number;
}

function facebookAccountRowToFacebookAccount(
  row: FacebookAccountRow,
): FacebookAccount {
  return {
    id: row.id,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    accessedAt: new Date(row.accessedAt),
    username: row.username,
    profileImageDataURI: row.profileImageDataURI,
    accountID: row.accountID,
    deleteWallPosts: row.deleteWallPosts === 1,
  };
}

export const getFacebookAccount = (id: number): FacebookAccount | null => {
  const row: FacebookAccountRow | undefined = exec(
    getMainDatabase(),
    "SELECT * FROM facebookAccount WHERE id = ?",
    [id],
    "get",
  ) as FacebookAccountRow | undefined;

  if (!row) {
    return null;
  }

  return facebookAccountRowToFacebookAccount(row);
};

export const getFacebookAccounts = (): FacebookAccount[] => {
  const rows: FacebookAccountRow[] = exec(
    getMainDatabase(),
    "SELECT * FROM facebookAccount",
    [],
    "all",
  ) as FacebookAccountRow[];

  return rows.map((row) => facebookAccountRowToFacebookAccount(row));
};

export const createFacebookAccount = (): FacebookAccount => {
  const info: Sqlite3Info = exec(
    getMainDatabase(),
    "INSERT INTO facebookAccount DEFAULT VALUES",
  ) as Sqlite3Info;

  const account = getFacebookAccount(info.lastInsertRowid);
  if (!account) {
    throw new Error("Failed to create Facebook account");
  }

  return account;
};

export const saveFacebookAccount = (account: FacebookAccount) => {
  exec(
    getMainDatabase(),
    `
        UPDATE facebookAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            username = ?,
            profileImageDataURI = ?,
            accountID = ?,
            deleteWallPosts = ?
        WHERE id = ?
    `,
    [
      account.username,
      account.profileImageDataURI,
      account.accountID,
      account.deleteWallPosts ? 1 : 0,
      account.id,
    ],
  );
};
