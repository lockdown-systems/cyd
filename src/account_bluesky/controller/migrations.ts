import type { Migration } from "../../database";

/**
 * Migrations for one Bluesky local account's private runtime database.
 *
 * This database belongs to a single account and is never a compatibility
 * surface: the Cyd Bluesky archive interchange schema is what travels between
 * clients.
 */
export const migrations: Migration[] = [
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
      // One row per unique asset in this account's content-addressed media
      // store. Deduplication is per account, so an account can be exported or
      // deleted without depending on another account's storage.
      `CREATE TABLE media (
    digest TEXT PRIMARY KEY,
    byteLength INTEGER NOT NULL,
    mediaType TEXT NOT NULL,
    createdAt DATETIME NOT NULL
);`,
    ],
  },
  {
    // Bluesky saved data. The shape deliberately mirrors the Cyd Bluesky
    // archive v2 interchange schema (docs/archive/bluesky/v2/schema.sql), so
    // translating between this account's runtime storage and an archive stays
    // mechanical. It is still runtime storage, not a compatibility surface:
    // the checkpoint table and the asset retry columns have no archive
    // counterpart, because in-progress work never travels between clients.
    name: "saved data",
    sql: [
      // A captured author's labels at one moment. Rows are immutable and keyed
      // by the labels themselves, so re-observing an author reuses its row
      // while a renamed author gets a new one: refreshing a profile can never
      // rewrite the author a saved record was captured with.
      `CREATE TABLE profile (
    id TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    handle TEXT,
    displayName TEXT,
    description TEXT,
    avatarAssetID TEXT,
    bannerAssetID TEXT,
    capturedAt DATETIME NOT NULL
);`,
      `CREATE INDEX profile_did ON profile(did);`,
      // Which captured profile is this identity's current one. Historical rows
      // stay exactly as they were captured.
      `CREATE TABLE identity (
    did TEXT PRIMARY KEY,
    currentProfileID TEXT NOT NULL
);`,
      // The latest observation of a record at a stable AT URI, not a history
      // of its CID revisions.
      `CREATE TABLE record (
    uri TEXT PRIMARY KEY,
    cid TEXT,
    recordType TEXT NOT NULL,
    authorProfileID TEXT NOT NULL,
    indexedAt DATETIME,
    createdAt DATETIME NOT NULL,
    firstObservedAt DATETIME NOT NULL,
    observedAt DATETIME NOT NULL,
    sourceDeletedAt DATETIME,
    text TEXT,
    facetsJSON TEXT,
    payloadJSON TEXT NOT NULL
);`,
      `CREATE INDEX record_created ON record(createdAt);`,
      // What each category has selected for saving. Disabling a category
      // leaves its selections and records untouched.
      `CREATE TABLE selection (
    category TEXT NOT NULL,
    subjectID TEXT NOT NULL,
    selectedAt DATETIME NOT NULL,
    PRIMARY KEY (category, subjectID)
);`,
      // A repost, like, or bookmark and the record it is about.
      `CREATE TABLE recordSubject (
    relationshipURI TEXT PRIMARY KEY,
    subjectRecordURI TEXT NOT NULL
);`,
      // Bounded context: the directly referenced reply parent, quote, and
      // external embed. Threads are never recursively captured.
      `CREATE TABLE recordContext (
    recordURI TEXT NOT NULL,
    kind TEXT NOT NULL,
    contextRecordURI TEXT,
    contextProfileID TEXT,
    externalJSON TEXT,
    PRIMARY KEY (recordURI, kind)
);`,
      // Every asset Cyd expects, present or not. An asset that is not
      // available has no bytes and always has a reason, and it is this table
      // that makes pending and failed media explicit and retryable: the work
      // queue is derived from it rather than kept beside it, so a restart
      // finds exactly the work that is left.
      `CREATE TABLE asset (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    mediaType TEXT NOT NULL,
    byteCount INTEGER,
    digest TEXT,
    availability TEXT NOT NULL,
    unavailableReason TEXT,
    sourceURL TEXT,
    width INTEGER,
    height INTEGER,
    altText TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    lastAttemptAt DATETIME
);`,
      `CREATE INDEX asset_availability ON asset(availability);`,
      // Which record or profile expects which asset, in which role.
      `CREATE TABLE assetOwner (
    ownerType TEXT NOT NULL,
    ownerID TEXT NOT NULL,
    assetID TEXT NOT NULL,
    role TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (ownerType, ownerID, role, position)
);`,
      `CREATE INDEX assetOwner_asset ON assetOwner(assetID);`,
      // How far each category has got. Written in the same transaction as the
      // page it describes, so a checkpoint can never claim more than is
      // committed.
      `CREATE TABLE collectionCheckpoint (
    category TEXT PRIMARY KEY,
    stage TEXT NOT NULL,
    cursor TEXT,
    pagesListed INTEGER NOT NULL DEFAULT 0,
    recordsSaved INTEGER NOT NULL DEFAULT 0,
    mediaSaved INTEGER NOT NULL DEFAULT 0,
    mediaFailed INTEGER NOT NULL DEFAULT 0,
    updatedAt DATETIME NOT NULL
);`,
    ],
  },
];
