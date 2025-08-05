import { exec, getMainDatabase, Sqlite3Info } from "./common";
import { XAccount } from "../shared_types";

// Types

interface XAccountRow {
  id: number;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  username: string;
  userID: string;
  profileImageDataURI: string;
  importFromArchive: boolean;
  saveMyData: boolean;
  deleteMyData: boolean;
  archiveMyData: boolean;
  archiveTweets: boolean;
  archiveTweetsHTML: boolean;
  archiveLikes: boolean;
  archiveBookmarks: boolean;
  archiveDMs: boolean;
  deleteTweets: boolean;
  deleteTweetsDaysOldEnabled: boolean;
  deleteTweetsDaysOld: number;
  deleteTweetsLikesThresholdEnabled: boolean;
  deleteTweetsLikesThreshold: number;
  deleteTweetsRetweetsThresholdEnabled: boolean;
  deleteTweetsRetweetsThreshold: number;
  deleteRetweets: boolean;
  deleteRetweetsDaysOldEnabled: boolean;
  deleteRetweetsDaysOld: number;
  deleteLikes: boolean;
  deleteBookmarks: number;
  deleteDMs: boolean;
  unfollowEveryone: boolean;
  followingCount: number;
  followersCount: number;
  tweetsCount: number;
  likesCount: number;
  archiveOnly: boolean;
}

function xAccountRowtoXAccount(row: XAccountRow): XAccount {
  return {
    id: row.id,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    accessedAt: new Date(row.accessedAt),
    username: row.username,
    userID: row.userID,
    profileImageDataURI: row.profileImageDataURI,
    importFromArchive: !!row.importFromArchive,
    saveMyData: !!row.saveMyData,
    deleteMyData: !!row.deleteMyData,
    archiveMyData: !!row.archiveMyData,
    archiveTweets: !!row.archiveTweets,
    archiveTweetsHTML: !!row.archiveTweetsHTML,
    archiveLikes: !!row.archiveLikes,
    archiveBookmarks: !!row.archiveBookmarks,
    archiveDMs: !!row.archiveDMs,
    deleteTweets: !!row.deleteTweets,
    deleteTweetsDaysOldEnabled: !!row.deleteTweetsDaysOldEnabled,
    deleteTweetsDaysOld: row.deleteTweetsDaysOld,
    deleteTweetsLikesThresholdEnabled: !!row.deleteTweetsLikesThresholdEnabled,
    deleteTweetsLikesThreshold: row.deleteTweetsLikesThreshold,
    deleteTweetsRetweetsThresholdEnabled:
      !!row.deleteTweetsRetweetsThresholdEnabled,
    deleteTweetsRetweetsThreshold: row.deleteTweetsRetweetsThreshold,
    deleteRetweets: !!row.deleteRetweets,
    deleteRetweetsDaysOldEnabled: !!row.deleteRetweetsDaysOldEnabled,
    deleteRetweetsDaysOld: row.deleteRetweetsDaysOld,
    deleteLikes: !!row.deleteLikes,
    deleteBookmarks: !!row.deleteBookmarks,
    deleteDMs: !!row.deleteDMs,
    unfollowEveryone: !!row.unfollowEveryone,
    followingCount: row.followingCount,
    followersCount: row.followersCount,
    tweetsCount: row.tweetsCount,
    likesCount: row.likesCount,
    archiveOnly: !!row.archiveOnly,
  };
}

// Functions

export const getXAccount = (id: number): XAccount | null => {
  const row: XAccountRow | undefined = exec(
    getMainDatabase(),
    "SELECT * FROM xAccount WHERE id = ?",
    [id],
    "get",
  ) as XAccountRow | undefined;
  if (!row) {
    return null;
  }
  return xAccountRowtoXAccount(row);
};

export const getXAccounts = (): XAccount[] => {
  const rows: XAccountRow[] = exec(
    getMainDatabase(),
    "SELECT * FROM xAccount",
    [],
    "all",
  ) as XAccountRow[];

  const accounts: XAccount[] = [];
  for (const row of rows) {
    accounts.push(xAccountRowtoXAccount(row));
  }
  return accounts;
};

export const createXAccount = (): XAccount => {
  const info: Sqlite3Info = exec(
    getMainDatabase(),
    "INSERT INTO xAccount DEFAULT VALUES",
  ) as Sqlite3Info;
  const account = getXAccount(info.lastInsertRowid);
  if (!account) {
    throw new Error("Failed to create account");
  }
  return account;
};

// Update the account based on account.id
export const saveXAccount = (account: XAccount) => {
  exec(
    getMainDatabase(),
    `
        UPDATE xAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            username = ?,
            userID = ?,
            profileImageDataURI = ?,
            importFromArchive = ?,
            saveMyData = ?,
            deleteMyData = ?,
            archiveMyData = ?,
            archiveTweets = ?,
            archiveTweetsHTML = ?,
            archiveLikes = ?,
            archiveBookmarks = ?,
            archiveDMs = ?,
            deleteTweets = ?,
            deleteTweetsDaysOld = ?,
            deleteTweetsDaysOldEnabled = ?,
            deleteTweetsLikesThresholdEnabled = ?,
            deleteTweetsLikesThreshold = ?,
            deleteTweetsRetweetsThresholdEnabled = ?,
            deleteTweetsRetweetsThreshold = ?,
            deleteRetweets = ?,
            deleteRetweetsDaysOldEnabled = ?,
            deleteRetweetsDaysOld = ?,
            deleteLikes = ?,
            deleteBookmarks = ?,
            deleteDMs = ?,
            unfollowEveryone = ?,
            followingCount = ?,
            followersCount = ?,
            tweetsCount = ?,
            likesCount = ?,
            archiveOnly = ?
        WHERE id = ?
    `,
    [
      account.username,
      account.userID,
      account.profileImageDataURI,
      account.importFromArchive ? 1 : 0,
      account.saveMyData ? 1 : 0,
      account.deleteMyData ? 1 : 0,
      account.archiveMyData ? 1 : 0,
      account.archiveTweets ? 1 : 0,
      account.archiveTweetsHTML ? 1 : 0,
      account.archiveLikes ? 1 : 0,
      account.archiveBookmarks ? 1 : 0,
      account.archiveDMs ? 1 : 0,
      account.deleteTweets ? 1 : 0,
      account.deleteTweetsDaysOld,
      account.deleteTweetsDaysOldEnabled ? 1 : 0,
      account.deleteTweetsLikesThresholdEnabled ? 1 : 0,
      account.deleteTweetsLikesThreshold,
      account.deleteTweetsRetweetsThresholdEnabled ? 1 : 0,
      account.deleteTweetsRetweetsThreshold,
      account.deleteRetweets ? 1 : 0,
      account.deleteRetweetsDaysOldEnabled ? 1 : 0,
      account.deleteRetweetsDaysOld,
      account.deleteLikes ? 1 : 0,
      account.deleteBookmarks ? 1 : 0,
      account.deleteDMs ? 1 : 0,
      account.unfollowEveryone ? 1 : 0,
      account.followingCount,
      account.followersCount,
      account.tweetsCount,
      account.likesCount,
      account.archiveOnly ? 1 : 0,
      account.id,
    ],
  );
};
