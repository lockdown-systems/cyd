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
  deleteComments: number;
  deleteReactions: number;
  deletePostsOnOthers: number;
  deleteOthersPosts: number;
  deleteCheckins: number;
  deleteTaggedPosts: number;
  deleteTaggedMedia: number;
  userLang: string;
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
    deleteComments: row.deleteComments === 1,
    deleteReactions: row.deleteReactions === 1,
    deletePostsOnOthers: row.deletePostsOnOthers === 1,
    deleteOthersPosts: row.deleteOthersPosts === 1,
    deleteCheckins: row.deleteCheckins === 1,
    deleteTaggedPosts: row.deleteTaggedPosts === 1,
    deleteTaggedMedia: row.deleteTaggedMedia === 1,
    userLang: row.userLang || "English (US)",
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
            deleteWallPosts = ?,
            deleteComments = ?,
            deleteReactions = ?,
            deletePostsOnOthers = ?,
            deleteOthersPosts = ?,
            deleteCheckins = ?,
            deleteTaggedPosts = ?,
            deleteTaggedMedia = ?,
            userLang = ?
        WHERE id = ?
    `,
    [
      account.username,
      account.profileImageDataURI,
      account.accountID,
      account.deleteWallPosts ? 1 : 0,
      account.deleteComments ? 1 : 0,
      account.deleteReactions ? 1 : 0,
      account.deletePostsOnOthers ? 1 : 0,
      account.deleteOthersPosts ? 1 : 0,
      account.deleteCheckins ? 1 : 0,
      account.deleteTaggedPosts ? 1 : 0,
      account.deleteTaggedMedia ? 1 : 0,
      account.userLang || "English (US)",
      account.id,
    ],
  );
};
