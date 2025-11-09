import type { Migration } from "../../database";

/**
 * Database migrations for Facebook account controller.
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
      `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`,
      `CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    profilePictureFilename TEXT NOT NULL
);`,
      `CREATE TABLE story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    text TEXT,
    title TEXT,
    lifeEventTitle TEXT,
    userID TEXT NOT NULL, -- Foreign key to user.userID
    attachedStoryID INTEGER, -- Foreign key to attached_story.id
    addedToDatabaseAt DATETIME NOT NULL,
    archivedAt DATETIME,
    deletedStoryAt DATETIME,
    FOREIGN KEY(userID) REFERENCES user(userID),
    FOREIGN KEY(attachedStoryID) REFERENCES attached_story(storyID)
);`,
      `CREATE TABLE attached_story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL UNIQUE,
    text TEXT
);`,
      `CREATE TABLE media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mediaType TEXT NOT NULL, -- "Photo", "Video", "GenericAttachmentMedia"
    mediaID TEXT NOT NULL UNIQUE,
    filename TEXT,
    isPlayable BOOLEAN,
    accessibilityCaption TEXT,
                        title TEXT,
    url TEXT,
    needsVideoDownload BOOLEAN DEFAULT 0
);`,
      `CREATE TABLE media_story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL, -- Foreign key to story.storyID
    mediaID TEXT NOT NULL, -- Foreign key to media.mediaID
    FOREIGN KEY(storyID) REFERENCES story(storyID),
    FOREIGN KEY(mediaID) REFERENCES media(mediaID)
);`,
      `CREATE TABLE media_attached_story (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    storyID TEXT NOT NULL, -- Foreign key to attached_story.storyID
    mediaID TEXT NOT NULL, -- Foreign key to media.mediaID
    FOREIGN KEY(storyID) REFERENCES attached_story(storyID),
    FOREIGN KEY(mediaID) REFERENCES media(mediaID)
);`,
    ],
  },
];
