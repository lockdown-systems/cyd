import crypto from "crypto";

import type Database from "better-sqlite3";

import { exec } from "../../database";
import type {
  BlueskyCategory,
  BlueskyCollectionCheckpoint,
  BlueskyCollectionStage,
} from "../../shared_types";
import type { BlueskyAssetRow, BlueskyCheckpointRow } from "../types";
import type {
  BlueskyContextObservation,
  BlueskyExpectedAsset,
  BlueskyProfileObservation,
  BlueskyRecordObservation,
} from "./mapping";
import { blueskyAssetAddress, profileAssets } from "./mapping";

/**
 * Writing Bluesky saved data into one account's runtime database.
 *
 * Every identifier here is derived from what it describes rather than handed
 * out by the database, which is what makes collection idempotent: saving the
 * same page twice writes the same rows twice and leaves the same data. That is
 * the whole basis of resuming after an interruption without duplicates.
 */

const AVAILABILITY_MISSING = "missing";
const AVAILABILITY_AVAILABLE = "available";

/** An asset that has been enumerated but not fetched yet. */
const BLUESKY_ASSET_NOT_FETCHED = "not fetched yet";

const digestOf = (...parts: (string | number)[]): string =>
  crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex");

/**
 * A captured profile's identifier, derived from the labels it captured.
 *
 * Re-observing an author with the same labels reuses its row, while an author
 * who has since been renamed gets a new one. The old row is never rewritten,
 * so the author a record was saved with stays as it was captured.
 */
export const blueskyProfileID = (profile: BlueskyProfileObservation): string =>
  digestOf(
    profile.did,
    profile.handle ?? "",
    profile.displayName ?? "",
    profile.description ?? "",
    profile.avatarSourceURL ?? "",
    profile.bannerSourceURL ?? "",
  ).slice(0, 32);

/**
 * An asset's identifier, derived from what expects it and in what role. An
 * asset re-enumerated on a later run is recognized as the same asset, so a
 * retry upgrades the row that is already there rather than adding another.
 */
export const blueskyAssetID = (
  ownerType: "record" | "profile",
  ownerID: string,
  role: string,
  position: number,
): string => digestOf(ownerType, ownerID, role, position).slice(0, 32);

const upsertAsset = (
  db: Database.Database,
  ownerType: "record" | "profile",
  ownerID: string,
  asset: BlueskyExpectedAsset,
) => {
  const id = blueskyAssetID(ownerType, ownerID, asset.role, asset.position);
  const sourceURL = blueskyAssetAddress(asset.source);

  // An asset whose bytes are already here keeps them: re-observing a record
  // must not throw away media that was successfully saved. Only its
  // description is refreshed, in case the source changed its dimensions or
  // alt text.
  exec(
    db,
    `INSERT INTO asset (id, kind, mediaType, availability, unavailableReason, sourceURL, width, height, altText)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       kind = excluded.kind,
       sourceURL = excluded.sourceURL,
       width = excluded.width,
       height = excluded.height,
       altText = excluded.altText`,
    [
      id,
      asset.kind,
      asset.mediaType,
      AVAILABILITY_MISSING,
      BLUESKY_ASSET_NOT_FETCHED,
      sourceURL,
      asset.width,
      asset.height,
      asset.altText,
    ],
  );

  exec(
    db,
    `INSERT INTO assetOwner (ownerType, ownerID, assetID, role, position)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(ownerType, ownerID, role, position) DO UPDATE SET
       assetID = excluded.assetID`,
    [ownerType, ownerID, id, asset.role, asset.position],
  );

  return id;
};

/**
 * Record a captured author exactly as it was observed, and return the profile
 * the record should point at.
 */
