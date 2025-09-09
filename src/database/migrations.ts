import { runMigrations, getMainDatabase } from "./common";

export const runMainMigrations = () => {
  runMigrations(getMainDatabase(), [
    // Create the tables
    {
      name: "initial",
      sql: [
        `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`,
        `CREATE TABLE account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'unknown',
    sortOrder INTEGER NOT NULL DEFAULT 0,
    xAccountId INTEGER DEFAULT NULL,
    uuid TEXT NOT NULL
);`,
        `CREATE TABLE xAccount (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    profileImageDataURI TEXT,
    saveMyData BOOLEAN DEFAULT 1,
    deleteMyData BOOLEAN DEFAULT 0,
    archiveTweets BOOLEAN DEFAULT 1,
    archiveTweetsHTML BOOLEAN DEFAULT 0,
    archiveLikes BOOLEAN DEFAULT 1,
    archiveDMs BOOLEAN DEFAULT 1,
    deleteTweets BOOLEAN DEFAULT 1,
    deleteTweetsDaysOld INTEGER DEFAULT 0,
    deleteTweetsLikesThresholdEnabled BOOLEAN DEFAULT 0,
    deleteTweetsLikesThreshold INTEGER DEFAULT 20,
    deleteTweetsRetweetsThresholdEnabled BOOLEAN DEFAULT 0,
    deleteTweetsRetweetsThreshold INTEGER DEFAULT 20,
    deleteRetweets BOOLEAN DEFAULT 1,
    deleteRetweetsDaysOld INTEGER DEFAULT 0,
    deleteLikes BOOLEAN DEFAULT 0,
    deleteLikesDaysOld INTEGER DEFAULT 0,
    deleteDMs BOOLEAN DEFAULT 0
);`,
      ],
    },
    // Add importFromArchive, followingCount, follwersCount, tweetsCount, likesCount to xAccount
    {
      name: "add importFromArchive, followingCount, follwersCount, tweetsCount, likesCount to xAccount",
      sql: [
        `ALTER TABLE xAccount ADD COLUMN importFromArchive BOOLEAN DEFAULT 1;`,
        `ALTER TABLE xAccount ADD COLUMN followingCount INTEGER DEFAULT 0;`,
        `ALTER TABLE xAccount ADD COLUMN followersCount INTEGER DEFAULT 0;`,
        `ALTER TABLE xAccount ADD COLUMN tweetsCount INTEGER DEFAULT -1;`,
        `ALTER TABLE xAccount ADD COLUMN likesCount INTEGER DEFAULT -1;`,
      ],
    },
    // Add unfollowEveryone to xAccount
    {
      name: "add unfollowEveryone to xAccount",
      sql: [
        `ALTER TABLE xAccount ADD COLUMN unfollowEveryone BOOLEAN DEFAULT 1;`,
      ],
    },
    // Add deleteTweetsDaysOldEnabled, deleteRetweetsDaysOldEnabled, deleteLikesDaysOldEnabled to xAccount
    {
      name: "add deleteTweetsDaysOldEnabled, deleteRetweetsDaysOldEnabled, deleteLikesDaysOldEnabled to xAccount",
      sql: [
        `ALTER TABLE xAccount ADD COLUMN deleteTweetsDaysOldEnabled BOOLEAN DEFAULT 0;`,
        `ALTER TABLE xAccount ADD COLUMN deleteRetweetsDaysOldEnabled BOOLEAN DEFAULT 0;`,
        `ALTER TABLE xAccount ADD COLUMN deleteLikesDaysOldEnabled BOOLEAN DEFAULT 0;`,
      ],
    },
    // Add errorReport table. Status can be "new", "submitted", and "dismissed"
    {
      name: "add errorReport table",
      sql: [
        `CREATE TABLE errorReport (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accountID INTEGER DEFAULT NULL,
    appVersion TEXT DEFAULT NULL,
    clientPlatform TEXT DEFAULT NULL,
    accountType TEXT DEFAULT NULL,
    errorReportType TEXT NOT NULL,
    errorReportData TEXT DEFAULT NULL,
    accountUsername TEXT DEFAULT NULL,
    screenshotDataURI TEXT DEFAULT NULL,
    sensitiveContextData TEXT DEFAULT NULL,
    status TEXT DEFAULT 'new'
);`,
      ],
    },
    // Add archiveMyData to xAccount
    {
      name: "add archiveMyData to xAccount",
      sql: [`ALTER TABLE xAccount ADD COLUMN archiveMyData BOOLEAN DEFAULT 0;`],
    },
    // Add archiveBookmarks, deleteBookmarks to xAccount
    {
      name: "add archiveBookmarks, deleteBookmarks to xAccount",
      sql: [
        `ALTER TABLE xAccount ADD COLUMN archiveBookmarks BOOLEAN DEFAULT 1;`,
        `ALTER TABLE xAccount ADD COLUMN deleteBookmarks BOOLEAN DEFAULT 0;`,
      ],
    },
    // Add Bluesky table, and blueskyAccountID to account
    {
      name: "add Bluesky table, and blueskyAccountID to account",
      sql: [
        `CREATE TABLE blueskyAccount (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    profileImageDataURI TEXT,
    saveMyData BOOLEAN DEFAULT 1,
    deleteMyData BOOLEAN DEFAULT 0,
    archivePosts BOOLEAN DEFAULT 1,
    archivePostsHTML BOOLEAN DEFAULT 0,
    archiveLikes BOOLEAN DEFAULT 1,
    deletePosts BOOLEAN DEFAULT 1,
    deletePostsDaysOldEnabled BOOLEAN DEFAULT 0,
    deletePostsDaysOld INTEGER DEFAULT 0,
    deletePostsLikesThresholdEnabled BOOLEAN DEFAULT 0,
    deletePostsLikesThreshold INTEGER DEFAULT 20,
    deletePostsRepostsThresholdEnabled BOOLEAN DEFAULT 0,
    deletePostsRepostsThreshold INTEGER DEFAULT 20,
    deleteReposts BOOLEAN DEFAULT 1,
    deleteRepostsDaysOldEnabled BOOLEAN DEFAULT 0,
    deleteRepostsDaysOld INTEGER DEFAULT 0,
    deleteLikes BOOLEAN DEFAULT 0,
    deleteLikesDaysOldEnabled BOOLEAN DEFAULT 0,
    deleteLikesDaysOld INTEGER DEFAULT 0,
    unfollowEveryone BOOLEAN DEFAULT 1,
    followingCount INTEGER DEFAULT 0,
    followersCount INTEGER DEFAULT 0,
    postsCount INTEGER DEFAULT -1,
    likesCount INTEGER DEFAULT -1
);`,
        `ALTER TABLE account ADD COLUMN blueskyAccountID INTEGER DEFAULT NULL;`,
      ],
    },
    // Add Facebook table, and facebookAccountID to account
    {
      name: "add Facebook table, and facebookAccountID to account",
      sql: [
        `CREATE TABLE facebookAccount (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accountID TEXT,
    name TEXT,
    profileImageDataURI TEXT,
    saveMyData BOOLEAN DEFAULT 1,
    deleteMyData BOOLEAN DEFAULT 0,
    savePosts BOOLEAN DEFAULT 1,
    savePostsHTML BOOLEAN DEFAULT 0,
    deletePosts BOOLEAN DEFAULT 1,
    deletePostsDaysOldEnabled BOOLEAN DEFAULT 0,
    deletePostsDaysOld INTEGER DEFAULT 0,
    deletePostsReactsThresholdEnabled BOOLEAN DEFAULT 0,
    deletePostsReactsThreshold INTEGER DEFAULT 20
);`,
        `ALTER TABLE account ADD COLUMN facebookAccountID INTEGER DEFAULT NULL;`,
      ],
    },
    // Add userID to xAccount table
    {
      name: "add userID to xAccount table",
      sql: [`ALTER TABLE xAccount ADD COLUMN userID TEXT;`],
    },
    // Add archiveOnly to xAccount table
    {
      name: "add archiveOnly to xAccount table",
      sql: [`ALTER TABLE xAccount ADD COLUMN archiveOnly BOOLEAN DEFAULT 0;`],
    },
    // Add tombstone settings to xAccount table
    {
      name: "add tombstone settings to xAccount table",
      sql: [
        `ALTER TABLE xAccount ADD COLUMN bio TEXT;`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneUpdateBanner BOOLEAN DEFAULT 1;`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneUpdateBannerBackground TEXT DEFAULT 'night';`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneUpdateBannerSocialIcons TEXT DEFAULT 'none';`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneUpdateBannerShowText BOOLEAN DEFAULT 1;`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneBannerDataURL TEXT DEFAULT '';`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneUpdateBio BOOLEAN DEFAULT 1;`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneUpdateBioText TEXT DEFAULT '';`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneUpdateBioCreditCyd BOOLEAN DEFAULT 1;`,
        `ALTER TABLE xAccount ADD COLUMN tombstoneLockAccount BOOLEAN DEFAULT 1;`,
      ],
    },
  ]);
};
