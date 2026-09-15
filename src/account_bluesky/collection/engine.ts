import log from "electron-log/main";

import type Database from "better-sqlite3";

import type {
  BlueskyCategory,
  BlueskyCollectionProgress,
  BlueskyCollectionResult,
} from "../../shared_types";
import { emptyBlueskyCollectionProgress } from "../../shared_types";
import type { BlueskyATClient } from "../at_protocol";
import { BlueskyMediaFetchError } from "../at_protocol";
import { storeBlueskyMediaFileVia } from "../storage";
import type { BlueskyAssetRow } from "../types";
import { blueskyCategoryCollector } from "./categories";
import { blueskyAssetSourceFromAddress } from "./mapping";
import { blueskyRateLimitResumeAt } from "./rate_limit";
import {
  getBlueskyCheckpoint,
  markBlueskyAssetAvailable,
  markBlueskyAssetFailed,
  pendingBlueskyAssets,
  saveBlueskyCheckpoint,
  saveBlueskyProfile,
  saveBlueskyRecord,
  saveBlueskyRecordSubject,
  saveBlueskySelection,
  setBlueskyCurrentProfile,
} from "./store";

/**
 * The Bluesky collection engine.
 *
 * Saving a whole account is long work that gets interrupted: the app quits,
 * the network goes, Bluesky rate limits, the disk fills, the person changes
 * their mind. So durability is the shape of the loop rather than something
 * layered on top of it:
 *
 * - every page is committed together with the checkpoint that describes it, so
 *   a checkpoint can never claim more than is saved;
 * - every identifier is derived from what it names, so committing the same
 *   page twice leaves the same data and resuming never duplicates;
 * - media still to fetch is derived from the saved data rather than queued
 *   beside it, so a restart finds exactly the work that is left and a failed
 *   asset stays explicit and retryable;
 * - a rate limit is a wait with a time on it, not a failure;
 * - stopping — by cancellation or a full disk — keeps everything committed so
 *   far and leaves only staging behind.
 *
 * What varies per category is only its API surface and mapping, in
 * `categories.ts`. The engine never knows which category it is running.
 */

/** How a caller asks a running collection to stop. */
export type BlueskyCollectionSignal = { cancelled: boolean };

export type BlueskyCollectionOptions = {
  client: BlueskyATClient;
  signal?: BlueskyCollectionSignal;
  onProgress?: (progress: BlueskyCollectionProgress) => void;
  /** Records per listing page. */
  pageLimit?: number;
  /** Overridable so tests can wait out a rate limit without really waiting. */
  wait?: (milliseconds: number) => Promise<void>;
};

/** Where one account keeps the data a collection run writes. */
export type BlueskyCollectionContext = {
  db: Database.Database;
  mediaPath: string;
  /** Disposable scratch space; media lands here before the media store. */
  stagingDirectory: string;
};

const DEFAULT_PAGE_LIMIT = 50;

/**
 * How many rate limits one call will wait out before the run gives up. Rate
 * limits recur legitimately, so this is high; it exists only so a server that
 * answers nothing but 429 cannot hold a job open forever.
 */
const MAXIMUM_RATE_LIMIT_WAITS = 8;

/** Thrown when the caller asked the run to stop. */
class BlueskyCollectionCancelled extends Error {
  constructor() {
    super("The Bluesky collection run was cancelled");
    this.name = "BlueskyCollectionCancelled";
  }
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(milliseconds, 0)));

const isOutOfSpace = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException | null)?.code === "ENOSPC";

const errorClassOf = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error;

/**
 * Save every public record in one category, then every asset those records
 * expect, resuming whatever an earlier run left unfinished.
 */
