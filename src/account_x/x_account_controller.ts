import path from "path";

import { session } from "electron";
import type { OnSendHeadersListenerDetails } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";

import { Agent } from "@atproto/api";
import { Record as BskyPostRecord } from "@atproto/api/dist/client/types/app/bsky/feed/post";

import { getAccountDataPath } from "../util";
import {
  XAccount,
  XJob,
  XProgress,
  emptyXProgress,
  XTweetItem,
  XArchiveStartResponse,
  XRateLimitInfo,
  emptyXRateLimitInfo,
  XIndexMessagesStartResponse,
  XDeleteTweetsStartResponse,
  XProgressInfo,
  ResponseData,
  XDatabaseStats,
  XDeleteReviewStats,
  XImportArchiveResponse,
  XMigrateTweetCounts,
  BlueskyMigrationProfile,
} from "../shared_types";
import {
  runMigrations,
  getAccount,
  deleteConfig as globalDeleteConfig,
  deleteConfigLike as globalDeleteConfigLike,
} from "../database";
import { IMITMController } from "../mitm";
import { BaseAccountController } from "../shared/controllers/BaseAccountController";
import {
  XJobRow,
  // X API types
  XAPILegacyTweet,
  XAPILegacyTweetMedia,
  XAPIUserCore,
  XAPIConversation,
  XAPIMessage,
  XAPIUser,
  XArchiveTweet,
} from "./types";

// for building the static archive site
import * as Index from "./controller/index";
import * as Deletion from "./controller/deletion";
import * as Archive from "./controller/archive";
import * as XArchive from "./controller/x_archive";
import * as Stats from "./controller/stats";
import * as Jobs from "./controller/jobs";
import * as Account from "./controller/account";
import { fetchTweetsWithMediaAndURLsFromDB } from "./controller/fetchTweetsWithMediaAndURLs";
import { migrations } from "./controller/migrations";
import { BlueskyService } from "./controller/bluesky/BlueskyService";

export class XAccountController extends BaseAccountController<XProgress> {
  // Making this public so it can be accessed in tests
  public account: XAccount | null = null;
  private rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();

  // Temp variable for accurately counting message progress
  public messageIDsIndexed: string[] = [];

  protected cookies: Record<string, Record<string, string>> = {};

  private blueskyService: BlueskyService | null = null;

  constructor(accountID: number, mitmController: IMITMController) {
    super(accountID, mitmController);
    // Initialize progress with X-specific type
    this.progress = emptyXProgress();

    // Monitor web request metadata for X-specific functionality
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    ses.webRequest.onCompleted((details) => {
      // Monitor for rate limits
      if (details.statusCode == 429) {
        this.rateLimitInfo.isRateLimited = true;
        if (details.responseHeaders) {
          this.rateLimitInfo.rateLimitReset = Number(
            details.responseHeaders["x-rate-limit-reset"],
          );
        } else {
          // If we can't get it from the headers, set it to 15 minutes from now
          this.rateLimitInfo.rateLimitReset =
            Math.floor(Date.now() / 1000) + 900;
        }
      }

      // Monitor for deleting conversations
      if (
        details.url.startsWith("https://x.com/i/api/1.1/dm/conversation/") &&
        details.url.endsWith("/delete.json") &&
        details.method == "POST" &&
        details.statusCode == 204
      ) {
        const urlParts = details.url.split("/");
        const conversationID = urlParts[urlParts.length - 2];
        Deletion.deleteDMsMarkDeleted(this, conversationID);
      }
    });
  }

  protected getAccountType(): string {
    return "X";
  }

  protected getAccountProperty(): unknown {
    const account = getAccount(this.accountID);
    return account?.xAccount;
  }

  protected getAccountDataPath(): string {
    if (!this.account) {
      return "";
    }
    // Return the directory path (not the file path) since accountDataPath is also used for media directories
    return getAccountDataPath("X", this.account.username);
  }

  protected handleCookieTracking(details: OnSendHeadersListenerDetails): void {
    // Keep track of cookies
    if (details.requestHeaders) {
      const hostname = new URL(details.url).hostname;
      const cookieHeader = details.requestHeaders["Cookie"];
      if (cookieHeader) {
        const cookies = cookieHeader.split(";");
        cookies.forEach((cookie: string) => {
          const parts = cookie.split("=");
          if (parts.length == 2) {
            if (!this.cookies[hostname]) {
              this.cookies[hostname] = {};
            }
            this.cookies[hostname][parts[0].trim()] = parts[1].trim();
          }
        });
      }
    }
  }

