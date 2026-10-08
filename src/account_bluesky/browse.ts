import fs from "fs";

import type Database from "better-sqlite3";

import { exec } from "../database";
import type {
  BlueskyAsset,
  BlueskyAssetAvailability,
  BlueskyBrowsePage,
  BlueskyCategory,
  BlueskySavedAuthor,
  BlueskySavedContext,
  BlueskySavedDataSummary,
  BlueskySavedRecord,
  BlueskySavedRecordSummary,
} from "../shared_types";
import {
  BLUESKY_POST_COLLECTION,
  blueskyPublicCategories,
} from "../shared_types";
import {
  blueskyCategoryAssetCounts,
  blueskyCategoryRecordCount,
} from "./collection/store";
import { blueskyMediaPath } from "./storage";
import type {
  BlueskyAssetRow,
  BlueskyProfileRow,
  BlueskyRecordContextRow,
  BlueskyRecordRow,
} from "./types";

/**
 * Reading Bluesky saved data without Bluesky.
 *
 * Browsing needs no connection and no network: every record, author, embed, and
 * asset comes out of this account's own storage. An asset that was never
 * fetched is reported as unavailable rather than omitted or silently replaced,
 * so what is missing from a backup is visible in the same place the rest of it
 * is read.
 */

export type BlueskyBrowseQuery = {
  category: BlueskyCategory;
  limit?: number;
  /** The cursor from the previous page, to continue with older records. */
  before?: string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAXIMUM_PAGE_SIZE = 100;

/**
 * Where a page continues. Creation time alone is not unique, so the AT URI
 * settles ties and keeps paging stable. A space separates them because neither
 * a timestamp nor an AT URI can contain one.
 */
const CURSOR_SEPARATOR = " ";

const cursorOf = (row: BlueskyRecordRow): string =>
  `${row.createdAt}${CURSOR_SEPARATOR}${row.uri}`;

const parseCursor = (
  cursor: string | null | undefined,
): { createdAt: string; uri: string } | null => {
  if (!cursor) {
    return null;
  }
  const [createdAt, uri] = cursor.split(CURSOR_SEPARATOR);
  return createdAt && uri ? { createdAt, uri } : null;
};

const assetFromRow = (
  mediaPath: string,
  row: BlueskyAssetRow,
): BlueskyAsset => {
  // A row can claim bytes that are no longer on disk, so availability is what
  // the store can actually produce rather than what the row remembers.
  const present =
    row.availability === "available" &&
    row.digest !== null &&
    fs.existsSync(blueskyMediaPath(mediaPath, row.digest));

  return {
    id: row.id,
    kind: row.kind as BlueskyAsset["kind"],
    mediaType: row.mediaType,
    availability: (present
      ? "available"
      : row.availability === "available"
        ? "missing"
        : row.availability) as BlueskyAssetAvailability,
    unavailableReason: present
      ? null
      : (row.unavailableReason ??
        "The saved bytes are no longer in the media store"),
    byteCount: present ? row.byteCount : null,
    digest: present ? row.digest : null,
    width: row.width,
    height: row.height,
    altText: row.altText,
  };
};

const assetsOf = (
  db: Database.Database,
  mediaPath: string,
  ownerType: "record" | "profile",
  ownerID: string,
): BlueskyAsset[] =>
  (
    exec(
      db,
      `SELECT asset.* FROM assetOwner
       JOIN asset ON asset.id = assetOwner.assetID
       WHERE assetOwner.ownerType = ? AND assetOwner.ownerID = ?
       ORDER BY assetOwner.role, assetOwner.position`,
      [ownerType, ownerID],
      "all",
    ) as BlueskyAssetRow[]
  ).map((row) => assetFromRow(mediaPath, row));

const authorOf = (
  db: Database.Database,
  mediaPath: string,
  profileID: string,
): BlueskySavedAuthor | null => {
  const row = exec(
    db,
    "SELECT * FROM profile WHERE id = ?",
    [profileID],
    "get",
  ) as BlueskyProfileRow | undefined;
  if (!row) {
    return null;
  }
  const avatar = assetsOf(db, mediaPath, "profile", row.id).find(
    (asset) => asset.id === row.avatarAssetID,
  );
  return {
    profileID: row.id,
    did: row.did,
    handle: row.handle,
    displayName: row.displayName,
    avatar: avatar ?? null,
  };
};

/** Where a record can be read on Bluesky, when it has a public address. */
const sourceURLOf = (row: BlueskyRecordRow): string | null => {
  if (row.recordType !== BLUESKY_POST_COLLECTION) {
    // A repost, like, or bookmark has no page of its own; the post it is about
    // carries the link.
    return null;
  }
  const match = /^at:\/\/([^/]+)\/[^/]+\/(.+)$/.exec(row.uri);
  return match ? `https://bsky.app/profile/${match[1]}/post/${match[2]}` : null;
};

const summaryOf = (
  db: Database.Database,
  mediaPath: string,
  row: BlueskyRecordRow,
): BlueskySavedRecordSummary => ({
  uri: row.uri,
  recordType: row.recordType,
  author: authorOf(db, mediaPath, row.authorProfileID),
  createdAt: row.createdAt,
  text: row.text,
  sourceDeletedAt: row.sourceDeletedAt,
  assets: assetsOf(db, mediaPath, "record", row.uri),
});

const recordRow = (
  db: Database.Database,
  uri: string,
): BlueskyRecordRow | null =>
  (exec(db, "SELECT * FROM record WHERE uri = ?", [uri], "get") as
    | BlueskyRecordRow
    | undefined) ?? null;

const contextOf = (
  db: Database.Database,
  mediaPath: string,
  uri: string,
): BlueskySavedContext[] =>
  (
    exec(
      db,
      "SELECT * FROM recordContext WHERE recordURI = ? ORDER BY kind",
      [uri],
      "all",
    ) as BlueskyRecordContextRow[]
  ).map((row) => {
    const referenced = row.contextRecordURI
      ? recordRow(db, row.contextRecordURI)
      : null;
    return {
      kind: row.kind as BlueskySavedContext["kind"],
      record: referenced ? summaryOf(db, mediaPath, referenced) : null,
      external: row.externalJSON
        ? (JSON.parse(row.externalJSON) as BlueskySavedContext["external"])
        : null,
    };
  });

const savedRecordOf = (
  db: Database.Database,
  mediaPath: string,
  row: BlueskyRecordRow,
): BlueskySavedRecord => {
  const subjectURI = (
    exec(
      db,
      "SELECT subjectRecordURI FROM recordSubject WHERE relationshipURI = ?",
      [row.uri],
      "get",
    ) as { subjectRecordURI: string } | undefined
  )?.subjectRecordURI;
  const subject = subjectURI ? recordRow(db, subjectURI) : null;

  return {
    ...summaryOf(db, mediaPath, row),
    cid: row.cid,
    indexedAt: row.indexedAt,
    firstObservedAt: row.firstObservedAt,
    observedAt: row.observedAt,
    subject: subject ? summaryOf(db, mediaPath, subject) : null,
    // A relationship's own context is empty; what matters is the context of
    // the record it is about, which travels with the subject.
    context: contextOf(db, mediaPath, subject ? subject.uri : row.uri),
    sourceURL: sourceURLOf(subject ?? row),
  };
};

/**
 * One chronological page of a category, newest first.
 *
 * Records are ordered by when they were created on Bluesky rather than when
 * Cyd happened to save them, so a Browse view reads the way the account
 * happened rather than the way the collection ran.
 */
export const blueskyBrowsePage = (
  db: Database.Database,
  mediaPath: string,
  query: BlueskyBrowseQuery,
): BlueskyBrowsePage => {
  const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE);
  const before = parseCursor(query.before);

  const rows = (
    before
      ? exec(
          db,
          `SELECT record.* FROM selection
           JOIN record ON record.uri = selection.subjectID
           WHERE selection.category = ?
           AND (record.createdAt < ? OR (record.createdAt = ? AND record.uri < ?))
           ORDER BY record.createdAt DESC, record.uri DESC
           LIMIT ?`,
          [
            query.category,
            before.createdAt,
            before.createdAt,
            before.uri,
            limit + 1,
          ],
          "all",
        )
      : exec(
          db,
          `SELECT record.* FROM selection
           JOIN record ON record.uri = selection.subjectID
           WHERE selection.category = ?
           ORDER BY record.createdAt DESC, record.uri DESC
           LIMIT ?`,
          [query.category, limit + 1],
          "all",
        )
  ) as BlueskyRecordRow[];

  // One row past the page is read only to learn whether there is another page.
  const page = rows.slice(0, limit);

  return {
    category: query.category,
    records: page.map((row) => savedRecordOf(db, mediaPath, row)),
    nextCursor:
      rows.length > limit && page.length > 0
        ? cursorOf(page[page.length - 1])
        : null,
    totalRecords: blueskyCategoryRecordCount(db, query.category),
  };
};

/**
 * How much this account has saved, and whether it is a complete backup.
 *
 * Completeness is per asset: a single image that could not be fetched makes the
 * backup incomplete without calling any of the records in it into question.
 */
export const blueskySavedDataSummary = (
  db: Database.Database,
): BlueskySavedDataSummary => {
  const categories = blueskyPublicCategories.map((category) => {
    const assets = blueskyCategoryAssetCounts(db, category);
    return {
      category,
      recordCount: blueskyCategoryRecordCount(db, category),
      assetsExpected: assets.expected,
      assetsAvailable: assets.available,
    };
  });

  const incomplete = exec(
    db,
    "SELECT COUNT(*) AS count FROM asset WHERE availability != 'available'",
    [],
    "get",
  ) as { count: number };

  return { categories, complete: incomplete.count === 0 };
};
