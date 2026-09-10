import fs from "fs";

import log from "electron-log/main";
import Database from "better-sqlite3";

import {
  exec,
  runMigrations,
  getAccount,
  getBlueskyAccountByDID,
  saveBlueskyAccount,
  deleteAccount,
  getConfig,
  setConfig,
} from "../database";
import type {
  BlueskyAccount,
  BlueskyDeleteConfirmation,
  BlueskyJob,
  BlueskyLocalAccountPaths,
  BlueskySavedMedia,
  BlueskyStoredMedia,
} from "../shared_types";
import {
  blueskyMediaPath,
  clearBlueskyStagingAreas,
  createBlueskyStagingArea,
  ensureBlueskyAccountStorage,
  ensureOwnerOnlyDatabase,
  storeBlueskyMediaFile,
} from "./storage";
import { migrations } from "./controller/migrations";
import type { BlueskyJobRow, BlueskyMediaRow } from "./types";

/**
 * Owns one Bluesky local account's isolated local resources: its private
 * runtime database, content-addressed media store, job state, and staging
 * area. Everything it touches lives under one UUID-keyed directory, so two
 * local accounts can never read or delete each other's data.
 *
 * Bluesky uses direct AT Protocol APIs, so this controller has no MITM
 * interception or webview scraping.
 */
export class BlueskyAccountController {
  public accountID: number;
  public accountUUID: string = "";
  public account: BlueskyAccount | null = null;
  public db: Database.Database | null = null;

  private paths: BlueskyLocalAccountPaths | null = null;

  constructor(accountID: number) {
    this.accountID = accountID;
    this.refreshAccount();
  }

  /** Reload this account's identity and mutable profile data. */
  refreshAccount() {
    const account = getAccount(this.accountID);
    if (!account) {
      log.error(
        `BlueskyAccountController.refreshAccount: account ${this.accountID} not found`,
      );
      return;
    }
    if (account.type !== "Bluesky") {
      log.error(
        `BlueskyAccountController.refreshAccount: account ${this.accountID} is not a Bluesky account`,
      );
      return;
    }

    this.accountUUID = account.uuid;
    this.account = account.blueskyAccount;
  }

  /**
   * The account's local resources, created owner-only if they do not exist
   * yet. Opening an existing account reuses whatever is already there.
   */
  getPaths(): BlueskyLocalAccountPaths {
    if (!this.accountUUID) {
      throw new Error(
        `Bluesky local account ${this.accountID} has no Cyd UUID yet`,
      );
    }
    if (!this.paths) {
      this.paths = ensureBlueskyAccountStorage(this.accountUUID);
    }
    return this.paths;
  }