  refreshAccount() {
    super.refreshAccount();
    // Load the X account after base refresh
    const account = getAccount(this.accountID);
    this.account = account?.xAccount || null;
  }

  initDB() {
    // Ensure account is loaded before initializing database
    if (!this.account) {
      this.refreshAccount();
    }

    if (!this.account) {
      log.error("XAccountController.initDB: account does not exist");
      return;
    }

    log.info("XAccountController.initDB: account", this.account);

    // Set the account data path (directory, not file)
    this.accountDataPath = this.getAccountDataPath();
    if (!this.accountDataPath) {
      log.error("XAccountController.initDB: accountDataPath is empty");
      return;
    }

    log.info(
      `XAccountController.initDB: accountDataPath=${this.accountDataPath}`,
    );

    // Build the database file path
    const dbPath = path.join(this.accountDataPath, "data.sqlite3");

    // Initialize the database using the file path
    log.info(`XAccountController.initDB: dbPath=${dbPath}`);
    this.db = new Database(dbPath, {});
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db, migrations);
    log.info("XAccountController.initDB: database initialized");
  }

  // Helper function to fetch tweets with media and URLs
  public fetchTweetsWithMediaAndURLs(
    whereClause: string,
    params: (string | number)[],
  ): XTweetItem[] {
    if (!this.db) {
      this.initDB();
    }
    if (!this.db) {
      log.error(
        "XAccountController.fetchTweetsWithMediaAndURLs: database not initialized",
      );
      return [];
    }

    return fetchTweetsWithMediaAndURLsFromDB(this.db, whereClause, params);
  }

  resetProgress(): XProgress {
    log.debug("XAccountController.resetProgress");
    this.progress = emptyXProgress();
    return this.progress;
  }

  createJobs(jobTypes: string[]): XJob[] {
    return Jobs.createJobs(this, jobTypes);
  }

  async getLastFinishedJob(jobType: string): Promise<XJob | null> {
    return Jobs.getLastFinishedJob(this, jobType);
  }

  // Converters
  convertXJobRowToXJob(row: XJobRow): XJob {
    return {
      id: row.id,
      jobType: row.jobType,
      status: row.status,
      scheduledAt: new Date(row.scheduledAt),
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
      progressJSON: row.progressJSON ? JSON.parse(row.progressJSON) : null,
      error: row.error,
    };
  }

  protected getMITMURLs(): string[] {
    return [
      "x.com/i/api/graphql",
      "x.com/i/api/1.1/dm",
      "x.com/i/api/2/notifications/all.json",
    ];
  }

  indexTweet(
    responseIndex: number,
    userCore: XAPIUserCore,
    tweetLegacy: XAPILegacyTweet,
  ): void {
    return Index.indexTweet(this, responseIndex, userCore, tweetLegacy);
  }

  indexParseTweetsResponseData(responseIndex: number): boolean {
    return Index.indexParseTweetsResponseData(this, responseIndex);
  }

  async indexParseTweets(): Promise<XProgress> {
    return Index.indexParseTweets(this);
  }

  async saveTweetMedia(mediaPath: string, filename: string): Promise<string> {
    return Index.saveTweetMedia(this, mediaPath, filename);
  }

  indexTweetMedia(tweetLegacy: XAPILegacyTweet): void {
    return Index.indexTweetMedia(this, tweetLegacy);
  }

  indexTweetURLs(tweetLegacy: XAPILegacyTweet): void {
    return Index.indexTweetURLs(this, tweetLegacy);
  }

  async indexUser(user: XAPIUser): Promise<void> {
    return Index.indexUser(this, user);
  }

  indexConversation(conversation: XAPIConversation): void {
    return Index.indexConversation(this, conversation);
  }

  async indexParseConversationsResponseData(
    responseIndex: number,
  ): Promise<boolean> {
    return Index.indexParseConversationsResponseData(this, responseIndex);
  }

  async indexParseConversations(): Promise<XProgress> {
    return Index.indexParseConversations(this);
  }

  async indexIsThereMore(): Promise<boolean> {
    return Index.indexIsThereMore(this);
  }

  async resetThereIsMore(): Promise<void> {
    return Index.resetThereIsMore(this);
  }

  async indexMessagesStart(): Promise<XIndexMessagesStartResponse> {
    return Index.indexMessagesStart(this);
  }

  indexMessage(message: XAPIMessage): void {
    return Index.indexMessage(this, message);
  }

  async indexParseMessagesResponseData(
    responseIndex: number,
  ): Promise<boolean> {
    return Index.indexParseMessagesResponseData(this, responseIndex);
  }

  async indexParseMessages(): Promise<XProgress> {
    return Index.indexParseMessages(this);
  }

  async indexConversationFinished(conversationID: string): Promise<void> {
    return Index.indexConversationFinished(this, conversationID);
  }

  // When you start archiving tweets you:
  // - Return the URLs path, output path, and all expected filenames
  async archiveTweetsStart(): Promise<XArchiveStartResponse> {
    return Archive.archiveTweetsStart(this);
  }

  async archiveTweetsOutputPath(): Promise<string> {
    return Archive.archiveTweetsOutputPath(this);
  }

  async archiveTweet(tweetID: string): Promise<void> {
    return Archive.archiveTweet(this, tweetID);
  }

  async archiveTweetCheckDate(tweetID: string): Promise<void> {
    return Archive.archiveTweetCheckDate(this, tweetID);
  }

  async archiveBuild(): Promise<boolean | void> {
    return Archive.archiveBuild(this);
  }

  // When you start deleting tweets, return a list of tweets to delete
  async deleteTweetsStart(): Promise<XDeleteTweetsStartResponse> {
    return Deletion.deleteTweetsStart(this);
  }

  async deleteTweetsCountNotArchived(total: boolean): Promise<number> {
    return Deletion.deleteTweetsCountNotArchived(this, total);
  }

  async deleteRetweetsStart(): Promise<XDeleteTweetsStartResponse> {
    return Deletion.deleteRetweetsStart(this);
  }

  async deleteLikesStart(): Promise<XDeleteTweetsStartResponse> {
    return Deletion.deleteLikesStart(this);
  }

  async deleteBookmarksStart(): Promise<XDeleteTweetsStartResponse> {
    return Deletion.deleteBookmarksStart(this);
  }

  async deleteTweet(tweetID: string, deleteType: string): Promise<void> {
    return Deletion.deleteTweet(this, tweetID, deleteType);
  }

  deleteDMsMarkDeleted(conversationID: string): void {
    return Deletion.deleteDMsMarkDeleted(this, conversationID);
  }

  async deleteDMsMarkAllDeleted(): Promise<void> {
    return Deletion.deleteDMsMarkAllDeleted(this);
  }

  async resetRateLimitInfo(): Promise<void> {
    this.rateLimitInfo = emptyXRateLimitInfo();
  }

  async isRateLimited(): Promise<XRateLimitInfo> {
    return this.rateLimitInfo;
  }

  async getProgressInfo(): Promise<XProgressInfo> {
    return Stats.getProgressInfo(this);
  }

  async getDatabaseStats(): Promise<XDatabaseStats> {
    return Stats.getDatabaseStats(this);
  }

  async getDeleteReviewStats(): Promise<XDeleteReviewStats> {
    return Stats.getDeleteReviewStats(this);
  }

  async saveProfileImage(url: string): Promise<void> {
    return Account.saveProfileImage(this, url);
  }

  async getLatestResponseData(): Promise<ResponseData | null> {
    for (let i = 0; i < this.mitmController.responseData.length; i++) {
      if (!this.mitmController.responseData[i].processed) {
        return this.mitmController.responseData[i];
      }
    }
    return null;
  }

  // Unzip twitter archive to the account data folder using unzipper
  // Return unzipped path if success, else null.
  async unzipXArchive(archiveZipPath: string): Promise<string | null> {
    return XArchive.unzipXArchive(this, archiveZipPath);
  }

  async deleteUnzippedXArchive(archivePath: string): Promise<void> {
    return XArchive.deleteUnzippedXArchive(archivePath);
  }

  // Return null on success, and a string (error message) on error
  async verifyXArchive(archivePath: string): Promise<string | null> {
    return XArchive.verifyXArchive(this, archivePath);
  }

  async importXArchive(
    archivePath: string,
    dataType: string,
  ): Promise<XImportArchiveResponse> {
    return XArchive.importXArchive(this, archivePath, dataType);
  }

  async importXArchiveMedia(tweet: XArchiveTweet, archivePath: string) {
    return XArchive.importXArchiveMedia(this, tweet, archivePath);
  }

  async saveXArchiveMedia(
    tweetID: string,
    media: XAPILegacyTweetMedia,
    archivePath: string,
  ): Promise<string | null> {
    return XArchive.saveXArchiveMedia(this, tweetID, media, archivePath);
  }

  importXArchiveURLs(tweet: XArchiveTweet) {
    return XArchive.importXArchiveURLs(this, tweet);
  }

  async getCookie(hostname: string, name: string): Promise<string | null> {
    log.debug(
      `XAccountController.getCookie: hostname=${hostname}, name=${name}`,
    );
    if (!this.cookies[hostname]) {
      return null;
    }
    return this.cookies[hostname][name] || null;
  }

  async deleteConfig(key: string) {
    return globalDeleteConfig(key, this.db);
  }

  async deleteConfigLike(key: string) {
    return globalDeleteConfigLike(key, this.db);
  }

  async blueskyGetProfile(): Promise<BlueskyMigrationProfile | null> {
    return this.getBlueskyService().getProfile();
  }

  async blueskyAuthorize(handle: string): Promise<boolean | string> {
    return this.getBlueskyService().authorize(handle);
  }

  async blueskyCallback(queryString: string): Promise<boolean | string> {
    return this.getBlueskyService().callback(queryString);
  }

  async blueskyDisconnect(): Promise<void> {
    return this.getBlueskyService().disconnect();
  }

  async blueskyGetTweetCounts(): Promise<XMigrateTweetCounts> {
    if (!this.db) {
      this.initDB();
    }
    if (!this.account) {
      throw new Error("Account not found");
    }
    return this.getBlueskyService().getTweetCounts();
  }

  async blueskyMigrateTweetBuildRecord(
    agent: Agent,
    tweetID: string,
  ): Promise<[BskyPostRecord, string] | string> {
    return this.getBlueskyService().migrateTweetBuildRecord(agent, tweetID);
  }

  async blueskyMigrateTweet(tweetID: string): Promise<boolean | string> {
    if (!this.db) {
      this.initDB();
    }
    if (!this.account) {
      throw new Error("Account not found");
    }
    return this.getBlueskyService().migrateTweet(tweetID);
  }

  async blueskyDeleteMigratedTweet(tweetID: string): Promise<boolean | string> {
    if (!this.db) {
      this.initDB();
    }
    if (!this.account) {
      throw new Error("Account not found");
    }
    return this.getBlueskyService().deleteMigratedTweet(tweetID);
  }

  async updateAccountUsername(newUsername: string): Promise<void> {
    return Account.updateAccountUsername(this, newUsername);
  }
  async getMediaPath(): Promise<string> {
    if (!this.account || !this.account.username) {
      return "";
    }
    const accountDataPath = getAccountDataPath("X", this.account.username);
    return path.join(accountDataPath, "Tweet Media");
  }

  private getBlueskyService(): BlueskyService {
    if (!this.blueskyService) {
      if (!this.db) {
        this.initDB();
      }
      if (!this.account) {
        this.refreshAccount();
      }
      if (!this.db || !this.account) {
        throw new Error("Database or account not initialized");
      }
      this.blueskyService = new BlueskyService(
        this.db,
        this.account,
        this.accountID,
        (key) => this.getConfig(key),
        (key, value) => this.setConfig(key, value),
        (key) => this.deleteConfig(key),
        (key) => this.deleteConfigLike(key),
        (whereClause, params) =>
          this.fetchTweetsWithMediaAndURLs(whereClause, params),
        () => this.getMediaPath(),
        (info) => Object.assign(this.rateLimitInfo, info),
      );
    }
    return this.blueskyService;
  }

  async initArchiveOnlyMode(): Promise<XAccount> {
    return Account.initArchiveOnlyMode(this);
  }
}
