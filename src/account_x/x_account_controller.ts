import path from "path";
import fs from "fs";

import unzipper from "unzipper";

import { app, session } from "electron";
import type { OnSendHeadersListenerDetails } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";

import { Agent } from "@atproto/api";
import { Record as BskyPostRecord } from "@atproto/api/dist/client/types/app/bsky/feed/post";

import { getResourcesPath, getAccountDataPath } from "../util";
import { getImageDataURI } from "../shared/utils/image-utils";
import {
  XAccount,
  XJob,
  XProgress,
  emptyXProgress,
  XTweetItem,
  XTweetItemArchive,
  XArchiveStartResponse,
  emptyXArchiveStartResponse,
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
  saveXAccount,
  exec,
  deleteConfig as globalDeleteConfig,
  deleteConfigLike as globalDeleteConfigLike,
} from "../database";
import { IMITMController } from "../mitm";
import { BaseAccountController } from "../shared/controllers/BaseAccountController";
import {
  XJobRow,
  XTweetRow,
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
import { saveArchive } from "./archive";
import { indexUserIntoDB } from "./controller/index/indexUser";
import { indexConversationIntoDB } from "./controller/index/indexConversation";
import { indexTweetURLsIntoDB } from "./controller/index/indexTweetURLs";
import { fetchTweetsWithMediaAndURLsFromDB } from "./controller/fetchTweetsWithMediaAndURLs";
import { migrations } from "./controller/migrations";
import { BlueskyService } from "./controller/bluesky/BlueskyService";
import { saveProfileImage } from "./controller/actions/saveProfileImage";
import { getLastFinishedJob } from "./controller/jobs/getLastFinishedJob";
import { createJobs } from "./controller/jobs/createJobs";
import { unzipXArchive } from "./controller/archive/unzipXArchive";
import { deleteUnzippedXArchive } from "./controller/archive/deleteUnzippedXArchive";
import { verifyXArchive } from "./controller/archive/verifyXArchive";
import { importXArchive } from "./controller/archive/importXArchive";
import { importXArchiveMedia } from "./controller/archive/importXArchiveMedia";
import { saveXArchiveMedia } from "./controller/archive/saveXArchiveMedia";
import { importXArchiveURLs } from "./controller/archive/importXArchiveURLs";
import { getProgressInfo } from "./controller/stats/getProgressInfo";
import { getDatabaseStats } from "./controller/stats/getDatabaseStats";
import { getDeleteReviewStats } from "./controller/stats/getDeleteReviewStats";
import { deleteTweetsStart } from "./controller/deletion/deleteTweetsStart";
import { deleteTweetsCountNotArchived } from "./controller/deletion/deleteTweetsCountNotArchived";
import { deleteRetweetsStart } from "./controller/deletion/deleteRetweetsStart";
import { deleteLikesStart } from "./controller/deletion/deleteLikesStart";
import { deleteBookmarksStart } from "./controller/deletion/deleteBookmarksStart";
import { deleteTweet } from "./controller/deletion/deleteTweet";
import { deleteDMsMarkDeleted } from "./controller/deletion/deleteDMsMarkDeleted";
import { deleteDMsMarkAllDeleted } from "./controller/deletion/deleteDMsMarkAllDeleted";
import { indexTweet } from "./controller/index/indexTweet";
import { indexTweetMedia } from "./controller/index/indexTweetMedia";
import { indexParseTweetsResponseData } from "./controller/index/indexParseTweetsResponseData";
import { indexParseTweets } from "./controller/index/indexParseTweets";
import { indexParseConversationsResponseData } from "./controller/index/indexParseConversationsResponseData";
import { indexParseConversations } from "./controller/index/indexParseConversations";
import { indexIsThereMore } from "./controller/index/indexIsThereMore";
import { resetThereIsMore } from "./controller/index/resetThereIsMore";
import { indexMessagesStart } from "./controller/index/indexMessagesStart";
import { indexMessage } from "./controller/index/indexMessage";
import { indexParseMessagesResponseData } from "./controller/index/indexParseMessagesResponseData";
import { indexParseMessages } from "./controller/index/indexParseMessages";
import { indexConversationFinished } from "./controller/index/indexConversationFinished";
import { saveTweetMedia } from "./controller/index/saveTweetMedia";

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
        deleteDMsMarkDeleted(this, conversationID);
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
    return createJobs(this, jobTypes);
  }

  async getLastFinishedJob(jobType: string): Promise<XJob | null> {
    return getLastFinishedJob(this, jobType);
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

  formatDateToYYYYMMDD(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  convertTweetRowToXTweetItemArchive(row: XTweetRow): XTweetItemArchive {
    return {
      url: `https://x.com/${row.path}`,
      tweetID: row.tweetID,
      basename: `${this.formatDateToYYYYMMDD(row.createdAt)}_${row.tweetID}`,
      username: row.username,
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
    return indexTweet(this, responseIndex, userCore, tweetLegacy);
  }

  indexParseTweetsResponseData(responseIndex: number): boolean {
    return indexParseTweetsResponseData(this, responseIndex);
  }

  async indexParseTweets(): Promise<XProgress> {
    return indexParseTweets(this);
  }

  async saveTweetMedia(mediaPath: string, filename: string): Promise<string> {
    return saveTweetMedia(this, mediaPath, filename);
  }

  indexTweetMedia(tweetLegacy: XAPILegacyTweet): void {
    return indexTweetMedia(this, tweetLegacy);
  }

  indexTweetURLs(tweetLegacy: XAPILegacyTweet): void {
    if (!this.db) {
      this.initDB();
    }
    if (!this.db) {
      log.error("XAccountController.indexTweetURLs: database not initialized");
      return;
    }

    indexTweetURLsIntoDB(this.db, tweetLegacy);
  }

  async indexUser(user: XAPIUser): Promise<void> {
    if (!this.db) {
      this.initDB();
    }
    if (!this.db) {
      log.error("XAccountController.indexUser: database not initialized");
      return;
    }

    await indexUserIntoDB(this.db, this.progress, getImageDataURI, user);
  }

  indexConversation(conversation: XAPIConversation): void {
    if (!this.db) {
      this.initDB();
    }
    if (!this.db) {
      log.error(
        "XAccountController.indexConversation: database not initialized",
      );
      return;
    }

    indexConversationIntoDB(
      this.db,
      () => {
        this.progress.conversationsIndexed++;
      },
      conversation,
    );
  }

  async indexParseConversationsResponseData(
    responseIndex: number,
  ): Promise<boolean> {
    return indexParseConversationsResponseData(this, responseIndex);
  }

  async indexParseConversations(): Promise<XProgress> {
    return indexParseConversations(this);
  }

  async indexIsThereMore(): Promise<boolean> {
    return indexIsThereMore(this);
  }

  async resetThereIsMore(): Promise<void> {
    return resetThereIsMore(this);
  }

  async indexMessagesStart(): Promise<XIndexMessagesStartResponse> {
    return indexMessagesStart(this);
  }

  indexMessage(message: XAPIMessage): void {
    return indexMessage(this, message);
  }

  async indexParseMessagesResponseData(
    responseIndex: number,
  ): Promise<boolean> {
    return indexParseMessagesResponseData(this, responseIndex);
  }

  async indexParseMessages(): Promise<XProgress> {
    return indexParseMessages(this);
  }

  async indexConversationFinished(conversationID: string): Promise<void> {
    return indexConversationFinished(this, conversationID);
  }

  // When you start archiving tweets you:
  // - Return the URLs path, output path, and all expected filenames
  async archiveTweetsStart(): Promise<XArchiveStartResponse> {
    if (!this.db) {
      this.initDB();
    }

    if (this.account) {
      const tweetsResp: XTweetRow[] = exec(
        this.db,
        "SELECT tweetID, text, likeCount, retweetCount, createdAt, path FROM tweet WHERE username = ? AND text NOT LIKE ? ORDER BY createdAt",
        [this.account.username, "RT @%"],
        "all",
      ) as XTweetRow[];

      const items: XTweetItemArchive[] = [];
      for (let i = 0; i < tweetsResp.length; i++) {
        items.push(this.convertTweetRowToXTweetItemArchive(tweetsResp[i]));
      }

      return {
        outputPath: await this.archiveTweetsOutputPath(),
        items: items,
      };
    }
    return emptyXArchiveStartResponse();
  }

  // Make sure the Archived Tweets folder exists and return its path
  async archiveTweetsOutputPath(): Promise<string> {
    if (this.account) {
      const accountDataPath = getAccountDataPath("X", this.account.username);
      const outputPath = path.join(accountDataPath, "Archived Tweets");
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath);
      }
      return outputPath;
    }
    throw new Error("Account not found");
  }

  // Save the tweet's archivedAt timestamp
  async archiveTweet(tweetID: string) {
    if (!this.db) {
      this.initDB();
    }

    exec(this.db, "UPDATE tweet SET archivedAt = ? WHERE tweetID = ?", [
      new Date(),
      tweetID,
    ]);
  }

  // If the tweet doesn't have an archivedAt timestamp, set one
  async archiveTweetCheckDate(tweetID: string) {
    if (!this.db) {
      this.initDB();
    }

    const tweet: XTweetRow = exec(
      this.db,
      "SELECT * FROM tweet WHERE tweetID = ?",
      [tweetID],
      "get",
    ) as XTweetRow;
    if (!tweet.archivedAt) {
      exec(this.db, "UPDATE tweet SET archivedAt = ? WHERE tweetID = ?", [
        new Date(),
        tweetID,
      ]);
    }
  }

  async archiveBuild() {
    if (!this.account) {
      console.error("XAccountController.archiveBuild: account not found");
      return false;
    }

    if (!this.db) {
      this.initDB();
      if (!this.db) {
        console.error(
          "XAccountController.archiveBuild: database not initialized",
        );
        return;
      }
    }

    log.info("XAccountController.archiveBuild: building archive");

    // Build the archive
    const assetsPath = path.join(
      getAccountDataPath("X", this.account.username),
      "assets",
    );
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath);
    }
    const archivePath = path.join(assetsPath, "archive.js");
    saveArchive(this.db, app.getVersion(), this.account.username, archivePath);

    // Unzip x-archive.zip to the account data folder using unzipper
    const archiveZipPath = path.join(getResourcesPath(), "x-archive.zip");
    const archiveZip = await unzipper.Open.file(archiveZipPath);
    await archiveZip.extract({
      path: getAccountDataPath("X", this.account.username),
    });
  }

  // When you start deleting tweets, return a list of tweets to delete
  async deleteTweetsStart(): Promise<XDeleteTweetsStartResponse> {
    return deleteTweetsStart(this);
  }

  async deleteTweetsCountNotArchived(total: boolean): Promise<number> {
    return deleteTweetsCountNotArchived(this, total);
  }

  async deleteRetweetsStart(): Promise<XDeleteTweetsStartResponse> {
    return deleteRetweetsStart(this);
  }

  async deleteLikesStart(): Promise<XDeleteTweetsStartResponse> {
    return deleteLikesStart(this);
  }

  async deleteBookmarksStart(): Promise<XDeleteTweetsStartResponse> {
    return deleteBookmarksStart(this);
  }

  async deleteTweet(tweetID: string, deleteType: string): Promise<void> {
    return deleteTweet(this, tweetID, deleteType);
  }

  deleteDMsMarkDeleted(conversationID: string): void {
    return deleteDMsMarkDeleted(this, conversationID);
  }

  async deleteDMsMarkAllDeleted(): Promise<void> {
    return deleteDMsMarkAllDeleted(this);
  }

  async resetRateLimitInfo(): Promise<void> {
    this.rateLimitInfo = emptyXRateLimitInfo();
  }

  async isRateLimited(): Promise<XRateLimitInfo> {
    return this.rateLimitInfo;
  }

  async getProgressInfo(): Promise<XProgressInfo> {
    return getProgressInfo(this);
  }

  async getDatabaseStats(): Promise<XDatabaseStats> {
    return getDatabaseStats(this);
  }

  async getDeleteReviewStats(): Promise<XDeleteReviewStats> {
    return getDeleteReviewStats(this);
  }

  async saveProfileImage(url: string): Promise<void> {
    return saveProfileImage(this, url);
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
    return unzipXArchive(this, archiveZipPath);
  }

  async deleteUnzippedXArchive(archivePath: string): Promise<void> {
    return deleteUnzippedXArchive(archivePath);
  }

  // Return null on success, and a string (error message) on error
  async verifyXArchive(archivePath: string): Promise<string | null> {
    return verifyXArchive(this, archivePath);
  }

  async importXArchive(
    archivePath: string,
    dataType: string,
  ): Promise<XImportArchiveResponse> {
    return importXArchive(this, archivePath, dataType);
  }

  async importXArchiveMedia(tweet: XArchiveTweet, archivePath: string) {
    return importXArchiveMedia(this, tweet, archivePath);
  }

  async saveXArchiveMedia(
    tweetID: string,
    media: XAPILegacyTweetMedia,
    archivePath: string,
  ): Promise<string | null> {
    return saveXArchiveMedia(this, tweetID, media, archivePath);
  }

  importXArchiveURLs(tweet: XArchiveTweet) {
    return importXArchiveURLs(this, tweet);
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
    // Update the username in the main database
    if (this.account) {
      this.account.username = newUsername;
      saveXAccount(this.account);
    }
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

  // Set archiveOnly to true, and set a temporary username
  async initArchiveOnlyMode(): Promise<XAccount> {
    if (!this.account) {
      log.warn(
        `XAccountController.initArchiveOnlyMode: account does not exist, bailing`,
      );
      throw new Error("Account not found");
    }

    if (!this.account.username) {
      const uuid = crypto.randomUUID();
      const tempUsername = `deleted_account_${uuid.slice(0, 8)}`;
      this.account.username = tempUsername;
      log.info(
        "XAccountController.initArchiveOnlyMode: temporary username: ",
        tempUsername,
      );
    }

    this.account.archiveOnly = true;
    saveXAccount(this.account);

    return this.account;
  }
}