export const runBlueskyCollection = async (
  context: BlueskyCollectionContext,
  category: BlueskyCategory,
  options: BlueskyCollectionOptions,
): Promise<BlueskyCollectionResult> => {
  const { db } = context;
  const collector = blueskyCategoryCollector(category);
  const pageLimit = options.pageLimit ?? DEFAULT_PAGE_LIMIT;
  const wait = options.wait ?? sleep;

  const progress = emptyBlueskyCollectionProgress(category);

  const report = () => {
    progress.mediaPending = pendingBlueskyAssets(db, category).length;
    options.onProgress?.({ ...progress });
  };

  const stopIfCancelled = () => {
    if (options.signal?.cancelled) {
      throw new BlueskyCollectionCancelled();
    }
  };

  const checkpoint = () =>
    saveBlueskyCheckpoint(db, {
      category,
      stage: progress.stage,
      cursor: cursor,
      pagesListed: progress.pagesListed,
      recordsSaved: progress.recordsSaved,
      mediaSaved: progress.mediaSaved,
      mediaFailed: progress.mediaFailed,
    });

  // A category that finished before starts a fresh pass, so records published
  // since then are picked up. One that was interrupted resumes exactly where
  // it stopped, including part-way through fetching media.
  const saved = getBlueskyCheckpoint(db, category);
  let cursor: string | null = null;
  if (saved && saved.stage !== "done") {
    progress.stage = saved.stage;
    progress.pagesListed = saved.pagesListed;
    progress.recordsSaved = saved.recordsSaved;
    progress.mediaSaved = saved.mediaSaved;
    progress.mediaFailed = saved.mediaFailed;
    cursor = saved.cursor;
  }

  /**
   * Run one call, waiting out any rate limit it hits. The wait is visible in
   * progress with the time it ends, which is what keeps a rate-limited job
   * from looking like a hung one.
   */
  const withRateLimitRetry = async <T>(call: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt += 1) {
      stopIfCancelled();
      try {
        return await call();
      } catch (error) {
        const resumeAt = blueskyRateLimitResumeAt(
          error,
          progress.rateLimitOccurrences + 1,
          new Date(),
        );
        if (!resumeAt || attempt >= MAXIMUM_RATE_LIMIT_WAITS) {
          throw error;
        }
        progress.rateLimitOccurrences += 1;
        progress.rateLimitedUntil = resumeAt.toISOString();
        log.info(
          `Bluesky: rate limited collecting ${category}, resuming at ${resumeAt.toISOString()}`,
        );
        report();
        await wait(resumeAt.getTime() - Date.now());
        progress.rateLimitedUntil = null;
        report();
      }
    }
  };

  try {
    // The account's own profile is the author of its own records, and is
    // captured rather than updated in place: refreshing it adds the labels it
    // has now and leaves every author a saved record was captured with alone.
    const profile = await withRateLimitRetry(() => options.client.getProfile());
    const author = {
      did: profile.did,
      handle: profile.handle ?? null,
      displayName: profile.displayName ?? null,
      description: profile.description ?? null,
      avatarSourceURL: profile.avatar ?? null,
      bannerSourceURL: profile.banner ?? null,
    };
    db.transaction(() => {
      const profileID = saveBlueskyProfile(
        db,
        author,
        new Date().toISOString(),
      );
      setBlueskyCurrentProfile(db, profile.did, profileID);
    })();

    if (progress.stage === "listing") {
      for (;;) {
        stopIfCancelled();

        const page = await withRateLimitRetry(() =>
          collector.listPage({
            client: options.client,
            author,
            cursor,
            limit: pageLimit,
          }),
        );

        // The page and the checkpoint that describes it are committed as one
        // unit, so an interruption either loses the whole page — which the
        // next run lists again, harmlessly — or keeps it with a cursor that
        // matches.
        db.transaction(() => {
          const observedAt = new Date().toISOString();
          for (const observation of page.records) {
            saveBlueskyRecord(db, observation, observedAt);
          }
          for (const subject of page.subjects) {
            saveBlueskyRecordSubject(
              db,
              subject.relationshipURI,
              subject.subjectRecordURI,
            );
          }
          for (const selection of page.selections) {
            saveBlueskySelection(
              db,
              category,
              selection.subjectID,
              selection.selectedAt ?? observedAt,
            );
          }

          cursor = page.cursor;
          progress.pagesListed += 1;
          progress.recordsSaved += page.selections.length;
          progress.stage = page.cursor ? "listing" : "media";
          checkpoint();
        })();
        report();

        if (!page.cursor) {
          break;
        }
      }
    }

    // Everything this category's records expect and does not have yet,
    // including assets an earlier run failed on. Taken once, so an asset that
    // fails again is left for the next run instead of retried in a loop.
    const pending = pendingBlueskyAssets(db, category);
    for (const asset of pending) {
      stopIfCancelled();
      await fetchAsset(context, options, withRateLimitRetry, asset, progress);
      db.transaction(checkpoint)();
      report();
    }

    progress.stage = "done";
    db.transaction(checkpoint)();
    report();

    return { outcome: "finished", progress: { ...progress }, errorClass: null };
  } catch (error) {
    // Whatever stopped the run, everything committed so far stays committed and
    // the checkpoint says where to pick up. A full disk can defeat even this
    // one-row write, and losing the checkpoint only costs the next run a repeat
    // of the current page — so it must not turn a reported outcome into a
    // thrown one.
    try {
      db.transaction(checkpoint)();
    } catch (checkpointError) {
      log.error(
        `Bluesky: a collection run could not record where it stopped (${errorClassOf(checkpointError)})`,
      );
    }

    if (error instanceof BlueskyCollectionCancelled) {
      progress.cancelled = true;
      report();
      return {
        outcome: "cancelled",
        progress: { ...progress },
        errorClass: null,
      };
    }

    if (isOutOfSpace(error)) {
      log.error("Bluesky: a collection run ran out of disk space");
      report();
      return {
        outcome: "outOfSpace",
        progress: { ...progress },
        errorClass: "ENOSPC",
      };
    }

    // Only the class of the error is kept: a message can quote a handle, a
    // DID, record text, or a local path.
    // See docs/adr/0029-minimize-bluesky-diagnostics.md.
    log.error(`Bluesky: a collection run failed with ${errorClassOf(error)}`);
    report();
    return {
      outcome: "failed",
      progress: { ...progress },
      errorClass: errorClassOf(error),
    };
  }
};

