import type { Migration } from "../../database";

/**
 * Database migrations for X account controller.
 * These migrations are applied in order when initializing the database.
 */
export const migrations: Migration[] = [
  // Create the tables
  {
    name: "initial",
    sql: [
      `CREATE TABLE job (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jobType TEXT NOT NULL,
    status TEXT NOT NULL,
    scheduledAt DATETIME NOT NULL,
    startedAt DATETIME,
    finishedAt DATETIME,
    progressJSON TEXT,
    error TEXT
);`,
      `CREATE TABLE tweet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    tweetID TEXT NOT NULL UNIQUE,
    conversationID TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    likeCount INTEGER NOT NULL,
    quoteCount INTEGER NOT NULL,
    replyCount INTEGER NOT NULL,
    retweetCount INTEGER NOT NULL,
    isLiked BOOLEAN NOT NULL,
    isRetweeted BOOLEAN NOT NULL,
    text TEXT NOT NULL,
    path TEXT NOT NULL,
    addedToDatabaseAt DATETIME NOT NULL,
    archivedAt DATETIME,
    deletedAt DATETIME
);`,
      `CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL UNIQUE,
    name TEXT,
    screenName TEXT NOT NULL,
    profileImageDataURI TEXT
);`,
      `CREATE TABLE conversation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationID TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    sortTimestamp TEXT,
    minEntryID TEXT,
    maxEntryID TEXT,
    isTrusted BOOLEAN,
    shouldIndexMessages BOOLEAN,
    addedToDatabaseAt DATETIME NOT NULL,
    updatedInDatabaseAt DATETIME,
    deletedAt DATETIME
);`,
      `CREATE TABLE conversation_participant (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationID TEXT NOT NULL,
    userID TEXT NOT NULL
);`,
      `CREATE TABLE message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageID TEXT NOT NULL UNIQUE,
    conversationID TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    senderID TEXT NOT NULL,
    text TEXT NOT NULL,
    deletedAt DATETIME
);`,
    ],
  },
  // Add the config table
  {
    name: "20241016_add_config",
    sql: [
      `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`,
    ],
  },
  // Update the tweet table to make some columns nullable
  {
    name: "20241127_make_tweet_cols_nullable",
    sql: [
      `CREATE TABLE tweet_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    tweetID TEXT NOT NULL UNIQUE,
    conversationID TEXT,
    createdAt DATETIME,
    likeCount INTEGER,
    quoteCount INTEGER,
    replyCount INTEGER,
    retweetCount INTEGER,
    isLiked BOOLEAN,
    isRetweeted BOOLEAN,
    text TEXT,
    path TEXT NOT NULL,
    addedToDatabaseAt DATETIME NOT NULL,
    archivedAt DATETIME,
    deletedAt DATETIME
);`,
      `INSERT INTO tweet_new SELECT * FROM tweet;`,
      `DROP TABLE tweet;`,
      `ALTER TABLE tweet_new RENAME TO tweet;`,
    ],
  },
  // Add isBookmarked to the tweet table, and update isBookarked for all tweets
  {
    name: "20241127_add_isBookmarked",
    sql: [
      `ALTER TABLE tweet ADD COLUMN isBookmarked BOOLEAN;`,
      `UPDATE tweet SET isBookmarked = 0;`,
    ],
  },
  // Add deletedTweetAt, deletedRetweetAt, deletedLikeAt, and deletedBookmarkAt to the tweet table, and
  // try to guess which types of deletions have already occured
  {
    name: "20241127_add_deletedAt_fields",
    sql: [
      `ALTER TABLE tweet ADD COLUMN deletedTweetAt DATETIME;`,
      `ALTER TABLE tweet ADD COLUMN deletedRetweetAt DATETIME;`,
      `ALTER TABLE tweet ADD COLUMN deletedLikeAt DATETIME;`,
      `ALTER TABLE tweet ADD COLUMN deletedBookmarkAt DATETIME;`,
      `UPDATE tweet SET deletedTweetAt = deletedAt WHERE deletedAt IS NOT NULL AND isLiked = 0 AND text NOT LIKE 'RT @%';`,
      `UPDATE tweet SET deletedRetweetAt = deletedAt WHERE deletedAt IS NOT NULL AND isLiked = 0 AND text LIKE 'RT @%';`,
      `UPDATE tweet SET deletedLikeAt = deletedAt WHERE deletedAt IS NOT NULL AND isLiked = 1;`,
    ],
  },
  // Add tweet_bsky_migration table
  {
    name: "20250205_add_tweet_bsky_migration_table",
    sql: [
      `CREATE TABLE tweet_bsky_migration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tweetID TEXT NOT NULL,
    atprotoURI TEXT NOT NULL,
    atprotoCID TEXT NOT NULL,
    migratedAt DATETIME NOT NULL
);`,
    ],
  },
  // Add hasMedia to the tweet table, and create tweet_media table
  {
    name: "20250206_add_hasMedia_and_tweet_media",
    sql: [
      `CREATE TABLE tweet_media (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mediaID TEXT NOT NULL UNIQUE,
                        mediaType TEXT NOT NULL,
                        tweetID TEXT NOT NULL
                    );`,
      `ALTER TABLE tweet ADD COLUMN hasMedia BOOLEAN;`,
      `UPDATE tweet SET hasMedia = 0;`,
    ],
  },
  // Add isReply, replyTweetID, replyUserID, isQuote and quotedTweet to the tweet table
  {
    name: "20250206_add_reply_and_quote_fields",
    sql: [
      `ALTER TABLE tweet ADD COLUMN isReply BOOLEAN;`,
      `ALTER TABLE tweet ADD COLUMN replyTweetID TEXT;`,
      `ALTER TABLE tweet ADD COLUMN replyUserID TEXT;`,
      `ALTER TABLE tweet ADD COLUMN isQuote BOOLEAN;`,
      `ALTER TABLE tweet ADD COLUMN quotedTweet TEXT;`,
      `UPDATE tweet SET isReply = 0;`,
      `UPDATE tweet SET isQuote = 0;`,
    ],
  },
  // Add tweet_url table. Add url and indices to tweet_media table
  {
    name: "20250207_add_tweet_urls_and_more_tweet_media_fields",
    sql: [
      `CREATE TABLE tweet_url (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        url TEXT NOT NULL,
                        displayURL TEXT NOT NULL,
                        expandedURL TEXT NOT NULL,
                        startIndex INTEGER NOT NULL,
                        endIndex INTEGER NOT NULL,
                        tweetID TEXT NOT NULL,
                        UNIQUE(url, tweetID)
                    );`,
      `ALTER TABLE tweet_media ADD COLUMN url TEXT;`,
      `ALTER TABLE tweet_media ADD COLUMN filename TEXT;`,
      `ALTER TABLE tweet_media ADD COLUMN startIndex INTEGER;`,
      `ALTER TABLE tweet_media ADD COLUMN endIndex INTEGER;`,
    ],
  },
];