export const saveBlueskyProfile = (
  db: Database.Database,
  profile: BlueskyProfileObservation,
  observedAt: string,
): string => {
  const id = blueskyProfileID(profile);
  const assets = profileAssets(profile);
  const avatarID = assets.find((asset) => asset.role === "avatar")
    ? blueskyAssetID("profile", id, "avatar", 0)
    : null;
  const bannerID = assets.find((asset) => asset.role === "banner")
    ? blueskyAssetID("profile", id, "banner", 0)
    : null;

  // Captured labels are immutable, so an existing row is left alone rather
  // than refreshed: this is the guarantee that a later profile refresh cannot
  // rewrite the author a saved record was captured with.
  exec(
    db,
    `INSERT INTO profile (id, did, handle, displayName, description, avatarAssetID, bannerAssetID, capturedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [
      id,
      profile.did,
      profile.handle,
      profile.displayName,
      profile.description,
      avatarID,
      bannerID,
      observedAt,
    ],
  );

  for (const asset of assets) {
    upsertAsset(db, "profile", id, asset);
  }

  return id;
};

/** Point an identity at the profile that is currently its own. */
export const setBlueskyCurrentProfile = (
  db: Database.Database,
  did: string,
  profileID: string,
) => {
  exec(
    db,
    `INSERT INTO identity (did, currentProfileID) VALUES (?, ?)
     ON CONFLICT(did) DO UPDATE SET currentProfileID = excluded.currentProfileID`,
    [did, profileID],
  );
};

/**
 * Save the latest observation of one record.
 *
 * The record's first observation is kept, its latest one replaces whatever was
 * there, and seeing it at all clears any deletion state: a record that is
 * back is not a deleted record.
 */
export const saveBlueskyRecord = (
  db: Database.Database,
  observation: BlueskyRecordObservation,
  observedAt: string,
) => {
  const authorProfileID = saveBlueskyProfile(
    db,
    observation.author,
    observedAt,
  );

  exec(
    db,
    `INSERT INTO record (uri, cid, recordType, authorProfileID, indexedAt, createdAt, firstObservedAt, observedAt, sourceDeletedAt, text, facetsJSON, payloadJSON)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(uri) DO UPDATE SET
       cid = excluded.cid,
       recordType = excluded.recordType,
       -- The author a record was captured with is kept, so re-collecting after
       -- a rename does not rewrite history: the identity's current profile
       -- moves on and every record still shows who it was saved with. The one
       -- exception is a record Cyd could not read when it first saw it, whose
       -- author is a bare DID with no labels; reading it later fills that in
       -- rather than leaving a placeholder forever.
       authorProfileID = CASE
         WHEN (SELECT handle FROM profile WHERE id = record.authorProfileID) IS NULL
           THEN excluded.authorProfileID
         ELSE record.authorProfileID
       END,
       indexedAt = excluded.indexedAt,
       createdAt = excluded.createdAt,
       observedAt = excluded.observedAt,
       -- Reading a record again means it is there, so deletion state clears.
       -- A record Cyd still cannot read keeps the first time it was seen gone.
       sourceDeletedAt = CASE
         WHEN excluded.sourceDeletedAt IS NULL THEN NULL
         ELSE COALESCE(record.sourceDeletedAt, excluded.sourceDeletedAt)
       END,
       text = excluded.text,
       facetsJSON = excluded.facetsJSON,
       payloadJSON = excluded.payloadJSON`,
    [
      observation.uri,
      observation.cid,
      observation.recordType,
      authorProfileID,
      observation.indexedAt,
      observation.createdAt,
      observedAt,
      observedAt,
      observation.sourceDeletedAt,
      observation.text,
      observation.facets ? JSON.stringify(observation.facets) : null,
      JSON.stringify(observation.payload),
    ],
  );

  for (const asset of observation.assets) {
    upsertAsset(db, "record", observation.uri, asset);
  }

  saveBlueskyRecordContext(db, observation.uri, observation.context);
};

/**
 * Record the bounded context one record referenced. The context author is
 * whichever profile the referenced record was captured with, so it is looked
 * up rather than stated twice.
 */
export const saveBlueskyRecordContext = (
  db: Database.Database,
  recordURI: string,
  context: BlueskyContextObservation[],
) => {
  for (const entry of context) {
    const contextProfileID = entry.recordURI
      ? ((
          exec(
            db,
            "SELECT authorProfileID FROM record WHERE uri = ?",
            [entry.recordURI],
            "get",
          ) as { authorProfileID: string } | undefined
        )?.authorProfileID ?? null)
      : null;

    exec(
      db,
      `INSERT INTO recordContext (recordURI, kind, contextRecordURI, contextProfileID, externalJSON)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(recordURI, kind) DO UPDATE SET
         contextRecordURI = excluded.contextRecordURI,
         contextProfileID = COALESCE(excluded.contextProfileID, recordContext.contextProfileID),
         externalJSON = excluded.externalJSON`,
      [
        recordURI,
        entry.kind,
        entry.recordURI,
        contextProfileID,
        entry.external ? JSON.stringify(entry.external) : null,
      ],
    );
  }
};

export const saveBlueskySelection = (
  db: Database.Database,
  category: BlueskyCategory,
  subjectID: string,
  selectedAt: string,
) => {
  exec(
    db,
    `INSERT INTO selection (category, subjectID, selectedAt) VALUES (?, ?, ?)
     ON CONFLICT(category, subjectID) DO NOTHING`,
    [category, subjectID, selectedAt],
  );
};

export const saveBlueskyRecordSubject = (
  db: Database.Database,
  relationshipURI: string,
  subjectRecordURI: string,
) => {
  exec(
    db,
    `INSERT INTO recordSubject (relationshipURI, subjectRecordURI) VALUES (?, ?)
     ON CONFLICT(relationshipURI) DO UPDATE SET subjectRecordURI = excluded.subjectRecordURI`,
    [relationshipURI, subjectRecordURI],
  );
};

// Assets as a work queue

/**
 * The assets belonging to a category's saved records that still have no bytes.
 *
 * The queue of media still to fetch is derived from the saved data rather than
 * kept beside it, so it cannot disagree with what is committed: after a
 * restart this returns exactly the work that is left, and after a failure it
 * returns exactly what can be retried.
 */
/**
 * Every record one category pulls with it: the records it selected, the
 * subjects those relationships point at, and the bounded context captured for
 * either. Context is one level deep, which is what keeps a category from
 * dragging in a whole thread.
 *
 * Both the engine's queue of media still to fetch and the completeness a Browse
 * view reports are derived from this one definition, so they cannot disagree
 * about what a category contains.
 */
const CATEGORY_RECORDS_CTE = `
  WITH selected AS (
    SELECT subjectID AS uri FROM selection WHERE category = ?
  ),
  selectedWithSubjects AS (
    SELECT uri FROM selected
    UNION
    SELECT recordSubject.subjectRecordURI FROM recordSubject
    WHERE recordSubject.relationshipURI IN (SELECT uri FROM selected)
  ),
  categoryRecords AS (
    SELECT uri FROM selectedWithSubjects
    UNION
    SELECT recordContext.contextRecordURI FROM recordContext
    WHERE recordContext.contextRecordURI IS NOT NULL
    AND recordContext.recordURI IN (SELECT uri FROM selectedWithSubjects)
  )
`;

/**
 * The assets a category's saved records still have no bytes for.
 *
 * The queue of media left to fetch is derived from the saved data rather than
 * kept beside it, so it cannot disagree with what is committed: after a restart
 * this returns exactly the work that remains, and after a failure it returns
 * exactly what can be retried.
 */
export const pendingBlueskyAssets = (
  db: Database.Database,
  category: BlueskyCategory,
): BlueskyAssetRow[] =>
  exec(
    db,
    `${CATEGORY_RECORDS_CTE}
     SELECT DISTINCT asset.* FROM asset
     JOIN assetOwner ON assetOwner.assetID = asset.id
     WHERE asset.availability != ?
     AND (
       (assetOwner.ownerType = 'record' AND assetOwner.ownerID IN (SELECT uri FROM categoryRecords))
       OR (assetOwner.ownerType = 'profile' AND assetOwner.ownerID IN (
             SELECT authorProfileID FROM record WHERE uri IN (SELECT uri FROM categoryRecords)
             UNION
             -- The account's own profile picture is part of its saved data
             -- whichever category is running, including one where it authored
             -- nothing itself, as bookmarks are.
             SELECT currentProfileID FROM identity))
     )
     ORDER BY asset.id`,
    [category, AVAILABILITY_AVAILABLE],
    "all",
  ) as BlueskyAssetRow[];

/**
 * How many assets one category expects and how many are here, over exactly the
 * records the engine would fetch media for.
 */
export const blueskyCategoryAssetCounts = (
  db: Database.Database,
  category: BlueskyCategory,
): { expected: number; available: number } => {
  const row = exec(
    db,
    `${CATEGORY_RECORDS_CTE}
     SELECT COUNT(DISTINCT asset.id) AS expected,
            COUNT(DISTINCT CASE WHEN asset.availability = ? THEN asset.id END) AS available
     FROM asset
     JOIN assetOwner ON assetOwner.assetID = asset.id
     WHERE (assetOwner.ownerType = 'record' AND assetOwner.ownerID IN (SELECT uri FROM categoryRecords))
     OR (assetOwner.ownerType = 'profile' AND assetOwner.ownerID IN (
           SELECT authorProfileID FROM record WHERE uri IN (SELECT uri FROM categoryRecords)
           UNION
           SELECT currentProfileID FROM identity))`,
    [category, AVAILABILITY_AVAILABLE],
    "get",
  ) as { expected: number; available: number | null };
  return { expected: row.expected, available: row.available ?? 0 };
};

export const markBlueskyAssetAvailable = (
  db: Database.Database,
  id: string,
  stored: { digest: string; byteLength: number; mediaType: string },
) => {
  exec(
    db,
    `UPDATE asset SET availability = ?, unavailableReason = NULL, digest = ?, byteCount = ?, mediaType = ?, attempts = attempts + 1, lastAttemptAt = ? WHERE id = ?`,
    [
      AVAILABILITY_AVAILABLE,
      stored.digest,
      stored.byteLength,
      stored.mediaType,
      new Date().toISOString(),
      id,
    ],
  );
};

/**
 * Record that an asset could not be fetched, and why.
 *
 * A failure is never silent and never permanent: the row keeps its place in
 * the derived queue, so the next run retries it and a success upgrades the
 * backup's completeness.
 */
export const markBlueskyAssetFailed = (
  db: Database.Database,
  id: string,
  availability: "missing" | "unavailable",
  reason: string,
) => {
  exec(
    db,
    `UPDATE asset SET availability = ?, unavailableReason = ?, attempts = attempts + 1, lastAttemptAt = ? WHERE id = ?`,
    [availability, reason, new Date().toISOString(), id],
  );
};

// Checkpoints

const checkpointFromRow = (
  row: BlueskyCheckpointRow,
): BlueskyCollectionCheckpoint => ({
  category: row.category as BlueskyCategory,
  stage: row.stage as BlueskyCollectionStage,
  cursor: row.cursor,
  pagesListed: row.pagesListed,
  recordsSaved: row.recordsSaved,
  mediaSaved: row.mediaSaved,
  mediaFailed: row.mediaFailed,
  updatedAt: new Date(row.updatedAt),
});

export const getBlueskyCheckpoint = (
  db: Database.Database,
  category: BlueskyCategory,
): BlueskyCollectionCheckpoint | null => {
  const row = exec(
    db,
    "SELECT * FROM collectionCheckpoint WHERE category = ?",
    [category],
    "get",
  ) as BlueskyCheckpointRow | undefined;
  return row ? checkpointFromRow(row) : null;
};

/**
 * Write how far a category has got. Callers run this inside the same
 * transaction as the work it describes, so a checkpoint can never claim
 * progress that was not committed.
 */
export const saveBlueskyCheckpoint = (
  db: Database.Database,
  checkpoint: Omit<BlueskyCollectionCheckpoint, "updatedAt">,
) => {
  exec(
    db,
    `INSERT INTO collectionCheckpoint (category, stage, cursor, pagesListed, recordsSaved, mediaSaved, mediaFailed, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(category) DO UPDATE SET
       stage = excluded.stage,
       cursor = excluded.cursor,
       pagesListed = excluded.pagesListed,
       recordsSaved = excluded.recordsSaved,
       mediaSaved = excluded.mediaSaved,
       mediaFailed = excluded.mediaFailed,
       updatedAt = excluded.updatedAt`,
    [
      checkpoint.category,
      checkpoint.stage,
      checkpoint.cursor,
      checkpoint.pagesListed,
      checkpoint.recordsSaved,
      checkpoint.mediaSaved,
      checkpoint.mediaFailed,
      new Date().toISOString(),
    ],
  );
};

// Reading saved data

export const blueskyCategoryRecordCount = (
  db: Database.Database,
  category: BlueskyCategory,
): number =>
  (
    exec(
      db,
      "SELECT COUNT(*) AS count FROM selection WHERE category = ?",
      [category],
      "get",
    ) as { count: number }
  ).count;