/**
 * Fetch one asset and store it content-addressably.
 *
 * A failure is recorded on the asset rather than thrown: one unreachable image
 * must not abandon the rest of the run, and the row keeps its place in the
 * derived queue so the next run retries it and success upgrades the backup's
 * completeness. A full disk is different — it stops everything — so it is the
 * one failure that propagates.
 */
const fetchAsset = async (
  context: BlueskyCollectionContext,
  options: BlueskyCollectionOptions,
  withRateLimitRetry: <T>(call: () => Promise<T>) => Promise<T>,
  asset: BlueskyAssetRow,
  progress: BlueskyCollectionProgress,
): Promise<void> => {
  const source = blueskyAssetSourceFromAddress(asset.sourceURL ?? "");
  if (!source) {
    markBlueskyAssetFailed(
      context.db,
      asset.id,
      "unavailable",
      "Bluesky published no address for this asset",
    );
    progress.mediaFailed += 1;
    return;
  }

  try {
    const fetched = await withRateLimitRetry(() =>
      source.type === "url"
        ? options.client.fetchMedia(source.url)
        : options.client.fetchBlob(source.did, source.cid),
    );

    const stored = storeBlueskyMediaFileVia(
      context.mediaPath,
      context.stagingDirectory,
      fetched.bytes,
    );

    context.db.transaction(() => {
      markBlueskyAssetAvailable(context.db, asset.id, {
        digest: stored.digest,
        byteLength: stored.byteLength,
        mediaType: fetched.mediaType,
      });
      // The media table is what makes the account's store self-describing, so
      // it learns about the asset in the same transaction that claims it.
      registerMedia(
        context.db,
        stored.digest,
        stored.byteLength,
        fetched.mediaType,
      );
    })();

    progress.mediaSaved += 1;
  } catch (error) {
    if (error instanceof BlueskyCollectionCancelled || isOutOfSpace(error)) {
      throw error;
    }

    // A source that says the asset is gone is a different fact from one Cyd
    // could not reach, and both stay retryable.
    const gone =
      error instanceof BlueskyMediaFetchError &&
      [400, 404, 410].includes(error.status);
    markBlueskyAssetFailed(
      context.db,
      asset.id,
      gone ? "unavailable" : "missing",
      gone
        ? "Bluesky no longer has this asset"
        : `Fetching this asset failed with ${errorClassOf(error)}`,
    );
    progress.mediaFailed += 1;
  }
};

const registerMedia = (
  db: Database.Database,
  digest: string,
  byteLength: number,
  mediaType: string,
) => {
  db.prepare(
    `INSERT INTO media (digest, byteLength, mediaType, createdAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(digest) DO NOTHING`,
  ).run(digest, byteLength, mediaType, new Date().toISOString());
};
