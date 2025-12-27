export type Migration = {
  version: number;
  name: string;
  statements: string[];
};

export const migrations: Migration[] = [
  {
    version: 1,
    name: "initial account + bsky schema",
    statements: [
      `CREATE TABLE IF NOT EXISTS bsky_account (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        accessedAt INTEGER,
        handle TEXT NOT NULL UNIQUE,
        displayName TEXT,
        postsCount INTEGER DEFAULT 0,
        settingSavePosts INTEGER DEFAULT 1,
        settingSaveLikes INTEGER DEFAULT 1,
        settingSaveBookmarks INTEGER DEFAULT 1,
        settingSaveChat INTEGER DEFAULT 0,
        settingSaveFollowing INTEGER DEFAULT 1,
        settingDeletePosts INTEGER DEFAULT 0,
        settingDeletePostsDaysOldEnabled INTEGER DEFAULT 0,
        settingDeletePostsDaysOld INTEGER DEFAULT 0,
        settingDeletePostsLikesThresholdEnabled INTEGER DEFAULT 0,
        settingDeletePostsLikesThreshold INTEGER DEFAULT 0,
        settingDeletePostsRepostsThresholdEnabled INTEGER DEFAULT 0,
        settingDeletePostsRepostsThreshold INTEGER DEFAULT 0,
        settingDeleteReposts INTEGER DEFAULT 0,
        settingDeleteRepostsDaysOldEnabled INTEGER DEFAULT 0,
        settingDeleteRepostsDaysOld INTEGER DEFAULT 0,
        settingDeleteLikes INTEGER DEFAULT 0,
        settingDeleteLikesDaysOldEnabled INTEGER DEFAULT 0,
        settingDeleteLikesDaysOld INTEGER DEFAULT 0,
        settingDeleteChats INTEGER DEFAULT 0,
        settingDeleteChatsDaysOldEnabled INTEGER DEFAULT 0,
        settingDeleteChatsDaysOld INTEGER DEFAULT 0,
        settingDeleteBookmarks INTEGER DEFAULT 0,
        settingDeleteUnfollowEveryone INTEGER DEFAULT 0,
        avatarDataURI TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS account (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        sortOrder INTEGER DEFAULT 0,
        type TEXT NOT NULL CHECK (type IN ('bluesky')),
        bskyAccountID INTEGER NOT NULL UNIQUE,
        FOREIGN KEY (bskyAccountID) REFERENCES bsky_account(id) ON DELETE CASCADE
      );`,
      `CREATE INDEX IF NOT EXISTS idx_account_sort_order ON account(sortOrder ASC, id ASC);`,
    ],
  },
  {
    version: 2,
    name: "store bluesky oauth session",
    statements: [
      `ALTER TABLE bsky_account ADD COLUMN did TEXT;`,
      `ALTER TABLE bsky_account ADD COLUMN accessJwt TEXT;`,
      `ALTER TABLE bsky_account ADD COLUMN refreshJwt TEXT;`,
      `ALTER TABLE bsky_account ADD COLUMN sessionJson TEXT;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_bsky_account_did ON bsky_account(did);`,
    ],
  },
];
