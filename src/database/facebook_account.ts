import { exec, getMainDatabase, Sqlite3Info } from "./common";
import { FacebookAccount } from "../shared_types";

// Types

export interface FacebookAccountRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  accountID: string;
  name: string;
  profileImageDataURI: string;
  saveMyData: boolean;
  deleteMyData: boolean;
  savePosts: boolean;
  savePostsHTML: boolean;
  deletePosts: boolean;
  deletePostsDaysOldEnabled: boolean;
  deletePostsDaysOld: number;
  deletePostsReactsThresholdEnabled: boolean;
  deletePostsReactsThreshold: number;
}

function facebookAccountRowToFacebookAccount(
  row: FacebookAccountRow,
): FacebookAccount {
  return {
    id: row.id,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    accessedAt: new Date(row.accessedAt),
    accountID: row.accountID,
    name: row.name,
    profileImageDataURI: row.profileImageDataURI,
    saveMyData: !!row.saveMyData,
    deleteMyData: !!row.deleteMyData,
    savePosts: !!row.savePosts,
    savePostsHTML: !!row.savePostsHTML,
    deletePosts: !!row.deletePosts,
    deletePostsDaysOldEnabled: !!row.deletePostsDaysOldEnabled,
    deletePostsDaysOld: row.deletePostsDaysOld,
    deletePostsReactsThresholdEnabled: !!row.deletePostsReactsThresholdEnabled,
    deletePostsReactsThreshold: row.deletePostsReactsThreshold,
  };
}

// Functions

// Get a single Facebook account by ID
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

// Get all Facebook accounts
export const getFacebookAccounts = (): FacebookAccount[] => {
  const rows: FacebookAccountRow[] = exec(
    getMainDatabase(),
    "SELECT * FROM facebookAccount",
    [],
    "all",
  ) as FacebookAccountRow[];

  const accounts: FacebookAccount[] = [];
  for (const row of rows) {
    accounts.push(facebookAccountRowToFacebookAccount(row));
  }
  return accounts;
};

// Create a new Facebook account
export const createFacebookAccount = (): FacebookAccount => {
  const info: Sqlite3Info = exec(
    getMainDatabase(),
    "INSERT INTO facebookAccount DEFAULT VALUES",
  ) as Sqlite3Info;
  const account = getFacebookAccount(info.lastInsertRowid);
  if (!account) {
    throw new Error("Failed to create account");
  }
  return account;
};

// Update the Facebook account based on account.id
export const saveFacebookAccount = (account: FacebookAccount) => {
  exec(
    getMainDatabase(),
    `
        UPDATE facebookAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            accountID = ?,
            name = ?,
            profileImageDataURI = ?,
            saveMyData = ?,
            deleteMyData = ?,
            savePosts = ?,
            savePostsHTML = ?,
            deletePosts = ?,
            deletePostsDaysOldEnabled = ?,
            deletePostsDaysOld = ?,
            deletePostsReactsThresholdEnabled = ?,
            deletePostsReactsThreshold = ?
        WHERE id = ?
    `,
    [
      account.accountID,
      account.name,
      account.profileImageDataURI,
      account.saveMyData ? 1 : 0,
      account.deleteMyData ? 1 : 0,
      account.savePosts ? 1 : 0,
      account.savePostsHTML ? 1 : 0,
      account.deletePosts ? 1 : 0,
      account.deletePostsDaysOldEnabled ? 1 : 0,
      account.deletePostsDaysOld,
      account.deletePostsReactsThresholdEnabled ? 1 : 0,
      account.deletePostsReactsThreshold,
      account.id,
    ],
  );
};