  /** Open (creating if needed) this account's private runtime database. */
  initDB() {
    if (this.db) {
      return;
    }
    const paths = this.getPaths();
    this.db = new Database(paths.databasePath, {});
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db, migrations);
    // The write-ahead log holds saved data too, so it is created by now and
    // must be locked down alongside the database file.
    ensureOwnerOnlyDatabase(paths.databasePath);
  }

  private requireDB(): Database.Database {
    if (!this.db) {
      this.initDB();
    }
    if (!this.db) {
      throw new Error(
        `Failed to open the runtime database for Bluesky local account ${this.accountID}`,
      );
    }
    return this.db;
  }

  /** Close the runtime database, leaving all saved data on disk. */
  cleanup() {
    if (this.db) {
      this.db.pragma("wal_checkpoint(FULL)");
      this.db.close();
      this.db = null;
    }
  }

  // Identity and profile

  /**
   * Bind this local account to a Bluesky identity. A DID belongs to exactly
   * one local account, so a second local account cannot claim it.
   */
  setDID(did: string) {
    if (!this.account) {
      throw new Error(`Bluesky local account ${this.accountID} not found`);
    }
    const existing = getBlueskyAccountByDID(did);
    if (existing && existing.id !== this.account.id) {
      // Diagnostics must not carry DIDs, so the message names neither
      // identity nor account.
      throw new Error(
        "That Bluesky identity already belongs to another Bluesky local account",
      );
    }
    this.account.did = did;
    saveBlueskyAccount(this.account);
    this.refreshAccount();
  }

  /**
   * Update mutable profile data. A handle change never moves storage, because
   * storage is keyed by the Cyd UUID.
   */
  updateProfile(profile: {
    handle?: string | null;
    displayName?: string | null;
    profileImageDataURI?: string | null;
  }) {
    if (!this.account) {
      throw new Error(`Bluesky local account ${this.accountID} not found`);
    }
    if (profile.handle !== undefined) {
      this.account.handle = profile.handle;
    }
    if (profile.displayName !== undefined) {
      this.account.displayName = profile.displayName;
    }
    if (profile.profileImageDataURI !== undefined) {
      this.account.profileImageDataURI = profile.profileImageDataURI;
    }
    saveBlueskyAccount(this.account);
    this.refreshAccount();
  }

  // Media store

  /**
   * Store one media asset for this account. Identical bytes are stored once,
   * within this account only.
   */
  saveMedia(data: Buffer, mediaType: string): BlueskySavedMedia {
    const db = this.requireDB();
    const stored = storeBlueskyMediaFile(this.getPaths().mediaPath, data);

    const row: BlueskyMediaRow | undefined = exec(
      db,
      "SELECT * FROM media WHERE digest = ?",
      [stored.digest],
      "get",
    ) as BlueskyMediaRow | undefined;

    if (!row) {
      exec(
        db,
        "INSERT INTO media (digest, byteLength, mediaType, createdAt) VALUES (?, ?, ?, ?)",
        [stored.digest, stored.byteLength, mediaType, new Date().toISOString()],
      );
    }

    return {
      digest: stored.digest,
      byteLength: stored.byteLength,
      mediaType: row ? row.mediaType : mediaType,
      path: stored.path,
      deduplicated: stored.deduplicated,
    };
  }

  /** The stored asset with this digest, or null when this account has none. */
  getMedia(digest: string): BlueskyStoredMedia | null {
    const db = this.requireDB();
    const row: BlueskyMediaRow | undefined = exec(
      db,
      "SELECT * FROM media WHERE digest = ?",
      [digest],
      "get",
    ) as BlueskyMediaRow | undefined;
    if (!row) {
      return null;
    }
    const assetPath = blueskyMediaPath(this.getPaths().mediaPath, row.digest);
    if (!fs.existsSync(assetPath)) {
      return null;
    }
    return {
      digest: row.digest,
      byteLength: row.byteLength,
      mediaType: row.mediaType,
      path: assetPath,
    };
  }

  // Jobs

  private blueskyJobFromRow(row: BlueskyJobRow): BlueskyJob {
    return {
      id: row.id,
      jobType: row.jobType,
      status: row.status,
      scheduledAt: new Date(row.scheduledAt),
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
      progressJSON: row.progressJSON || "",
      error: row.error,
    };
  }

  createJobs(jobTypes: string[]): BlueskyJob[] {
    const db = this.requireDB();
    for (const jobType of jobTypes) {
      exec(
        db,
        "INSERT INTO job (jobType, status, scheduledAt) VALUES (?, ?, ?)",
        [jobType, "pending", new Date().toISOString()],
      );
    }
    return this.getJobs("pending");
  }

  getJobs(status?: string): BlueskyJob[] {
    const db = this.requireDB();
    const rows: BlueskyJobRow[] = (
      status
        ? exec(
            db,
            "SELECT * FROM job WHERE status = ? ORDER BY id",
            [status],
            "all",
          )
        : exec(db, "SELECT * FROM job ORDER BY id", [], "all")
    ) as BlueskyJobRow[];
    return rows.map((row) => this.blueskyJobFromRow(row));
  }

  updateJob(job: BlueskyJob) {
    exec(
      this.requireDB(),
      "UPDATE job SET status = ?, startedAt = ?, finishedAt = ?, progressJSON = ?, error = ? WHERE id = ?",
      [
        job.status,
        job.startedAt ? job.startedAt : null,
        job.finishedAt ? job.finishedAt : null,
        job.progressJSON,
        job.error,
        job.id,
      ],
    );
  }

  // Staging

  /** An isolated scratch directory for one piece of in-progress work. */
  createStagingArea(label: string): string {
    return createBlueskyStagingArea(this.getPaths().stagingPath, label);
  }

  /** Discard every staged directory, reclaiming disk without touching saved data. */
  clearStagingAreas() {
    clearBlueskyStagingAreas(this.getPaths().stagingPath);
  }

  // Config

  getConfig(key: string): string | null {
    return getConfig(key, this.requireDB());
  }

  setConfig(key: string, value: string) {
    setConfig(key, value, this.requireDB());
  }

  // Deletion

  /**
   * Permanently delete this Bluesky local account: its connection material,
   * runtime database, media, jobs, and staged work. Deletion is irreversible,
   * so the caller must confirm by naming the account UUID it means to destroy.
   * No other account's resources are touched.
   */
  deleteLocalAccount(confirmation: BlueskyDeleteConfirmation) {
    if (!this.accountUUID) {
      throw new Error(
        `Bluesky local account ${this.accountID} has no Cyd UUID yet`,
      );
    }
    if (confirmation?.confirmedAccountUUID !== this.accountUUID) {
      throw new Error(
        "Deleting a Bluesky local account requires confirming its account UUID",
      );
    }

    // Closing the database first releases the files that deleting the account
    // is about to remove.
    this.cleanup();
    deleteAccount(this.accountID);

    this.paths = null;
    this.account = null;
    this.accountUUID = "";
  }
}
