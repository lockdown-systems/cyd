import fs from "fs";

import log from "electron-log/main";
import Database from "better-sqlite3";

import {
  exec,
  runMigrations,
  getAccount,
  getBlueskyLocalAccountByDID,
  saveBlueskyLocalAccount,
  setBlueskyLocalAccountConnected,
  deleteAccount,
  getConfig,
  setConfig,
} from "../database";
import {
  authorizeBlueskyIdentity,
  completeBlueskyAuthorization,
  getBlueskyProfile,
  releaseBlueskyHold,
  type BlueskyConnectStart,
} from "../bluesky_oauth";
import { getImageDataURI } from "../shared/utils/image-utils";
import type {
  BlueskyLocalAccount,
  BlueskyBrowsePage,
  BlueskyCategory,
  BlueskyCategorySettings,
  BlueskyCollectionProgress,
  BlueskyCollectionResult,
  BlueskyDeleteConfirmation,
  BlueskyJob,
  BlueskyLocalAccountPaths,
  BlueskySavedDataSummary,
  BlueskySavedMedia,
  BlueskyStoragePreflight,
  BlueskyStoredMedia,
} from "../shared_types";
import { blueskyPublicCategories } from "../shared_types";
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
import type { BlueskyATClient } from "./at_protocol";
import { createBlueskyATClient } from "./at_protocol";
import {
  runBlueskyCollection,
  type BlueskyCollectionSignal,
} from "./collection/engine";
import { blueskyStoragePreflight } from "./collection/preflight";
import { blueskyBrowsePage, blueskySavedDataSummary } from "./browse";
import type { BlueskyBrowseQuery } from "./browse";

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
  public account: BlueskyLocalAccount | null = null;
  public db: Database.Database | null = null;

  /** The progress of the collection run in flight, if there is one. */
  public collectionProgress: BlueskyCollectionProgress | null = null;

  private paths: BlueskyLocalAccountPaths | null = null;
  private collectionSignal: BlueskyCollectionSignal | null = null;

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
    this.account = account.blueskyLocalAccount;
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
    const existing = getBlueskyLocalAccountByDID(did);
    if (existing && existing.uuid !== this.account.uuid) {
      // Diagnostics must not carry DIDs, so the message names neither
      // identity nor account.
      throw new Error(
        "That Bluesky identity already belongs to another Bluesky local account",
      );
    }
    this.account.did = did;
    saveBlueskyLocalAccount(this.account);
    this.refreshAccount();
  }

  /** Whether this installation is currently authorized to act on the identity. */
  get isConnected(): boolean {
    return Boolean(this.account?.connectedAt);
  }

  /**
   * Start a browser authorization for a handle.
   *
   * This goes through the one Bluesky OAuth implementation in Cyd, so an
   * identity the X migration already authorized needs no second sign-in: the
   * shared session is found by DID and reused. Authorization is OAuth and
   * every call afterwards is a direct AT Protocol call — never an app
   * password, never scraping, never interception.
   */
  async connect(handle: string): Promise<BlueskyConnectStart> {
    const start = await authorizeBlueskyIdentity(handle, {
      platform: "Bluesky",
      accountID: this.accountID,
    });
    if (start.status === "reused") {
      try {
        await this.bindIdentity(start.did);
      } catch (error) {
        return {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    return start;
  }

  /**
   * Finish an authorization this account started: bind the authenticated DID
   * and refresh the identity's current profile.
   */
  async completeConnection(queryString: string): Promise<true | string> {
    const authorization = await completeBlueskyAuthorization(queryString);
    if (!authorization.ok) {
      return authorization.error;
    }
    try {
      await this.bindIdentity(authorization.did);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return true;
  }

  /**
   * Bind the identity and take its current profile. Binding is what makes this
   * account a holder of the shared session, so it happens only once the
   * session is known to exist.
   */
  private async bindIdentity(did: string): Promise<void> {
    this.setDID(did);
    setBlueskyLocalAccountConnected(this.accountUUID, true);
    this.refreshAccount();
    await this.refreshProfile();
  }

  /**
   * Take the identity's current profile from its PDS. A handle change lands
   * here and changes nothing about where this account's data lives.
   */
  async refreshProfile(): Promise<void> {
    const did = this.account?.did;
    if (!did) {
      return;
    }
    const profile = await getBlueskyProfile(did);
    if (!profile) {
      return;
    }
    this.updateProfile({
      handle: profile.handle,
      displayName: profile.displayName ?? null,
      profileImageDataURI: profile.avatar
        ? await getImageDataURI(profile.avatar)
        : null,
    });
  }

  /**
   * Remove this installation's authorization to act on the identity, keeping
   * the local account and every byte of Bluesky saved data.
   *
   * Only this account's hold is released. An X account whose migration is
   * connected to the same identity stays connected and is never asked to
   * re-authorize; the session is revoked at the PDS only once nobody is left
   * holding it. Recording the disconnection first is what makes the release
   * honest: by then this account is no longer among the holders.
   */
  async disconnect(): Promise<void> {
    const did = this.account?.did ?? null;
    if (!this.accountUUID) {
      return;
    }
    setBlueskyLocalAccountConnected(this.accountUUID, false);
    this.refreshAccount();

    if (did) {
      await releaseBlueskyHold(did);
    }
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
    saveBlueskyLocalAccount(this.account);
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

  /**
   * Return jobs that were running when Cyd stopped to the pending queue.
   *
   * A job only ever says "running" while this process is running it, so one
   * found in that state on open was interrupted — by a quit, a crash, or a
   * power cut. The engine's checkpoint means running it again continues from
   * where it stopped rather than starting the category over, so the honest
   * thing is to offer it back rather than leave a row nobody will ever finish.
   */
  resumeInterruptedJobs(): BlueskyJob[] {
    exec(
      this.requireDB(),
      "UPDATE job SET status = 'pending', startedAt = NULL WHERE status = 'running'",
    );
    return this.getJobs("pending");
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

  // Categories

  /**
   * Which categories this account saves.
   *
   * Every category is off until it is chosen, and turning one off only stops
   * future collection: Bluesky saved data is never deleted by a setting.
   */
  getCategorySettings(): BlueskyCategorySettings {
    const settings = {} as BlueskyCategorySettings;
    for (const category of blueskyPublicCategories) {
      settings[category] =
        this.getConfig(categorySettingKey(category)) === "true";
    }
    return settings;
  }

  setCategoryEnabled(category: BlueskyCategory, enabled: boolean) {
    this.setConfig(categorySettingKey(category), enabled ? "true" : "false");
  }

  // Collection

  /**
   * An AT Protocol client for this account's identity, made from the shared
   * Bluesky OAuth session. Collection calls the AT Protocol directly: there is
   * nothing to scrape and no app password anywhere.
   */
  async getATClient(): Promise<BlueskyATClient> {
    const did = this.account?.did;
    if (!did || !this.isConnected) {
      throw new Error(
        "Saving Bluesky data needs a connected Bluesky local account",
      );
    }
    return createBlueskyATClient(did);
  }

  /** What a run over these categories is expected to need on disk. */
  async storagePreflight(
    client: BlueskyATClient,
    categories: BlueskyCategory[],
  ): Promise<BlueskyStoragePreflight> {
    return blueskyStoragePreflight(
      this.requireDB(),
      this.getPaths().accountPath,
      client,
      categories,
    );
  }

  /**
   * Save one category, resuming whatever an earlier run left unfinished.
   *
   * The run is durable and incremental, so stopping it — by cancelling, by
   * quitting Cyd, or by filling the disk — keeps everything saved so far and
   * the next run continues from there.
   */
  async collect(
    category: BlueskyCategory,
    options: {
      client: BlueskyATClient;
      onProgress?: (progress: BlueskyCollectionProgress) => void;
      pageLimit?: number;
      wait?: (milliseconds: number) => Promise<void>;
    },
  ): Promise<BlueskyCollectionResult> {
    const db = this.requireDB();
    const paths = this.getPaths();

    this.collectionSignal = { cancelled: false };
    this.collectionProgress = null;

    try {
      return await runBlueskyCollection(
        {
          db,
          mediaPath: paths.mediaPath,
          // Media lands in a staging area before it is committed to the media
          // store, so an interrupted fetch leaves only disposable data.
          stagingDirectory: this.createStagingArea(`collect-${category}`),
        },
        category,
        {
          client: options.client,
          signal: this.collectionSignal,
          pageLimit: options.pageLimit,
          wait: options.wait,
          onProgress: (progress) => {
            this.collectionProgress = progress;
            options.onProgress?.(progress);
          },
        },
      );
    } finally {
      this.collectionSignal = null;
    }
  }

  /**
   * Ask a running collection to stop at the next safe point. Everything
   * committed stays committed.
   */
  cancelCollection() {
    if (this.collectionSignal) {
      this.collectionSignal.cancelled = true;
    }
  }

  // Browse

  /** One chronological page of a category, readable with no connection. */
  browse(query: BlueskyBrowseQuery): BlueskyBrowsePage {
    return blueskyBrowsePage(
      this.requireDB(),
      this.getPaths().mediaPath,
      query,
    );
  }

  /** What this account has saved, and whether the backup is complete. */
  savedDataSummary(): BlueskySavedDataSummary {
    return blueskySavedDataSummary(this.requireDB());
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
    deleteAccount(this.accountID, confirmation.confirmedAccountUUID);

    this.paths = null;
    this.account = null;
    this.accountUUID = "";
  }
}

/**
 * Category settings are per account, so they live in the account's own
 * database rather than in a shared setting.
 */
const categorySettingKey = (category: BlueskyCategory): string =>
  `saveCategory.${category}`;
