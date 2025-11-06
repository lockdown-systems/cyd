import path from "path";
import fs from "fs";
import os from "os";

import fetch from "node-fetch";
import unzipper from "unzipper";

import { app, session } from "electron";
import type { OnSendHeadersListenerDetails } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";
import { glob } from "glob";

import { Agent } from "@atproto/api";
import { Record as BskyPostRecord } from "@atproto/api/dist/client/types/app/bsky/feed/post";

import {
  getResourcesPath,
  getDataPath,
  getAccountDataPath,
  getTimestampDaysAgo,
} from "../util";
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
  emptyXProgressInfo,
  ResponseData,
  XDatabaseStats,
  emptyXDatabaseStats,
  XDeleteReviewStats,
  emptyXDeleteReviewStats,
  XImportArchiveResponse,
  XMigrateTweetCounts,
  BlueskyMigrationProfile,
} from "../shared_types";
import {
  runMigrations,
  getAccount,
  saveXAccount,
  exec,
  Sqlite3Count,
  getConfig as globalGetConfig,
  setConfig as globalSetConfig,
  deleteConfig as globalDeleteConfig,
  deleteConfigLike as globalDeleteConfigLike,
} from "../database";
import { IMITMController } from "../mitm";
import { BaseAccountController } from "../shared/controllers/BaseAccountController";
import {
  XJobRow,
  XTweetRow,
  XTweetMediaRow,
  XConversationRow,
  // X API types
  XAPILegacyTweet,
  XAPILegacyTweetMedia,
  XAPILegacyURL,
  XAPIUserCore,
  XAPIData,
  XAPIBookmarksData,
  XAPITimeline,
  XAPIInboxTimeline,
  XAPIInboxInitialState,
  XAPIConversation,
  XAPIConversationTimeline,
  XAPIMessage,
  XAPIUser,
  XArchiveAccount,
  XArchiveTweet,
  XArchiveTweetContainer,
  isXArchiveTweetContainer,
  XArchiveLike,
  XArchiveLikeContainer,
  isXArchiveLikeContainer,
  isXAPIBookmarksData,
  isXAPIError,
  isXAPIData,
  isXAPIData_v2,
} from "./types";

// for building the static archive site
import { saveArchive } from "./archive";
import { indexUserIntoDB } from "./controller/indexUser";
import { indexConversationIntoDB } from "./controller/indexConversation";
import { indexTweetURLsIntoDB } from "./controller/indexTweetURLs";
import { fetchTweetsWithMediaAndURLsFromDB } from "./controller/fetchTweetsWithMediaAndURLs";
import { migrations } from "./controller/migrations";
import { getMediaURL } from "./utils";
import { BlueskyService } from "./controller/bluesky/BlueskyService";

export class XAccountController extends BaseAccountController<XProgress> {
  // Making this public so it can be accessed in tests
  public account: XAccount | null = null;
  private rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();

  // Temp variable for accurately counting message progress
  private messageIDsIndexed: string[] = [];

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
        this.deleteDMsMarkDeleted(conversationID);
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
  private fetchTweetsWithMediaAndURLs(
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
    if (!this.db) {
      this.initDB();
    }

    // Cancel pending jobs
    exec(this.db, "UPDATE job SET status = ? WHERE status = ?", [
      "canceled",
      "pending",
    ]);

    // Create new pending jobs
    jobTypes.forEach((jobType) => {
      exec(
        this.db,
        "INSERT INTO job (jobType, status, scheduledAt) VALUES (?, ?, ?)",
        [jobType, "pending", new Date()],
      );
    });

    // Select pending jobs
    const jobs: XJobRow[] = exec(
      this.db,
      "SELECT * FROM job WHERE status = ? ORDER BY id",
      ["pending"],
      "all",
    ) as XJobRow[];
    return jobs.map(this.convertXJobRowToXJob);
  }

  async getLastFinishedJob(jobType: string): Promise<XJob | null> {
    if (!this.account || !this.account.username) {
      return null;
    }

    if (!this.db) {
      this.initDB();
    }

    const job: XJobRow | null = exec(
      this.db,
      "SELECT * FROM job WHERE jobType = ? AND status = ? AND finishedAt IS NOT NULL ORDER BY finishedAt DESC LIMIT 1",
      [jobType, "finished"],
      "get",
    ) as XJobRow | null;
    if (job) {
      return this.convertXJobRowToXJob(job);
    }
    return null;
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

  async indexStart() {
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    await ses.clearCache();
    await this.mitmController.startMonitoring();
    await this.mitmController.startMITM(ses, [
      "x.com/i/api/graphql",
      "x.com/i/api/1.1/dm",
      "x.com/i/api/2/notifications/all.json",
    ]);
    this.thereIsMore = true;
  }

  async indexStop() {
    await this.mitmController.stopMonitoring();
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    await this.mitmController.stopMITM(ses);
  }

  indexTweet(
    responseIndex: number,
    userCore: XAPIUserCore,
    tweetLegacy: XAPILegacyTweet,
  ) {
    if (!this.db) {
      this.initDB();
    }

    // Check if tweet has media and call indexTweetMedia
    let hasMedia: boolean = false;
    if (
      tweetLegacy.extended_entities?.media &&
      tweetLegacy.extended_entities?.media.length
    ) {
      hasMedia = true;
      this.indexTweetMedia(tweetLegacy);
    }

    // Check if tweet has URLs and index it
    if (tweetLegacy.entities?.urls && tweetLegacy.entities?.urls.length) {
      this.indexTweetURLs(tweetLegacy);
    }

    // Add the tweet
    exec(
      this.db,
      "INSERT OR REPLACE INTO tweet (username, tweetID, conversationID, createdAt, likeCount, quoteCount, replyCount, retweetCount, isLiked, isRetweeted, isBookmarked, text, path, hasMedia, isReply, replyTweetID, replyUserID, isQuote, quotedTweet, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        userCore["screen_name"],
        tweetLegacy["id_str"],
        tweetLegacy["conversation_id_str"],
        new Date(tweetLegacy["created_at"]),
        tweetLegacy["favorite_count"],
        tweetLegacy["quote_count"],
        tweetLegacy["reply_count"],
        tweetLegacy["retweet_count"],
        tweetLegacy["favorited"] ? 1 : 0,
        tweetLegacy["retweeted"] ? 1 : 0,
        tweetLegacy["bookmarked"] ? 1 : 0,
        tweetLegacy["full_text"],
        `${userCore["screen_name"]}/status/${tweetLegacy["id_str"]}`,
        hasMedia ? 1 : 0,
        tweetLegacy["in_reply_to_status_id_str"] ? 1 : 0,
        tweetLegacy["in_reply_to_status_id_str"],
        tweetLegacy["in_reply_to_user_id_str"],
        tweetLegacy["is_quote_status"] ? 1 : 0,
        tweetLegacy["quoted_status_permalink"]
          ? tweetLegacy["quoted_status_permalink"]["expanded"]
          : null,
        new Date(),
      ],
    );

    log.debug(
      "XAccountController.indexTweet: indexed tweet",
      this.account?.username,
      userCore,
      tweetLegacy,
    );

    // Update progress
    if (tweetLegacy["favorited"]) {
      // console.log("DEBUG-### LIKE: ", tweetLegacy["id_str"], userCore["screen_name"], tweetLegacy["full_text"]);
      this.progress.likesIndexed++;
    }
    if (tweetLegacy["bookmarked"]) {
      this.progress.bookmarksIndexed++;
    }
    if (tweetLegacy["full_text"].startsWith("RT @")) {
      // console.log("DEBUG-### RETWEET: ", tweetLegacy["id_str"], userCore["screen_name"], tweetLegacy["full_text"]);
      this.progress.retweetsIndexed++;
    }
    if (
      userCore["screen_name"] == this.account?.username &&
      !tweetLegacy["full_text"].startsWith("RT @")
    ) {
      // console.log("DEBUG-### TWEET: ", tweetLegacy["id_str"], userCore["screen_name"], tweetLegacy["full_text"]);
      this.progress.tweetsIndexed++;
    }
    if (
      !tweetLegacy["favorited"] &&
      !tweetLegacy["bookmarked"] &&
      !tweetLegacy["full_text"].startsWith("RT @") &&
      userCore["screen_name"] != this.account?.username
    ) {
      // console.log("DEBUG-### UNKNOWN: ", tweetLegacy["id_str"], userCore["screen_name"], tweetLegacy["full_text"]);
      this.progress.unknownIndexed++;
    }
  }

  // Returns false if the loop should stop
  indexParseTweetsResponseData(responseIndex: number) {
    const responseData = this.mitmController.responseData[responseIndex];

    // Already processed?
    if (responseData.processed) {
      return true;
    }

    // Rate limited?
    if (responseData.status == 429) {
      log.warn("XAccountController.indexParseTweetsResponseData: RATE LIMITED");
      this.mitmController.responseData[responseIndex].processed = true;
      return false;
    }

    // Process the next response
    if (
      // Tweets
      (responseData.url.includes("/UserTweetsAndReplies?") ||
        // Likes
        responseData.url.includes("/Likes?") ||
        // Bookmarks
        responseData.url.includes("/Bookmarks?")) &&
      responseData.status == 200
    ) {
      // For likes and tweets, body is XAPIData
      // For bookmarks, body is XAPIBookmarksData
      const body: XAPIData | XAPIBookmarksData = JSON.parse(
        responseData.responseBody,
      );
      let timeline: XAPITimeline;
      if (isXAPIBookmarksData(body)) {
        timeline = (body as XAPIBookmarksData).data.bookmark_timeline_v2;
      } else if (isXAPIData(body)) {
        timeline = (body as XAPIData).data.user.result.timeline as XAPITimeline;
      } else if (isXAPIData_v2(body)) {
        timeline = (body as XAPIData).data.user.result
          .timeline_v2 as XAPITimeline;
      } else if (isXAPIError(body)) {
        log.error(
          "XAccountController.indexParseTweetsResponseData: XAPIError",
          body,
        );
        this.mitmController.responseData[responseIndex].processed = true;
        return false;
      } else {
        log.error(
          "XAccountController.indexParseTweetsResponseData: Invalid response data",
          responseData.responseBody,
        );
        throw new Error("Invalid response data");
      }

      // Loop through instructions
      timeline.timeline.instructions.forEach((instructions) => {
        if (instructions["type"] != "TimelineAddEntries") {
          return;
        }

        // If we only have two entries, they both have entryType of TimelineTimelineCursor (one cursorType of Top and the other of Bottom), this means there are no more tweets
        if (
          instructions.entries?.length == 2 &&
          instructions.entries[0].content.entryType ==
            "TimelineTimelineCursor" &&
          instructions.entries[0].content.cursorType == "Top" &&
          instructions.entries[1].content.entryType ==
            "TimelineTimelineCursor" &&
          instructions.entries[1].content.cursorType == "Bottom"
        ) {
          this.thereIsMore = false;
          return;
        }

        // Loop through the entries
        instructions.entries?.forEach((entries) => {
          let userCore: XAPIUserCore | undefined;
          let tweetLegacy: XAPILegacyTweet | undefined;

          if (entries.content.entryType == "TimelineTimelineModule") {
            entries.content.items?.forEach((item) => {
              if (
                item.item.itemContent.tweet_results &&
                item.item.itemContent.tweet_results.result &&
                item.item.itemContent.tweet_results.result.core &&
                item.item.itemContent.tweet_results.result.core.user_results &&
                item.item.itemContent.tweet_results.result.core.user_results
                  .result &&
                item.item.itemContent.tweet_results.result.core.user_results
                  .result.core &&
                item.item.itemContent.tweet_results.result.legacy
              ) {
                userCore =
                  item.item.itemContent.tweet_results.result.core.user_results
                    .result.core;
                tweetLegacy = item.item.itemContent.tweet_results.result.legacy;
              }

              if (
                item.item.itemContent.tweet_results &&
                item.item.itemContent.tweet_results.result &&
                item.item.itemContent.tweet_results.result.tweet &&
                item.item.itemContent.tweet_results.result.tweet.core &&
                item.item.itemContent.tweet_results.result.tweet.core
                  .user_results &&
                item.item.itemContent.tweet_results.result.tweet.core
                  .user_results.result &&
                item.item.itemContent.tweet_results.result.tweet.core
                  .user_results.result.core &&
                item.item.itemContent.tweet_results.result.tweet.legacy
              ) {
                userCore =
                  item.item.itemContent.tweet_results.result.tweet.core
                    .user_results.result.core;
                tweetLegacy =
                  item.item.itemContent.tweet_results.result.tweet.legacy;
              }

              if (userCore && tweetLegacy) {
                this.indexTweet(responseIndex, userCore, tweetLegacy);
              }
            });
          } else if (entries.content.entryType == "TimelineTimelineItem") {
            if (
              entries.content.itemContent &&
              entries.content.itemContent.tweet_results &&
              entries.content.itemContent.tweet_results.result &&
              entries.content.itemContent.tweet_results.result.core &&
              entries.content.itemContent.tweet_results.result.core
                .user_results &&
              entries.content.itemContent.tweet_results.result.core.user_results
                .result &&
              entries.content.itemContent.tweet_results.result.core.user_results
                .result.legacy &&
              entries.content.itemContent.tweet_results.result.core.user_results
                .result.core &&
              entries.content.itemContent.tweet_results.result.legacy
            ) {
              userCore =
                entries.content.itemContent.tweet_results.result.core
                  .user_results.result.core;
              tweetLegacy =
                entries.content.itemContent.tweet_results.result.legacy;
            }

            if (
              entries.content.itemContent &&
              entries.content.itemContent.tweet_results &&
              entries.content.itemContent.tweet_results.result &&
              entries.content.itemContent.tweet_results.result.tweet &&
              entries.content.itemContent.tweet_results.result.tweet.core &&
              entries.content.itemContent.tweet_results.result.tweet.core
                .user_results &&
              entries.content.itemContent.tweet_results.result.tweet.core
                .user_results.result &&
              entries.content.itemContent.tweet_results.result.tweet.core
                .user_results.result.legacy &&
              entries.content.itemContent.tweet_results.result.tweet.core
                .user_results.result.core &&
              entries.content.itemContent.tweet_results.result.tweet.legacy
            ) {
              userCore =
                entries.content.itemContent.tweet_results.result.tweet.core
                  .user_results.result.core;
              tweetLegacy =
                entries.content.itemContent.tweet_results.result.tweet.legacy;
            }

            if (userCore && tweetLegacy) {
              this.indexTweet(responseIndex, userCore, tweetLegacy);
            }
          }
        });
      });

      this.mitmController.responseData[responseIndex].processed = true;
      log.debug(
        "XAccountController.indexParseTweetsResponseData: processed",
        responseIndex,
      );
    } else {
      // Skip response
      this.mitmController.responseData[responseIndex].processed = true;
    }
  }

  // Parses the response data so far to index tweets that have been collected
  // Returns the progress object
  // This works for tweets, likes, and bookmarks
  async indexParseTweets(): Promise<XProgress> {
    await this.mitmController.clearProcessed();
    log.info(
      `XAccountController.indexParseTweets: parsing ${this.mitmController.responseData.length} responses`,
    );

    for (let i = 0; i < this.mitmController.responseData.length; i++) {
      this.indexParseTweetsResponseData(i);
    }

    return this.progress;
  }

  async saveTweetMedia(mediaPath: string, filename: string) {
    if (!this.account) {
      throw new Error("Account not found");
    }

    // Create path to store tweet media if it doesn't exist already
    const outputPath = await this.getMediaPath();
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath);
    }

    // Download and save media from the mediaPath
    try {
      const response = await fetch(mediaPath, {});
      if (!response.ok) {
        return "";
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const outputFileName = path.join(outputPath, filename);
      fs.createWriteStream(outputFileName).write(buffer);
      return outputFileName;
    } catch {
      return "";
    }
  }

  indexTweetMedia(tweetLegacy: XAPILegacyTweet) {
    log.debug("XAccountController.indexMedia");

    // Loop over all media items
    tweetLegacy.extended_entities?.media?.forEach(
      (media: XAPILegacyTweetMedia) => {
        const mediaURL = getMediaURL(media);
        const mediaExtension = mediaURL.substring(
          mediaURL.lastIndexOf(".") + 1,
        );

        // Download media locally
        const filename = `${media["media_key"]}.${mediaExtension}`;
        this.saveTweetMedia(mediaURL, filename);

        // Index media information in tweet_media table
        exec(
          this.db,
          "INSERT OR REPLACE INTO tweet_media (mediaID, mediaType, url, filename, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            media["media_key"],
            media["type"],
            media["url"],
            filename,
            media["indices"]?.[0],
            media["indices"]?.[1],
            tweetLegacy["id_str"],
          ],
        );
      },
    );
  }

  indexTweetURLs(tweetLegacy: XAPILegacyTweet) {
    if (!this.db) {
      this.initDB();
    }
    if (!this.db) {
      log.error("XAccountController.indexTweetURLs: database not initialized");
      return;
    }

    indexTweetURLsIntoDB(this.db, tweetLegacy);
  }

  async indexUser(user: XAPIUser) {
    if (!this.db) {
      this.initDB();
    }
    if (!this.db) {
      log.error("XAccountController.indexUser: database not initialized");
      return;
    }

    await indexUserIntoDB(this.db, this.progress, getImageDataURI, user);
  }

  indexConversation(conversation: XAPIConversation) {
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

  async indexParseConversationsResponseData(responseIndex: number) {
    const responseData = this.mitmController.responseData[responseIndex];

    // Already processed?
    if (responseData.processed) {
      return true;
    }

    // Rate limited?
    if (responseData.status == 429) {
      log.warn(
        "XAccountController.indexParseConversationsResponseData: RATE LIMITED",
      );
      this.mitmController.responseData[responseIndex].processed = true;
      return false;
    }

    // Process the response
    if (
      // XAPIInboxTimeline
      (responseData.url.includes("/i/api/1.1/dm/inbox_timeline/trusted.json") ||
        responseData.url.includes(
          "/i/api/1.1/dm/inbox_timeline/untrusted.json",
        ) ||
        // XAPIInboxInitialState
        responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json") ||
        responseData.url.includes("/i/api/1.1/dm/user_updates.json")) &&
      responseData.status == 200
    ) {
      let users: Record<string, XAPIUser>;
      let conversations: Record<string, XAPIConversation>;
      if (
        responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json") ||
        responseData.url.includes("/i/api/1.1/dm/user_updates.json")
      ) {
        const inbox_initial_state: XAPIInboxInitialState = JSON.parse(
          responseData.responseBody,
        );
        if (!inbox_initial_state.inbox_initial_state) {
          // Skip this response
          return true;
        }
        users = inbox_initial_state.inbox_initial_state.users;
        conversations = inbox_initial_state.inbox_initial_state.conversations;
        this.thereIsMore =
          inbox_initial_state.inbox_initial_state.inbox_timelines.trusted
            ?.status == "HAS_MORE";
      } else {
        const inbox_timeline: XAPIInboxTimeline = JSON.parse(
          responseData.responseBody,
        );
        users = inbox_timeline.inbox_timeline.users;
        conversations = inbox_timeline.inbox_timeline.conversations;
        this.thereIsMore = inbox_timeline.inbox_timeline.status == "HAS_MORE";
      }

      // Add the users
      if (users) {
        log.info(
          `XAccountController.indexParseConversationsResponseData: adding ${Object.keys(users).length} users`,
        );
        for (const userID in users) {
          const user = users[userID];
          await this.indexUser(user);
        }
      } else {
        log.info(
          "XAccountController.indexParseConversationsResponseData: no users",
        );
      }

      // Add the conversations
      if (conversations) {
        log.info(
          `XAccountController.indexParseConversationsResponseData: adding ${Object.keys(conversations).length} conversations`,
        );
        for (const conversationID in conversations) {
          const conversation = conversations[conversationID];
          this.indexConversation(conversation);
        }
      } else {
        log.info(
          "XAccountController.indexParseConversationsResponseData: no conversations",
        );
      }

      this.mitmController.responseData[responseIndex].processed = true;
      log.debug(
        "XAccountController.indexParseConversationsResponseData: processed",
        responseIndex,
      );
    } else {
      // Skip response
      this.mitmController.responseData[responseIndex].processed = true;
    }
  }

  // Returns true if more data needs to be indexed
  // Returns false if we are caught up
  async indexParseConversations(): Promise<XProgress> {
    await this.mitmController.clearProcessed();
    log.info(
      `XAccountController.indexParseConversations: parsing ${this.mitmController.responseData.length} responses`,
    );

    this.progress.currentJob = "indexConversations";
    this.progress.isIndexMessagesFinished = false;

    for (let i = 0; i < this.mitmController.responseData.length; i++) {
      await this.indexParseConversationsResponseData(i);
    }

    return this.progress;
  }

  async indexIsThereMore(): Promise<boolean> {
    return this.thereIsMore;
  }

  async resetThereIsMore(): Promise<void> {
    this.thereIsMore = true;
  }

  // When you start indexing DMs, return a list of DM conversationIDs to index
  async indexMessagesStart(): Promise<XIndexMessagesStartResponse> {
    if (!this.db) {
      this.initDB();
    }

    // Select just the conversations that need to be indexed
    const conversationIDs: XConversationRow[] = exec(
      this.db,
      "SELECT conversationID FROM conversation WHERE shouldIndexMessages = ? AND deletedAt IS NULL",
      [1],
      "all",
    ) as XConversationRow[];
    const totalConversations: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM conversation WHERE deletedAt IS NULL",
      [],
      "get",
    ) as Sqlite3Count;
    log.debug(
      "XAccountController.indexMessagesStart",
      conversationIDs,
      totalConversations,
    );
    return {
      conversationIDs: conversationIDs.map((row) => row.conversationID),
      totalConversations: totalConversations.count,
    };
  }

  indexMessage(message: XAPIMessage) {
    log.debug("XAccountController.indexMessage", message);
    if (!this.db) {
      this.initDB();
    }

    if (!message.message) {
      // skip
      return;
    }

    // Insert of replace message
    exec(
      this.db,
      "INSERT OR REPLACE INTO message (messageID, conversationID, createdAt, senderID, text, deletedAt) VALUES (?, ?, ?, ?, ?, ?)",
      [
        message.message.id,
        message.message.conversation_id,
        new Date(Number(message.message.time)),
        message.message.message_data.sender_id,
        message.message.message_data.text,
        null,
      ],
    );

    // Update progress
    const insertMessageID: string = message.message.id;
    if (
      !this.messageIDsIndexed.some((messageID) => messageID === insertMessageID)
    ) {
      this.messageIDsIndexed.push(insertMessageID);
    }

    this.progress.messagesIndexed = this.messageIDsIndexed.length;
  }

  async indexParseMessagesResponseData(responseIndex: number) {
    const responseData = this.mitmController.responseData[responseIndex];

    // Already processed?
    if (responseData.processed) {
      return true;
    }

    // Rate limited?
    if (responseData.status == 429) {
      log.warn(
        "XAccountController.indexParseMessagesResponseData: RATE LIMITED",
      );
      this.mitmController.responseData[responseIndex].processed = true;
      return false;
    }

    // Process the response
    if (
      // XAPIConversationTimeline
      (responseData.url.includes("/i/api/1.1/dm/conversation/") ||
        // XAPIInboxInitialState
        responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json")) &&
      responseData.status == 200
    ) {
      log.debug(
        "XAccountController.indexParseMessagesResponseData",
        responseIndex,
      );
      let entries: XAPIMessage[];

      if (responseData.url.includes("/i/api/1.1/dm/conversation/")) {
        // XAPIConversationTimeline
        const conversationTimeline: XAPIConversationTimeline = JSON.parse(
          responseData.responseBody,
        );
        if (!conversationTimeline.conversation_timeline.entries) {
          // Skip this response
          return true;
        }
        entries = conversationTimeline.conversation_timeline.entries;
      } else {
        // XAPIInboxInitialState
        const inbox_initial_state: XAPIInboxInitialState = JSON.parse(
          responseData.responseBody,
        );
        if (!inbox_initial_state.inbox_initial_state) {
          // Skip this response
          return true;
        }
        entries = inbox_initial_state.inbox_initial_state.entries;
      }

      // Add the messages
      if (entries) {
        log.info(
          `XAccountController.indexParseMessagesResponseData: adding ${entries.length} messages`,
        );
        for (let i = 0; i < entries.length; i++) {
          const message = entries[i];
          this.indexMessage(message);
        }
      } else {
        log.info(
          "XAccountController.indexParseMessagesResponseData: no entries",
        );
      }

      this.mitmController.responseData[responseIndex].processed = true;
      log.debug(
        "XAccountController.indexParseMessagesResponseData: processed",
        responseIndex,
      );
    } else {
      // Skip response
      log.debug(
        "XAccountController.indexParseMessagesResponseData: skipping response",
        responseData.url,
      );
      this.mitmController.responseData[responseIndex].processed = true;
    }

    return true;
  }

  async indexParseMessages(): Promise<XProgress> {
    log.info(
      `XAccountController.indexParseMessages: parsing ${this.mitmController.responseData.length} responses`,
    );

    this.progress.currentJob = "indexMessages";
    this.progress.isIndexMessagesFinished = false;

    for (let i = 0; i < this.mitmController.responseData.length; i++) {
      await this.indexParseMessagesResponseData(i);
    }

    return this.progress;
  }

  // Set the conversation's shouldIndexMessages to false
  async indexConversationFinished(conversationID: string) {
    if (!this.db) {
      this.initDB();
    }

    exec(
      this.db,
      "UPDATE conversation SET shouldIndexMessages = ? WHERE conversationID = ?",
      [0, conversationID],
    );
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
    log.info("XAccountController.deleteTweetsStart");

    if (!this.db) {
      this.initDB();
    }

    if (!this.account) {
      throw new Error("Account not found");
    }

    // Determine the timestamp for filtering tweets
    const daysOldTimestamp = this.account.deleteTweetsDaysOldEnabled
      ? getTimestampDaysAgo(this.account.deleteTweetsDaysOld)
      : getTimestampDaysAgo(0);

    // Build the WHERE clause and parameters dynamically
    let whereClause = `
            t.deletedTweetAt IS NULL
            AND t.text NOT LIKE ?
            AND t.username = ?
            AND t.createdAt <= ?
        `;
    const params: (string | number)[] = [
      "RT @%",
      this.account.username,
      daysOldTimestamp,
    ];

    if (this.account.deleteTweetsLikesThresholdEnabled) {
      whereClause += " AND t.likeCount <= ?";
      params.push(this.account.deleteTweetsLikesThreshold);
    }
    if (this.account.deleteTweetsRetweetsThresholdEnabled) {
      whereClause += " AND t.retweetCount <= ?";
      params.push(this.account.deleteTweetsRetweetsThreshold);
    }

    // Fetch tweets using the helper function
    const tweets = this.fetchTweetsWithMediaAndURLs(whereClause, params);

    return { tweets };
  }

  // Returns the count of tweets that are not archived
  // If total is true, return the total count of tweets not archived
  // Otherwise, return the count of tweets not archived that will be deleted
  async deleteTweetsCountNotArchived(total: boolean): Promise<number> {
    log.info("XAccountController.deleteTweetsCountNotArchived");

    if (!this.db) {
      this.initDB();
    }

    if (!this.account) {
      throw new Error("Account not found");
    }

    // Select just the tweets that need to be deleted based on the settings
    let count: Sqlite3Count;

    if (total) {
      // Count all non-deleted, non-archived tweets, with no filters
      count = exec(
        this.db,
        "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ?",
        ["RT @%", this.account.username],
        "get",
      ) as Sqlite3Count;
    } else {
      const daysOldTimestamp = this.account.deleteTweetsDaysOldEnabled
        ? getTimestampDaysAgo(this.account.deleteTweetsDaysOld)
        : getTimestampDaysAgo(0);
      if (
        this.account.deleteTweetsLikesThresholdEnabled &&
        this.account.deleteTweetsRetweetsThresholdEnabled
      ) {
        // Both likes and retweets thresholds
        count = exec(
          this.db,
          "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ? AND retweetCount <= ?",
          [
            "RT @%",
            this.account.username,
            daysOldTimestamp,
            this.account.deleteTweetsLikesThreshold,
            this.account.deleteTweetsRetweetsThreshold,
          ],
          "get",
        ) as Sqlite3Count;
      } else if (
        this.account.deleteTweetsLikesThresholdEnabled &&
        !this.account.deleteTweetsRetweetsThresholdEnabled
      ) {
        // Just likes threshold
        count = exec(
          this.db,
          "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ?",
          [
            "RT @%",
            this.account.username,
            daysOldTimestamp,
            this.account.deleteTweetsLikesThreshold,
          ],
          "get",
        ) as Sqlite3Count;
      } else if (
        !this.account.deleteTweetsLikesThresholdEnabled &&
        this.account.deleteTweetsRetweetsThresholdEnabled
      ) {
        // Just retweets threshold
        count = exec(
          this.db,
          "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND retweetCount <= ?",
          [
            "RT @%",
            this.account.username,
            daysOldTimestamp,
            this.account.deleteTweetsRetweetsThreshold,
          ],
          "get",
        ) as Sqlite3Count;
      } else {
        // Neither likes nor retweets threshold
        count = exec(
          this.db,
          "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ?",
          ["RT @%", this.account.username, daysOldTimestamp],
          "get",
        ) as Sqlite3Count;
      }
    }

    return count.count;
  }

  // When you start deleting retweets, return a list of tweets to delete
  async deleteRetweetsStart(): Promise<XDeleteTweetsStartResponse> {
    log.info("XAccountController.deleteRetweetsStart");

    if (!this.db) {
      this.initDB();
    }

    if (!this.account) {
      throw new Error("Account not found");
    }

    const daysOldTimestamp = this.account.deleteRetweetsDaysOldEnabled
      ? getTimestampDaysAgo(this.account.deleteRetweetsDaysOld)
      : getTimestampDaysAgo(0);

    const tweets = this.fetchTweetsWithMediaAndURLs(
      "t.deletedRetweetAt IS NULL AND t.text LIKE ? AND t.createdAt <= ?",
      ["RT @%", daysOldTimestamp],
    );

    return { tweets };
  }

  // When you start deleting likes, return a list of tweets to unlike
  async deleteLikesStart(): Promise<XDeleteTweetsStartResponse> {
    log.info("XAccountController.deleteLikesStart");

    if (!this.db) {
      this.initDB();
    }

    if (!this.account) {
      throw new Error("Account not found");
    }

    const tweets = this.fetchTweetsWithMediaAndURLs(
      "t.deletedLikeAt IS NULL AND t.isLiked = ?",
      [1],
    );

    return { tweets };
  }

  // When you start deleting bookmarks, return a list of tweets to unbookmark
  async deleteBookmarksStart(): Promise<XDeleteTweetsStartResponse> {
    log.info("XAccountController.deleteBookmarksStart");

    if (!this.db) {
      this.initDB();
    }

    if (!this.account) {
      throw new Error("Account not found");
    }

    const tweets = this.fetchTweetsWithMediaAndURLs(
      "t.deletedBookmarkAt IS NULL AND t.isBookmarked = ?",
      [1],
    );

    return { tweets };
  }

  // Save the tweet's deleted*At timestamp
  async deleteTweet(tweetID: string, deleteType: string) {
    if (!this.db) {
      this.initDB();
    }

    if (deleteType == "tweet") {
      exec(this.db, "UPDATE tweet SET deletedTweetAt = ? WHERE tweetID = ?", [
        new Date(),
        tweetID,
      ]);
    } else if (deleteType == "retweet") {
      exec(this.db, "UPDATE tweet SET deletedRetweetAt = ? WHERE tweetID = ?", [
        new Date(),
        tweetID,
      ]);
    } else if (deleteType == "like") {
      exec(this.db, "UPDATE tweet SET deletedLikeAt = ? WHERE tweetID = ?", [
        new Date(),
        tweetID,
      ]);
    } else if (deleteType == "bookmark") {
      exec(
        this.db,
        "UPDATE tweet SET deletedBookmarkAt = ? WHERE tweetID = ?",
        [new Date(), tweetID],
      );
    } else {
      throw new Error("Invalid deleteType");
    }
  }

  deleteDMsMarkDeleted(conversationID: string) {
    log.info(
      `XAccountController.deleteDMsMarkDeleted: conversationID=${conversationID}`,
    );

    if (!this.db) {
      this.initDB();
    }

    // Mark the conversation as deleted
    exec(
      this.db,
      "UPDATE conversation SET deletedAt = ? WHERE conversationID = ?",
      [new Date(), conversationID],
    );

    // Mark all the messages as deleted
    exec(
      this.db,
      "UPDATE message SET deletedAt = ? WHERE conversationID = ? AND deletedAt is NULL",
      [new Date(), conversationID],
    );

    // Update the progress
    this.progress.conversationsDeleted++;
  }

  async deleteDMsMarkAllDeleted(): Promise<void> {
    if (!this.db) {
      this.initDB();
    }

    const conversations = exec(
      this.db,
      "SELECT conversationID FROM conversation WHERE deletedAt IS NULL",
      [],
      "all",
    ) as XConversationRow[];
    log.info(
      `XAccountController.deleteDMsMarkAllDeleted: marking ${conversations.length} conversations deleted`,
    );

    for (let i = 0; i < conversations.length; i++) {
      this.deleteDMsMarkDeleted(conversations[i].conversationID);
    }
  }

  async resetRateLimitInfo(): Promise<void> {
    this.rateLimitInfo = emptyXRateLimitInfo();
  }

  async isRateLimited(): Promise<XRateLimitInfo> {
    return this.rateLimitInfo;
  }

  async getProgressInfo(): Promise<XProgressInfo> {
    if (!this.db) {
      this.initDB();
    }

    const totalTweetsIndexed: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE username = ? AND text NOT LIKE ? AND isLiked = ?",
      [this.account?.username || "", "RT @%", 0],
      "get",
    ) as Sqlite3Count;
    const totalTweetsArchived: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NOT NULL",
      [],
      "get",
    ) as Sqlite3Count;
    const totalRetweetsIndexed: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ?",
      ["RT @%"],
      "get",
    ) as Sqlite3Count;
    const totalLikesIndexed: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ?",
      [1],
      "get",
    ) as Sqlite3Count;
    const totalBookmarksIndexed: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ?",
      [1],
      "get",
    ) as Sqlite3Count;
    const totalUnknownIndexed: Sqlite3Count = exec(
      this.db,
      `SELECT COUNT(*) AS count FROM tweet
             WHERE id NOT IN (
                 SELECT id FROM tweet WHERE username = ? AND text NOT LIKE ? AND isLiked = ?
                 UNION
                 SELECT id FROM tweet WHERE text LIKE ?
                 UNION
                 SELECT id FROM tweet WHERE isLiked = ?
             )`,
      [this.account?.username || "", "RT @%", 0, "RT @%", 1],
      "get",
    ) as Sqlite3Count;
    const totalTweetsDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE username = ? AND text NOT LIKE ? AND isLiked = ? AND deletedTweetAt IS NOT NULL",
      [this.account?.username || "", "RT @%", 0],
      "get",
    ) as Sqlite3Count;
    const totalRetweetsDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedRetweetAt IS NOT NULL",
      ["RT @%"],
      "get",
    ) as Sqlite3Count;
    const totalLikesDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedLikeAt IS NOT NULL",
      [1],
      "get",
    ) as Sqlite3Count;
    const totalBookmarksDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ? AND deletedBookmarkAt IS NOT NULL",
      [1],
      "get",
    ) as Sqlite3Count;
    const totalTweetsMigratedToBluesky: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet_bsky_migration",
      [],
      "get",
    ) as Sqlite3Count;

    const totalConversationsDeletedConfig: string | null = await this.getConfig(
      "totalConversationsDeleted",
    );
    let totalConversationsDeleted: number = 0;
    if (totalConversationsDeletedConfig) {
      totalConversationsDeleted = parseInt(totalConversationsDeletedConfig);
    }

    const totalAccountsUnfollowedConfig: string | null = await this.getConfig(
      "totalAccountsUnfollowed",
    );
    let totalAccountsUnfollowed: number = 0;
    if (totalAccountsUnfollowedConfig) {
      totalAccountsUnfollowed = parseInt(totalAccountsUnfollowedConfig);
    }

    const progressInfo = emptyXProgressInfo();
    progressInfo.accountUUID = this.accountUUID;
    progressInfo.totalTweetsIndexed = totalTweetsIndexed.count;
    progressInfo.totalTweetsArchived = totalTweetsArchived.count;
    progressInfo.totalRetweetsIndexed = totalRetweetsIndexed.count;
    progressInfo.totalLikesIndexed = totalLikesIndexed.count;
    progressInfo.totalBookmarksIndexed = totalBookmarksIndexed.count;
    progressInfo.totalUnknownIndexed = totalUnknownIndexed.count;
    progressInfo.totalTweetsDeleted = totalTweetsDeleted.count;
    progressInfo.totalRetweetsDeleted = totalRetweetsDeleted.count;
    progressInfo.totalLikesDeleted = totalLikesDeleted.count;
    progressInfo.totalBookmarksDeleted = totalBookmarksDeleted.count;
    progressInfo.totalConversationsDeleted = totalConversationsDeleted;
    progressInfo.totalAccountsUnfollowed = totalAccountsUnfollowed;
    progressInfo.totalTweetsMigratedToBluesky =
      totalTweetsMigratedToBluesky.count;
    return progressInfo;
  }

  async getDatabaseStats(): Promise<XDatabaseStats> {
    const databaseStats = emptyXDatabaseStats();
    if (!this.account?.username) {
      log.debug("XAccountController.getDatabaseStats: no account");
      return databaseStats;
    }

    if (!this.db) {
      this.initDB();
    }

    const username = this.account.username;

    const tweetsSaved: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND isLiked = ? AND username = ?",
      ["RT @%", 0, username],
      "get",
    ) as Sqlite3Count;
    const tweetsDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND isLiked = ? AND username = ? AND deletedTweetAt IS NOT NULL",
      ["RT @%", 0, username],
      "get",
    ) as Sqlite3Count;
    const retweetsSaved: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ?",
      ["RT @%"],
      "get",
    ) as Sqlite3Count;
    const retweetsDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedRetweetAt IS NOT NULL",
      ["RT @%"],
      "get",
    ) as Sqlite3Count;
    const likesSaved: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ?",
      [1],
      "get",
    ) as Sqlite3Count;
    const likesDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedLikeAt IS NOT NULL",
      [1],
      "get",
    ) as Sqlite3Count;
    const bookmarksSaved: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ?",
      [1],
      "get",
    ) as Sqlite3Count;
    const bookmarksDeleted: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ? AND deletedBookmarkAt IS NOT NULL",
      [1],
      "get",
    ) as Sqlite3Count;
    const conversationsDeleted = parseInt(
      (await this.getConfig("totalConversationsDeleted")) || "0",
    );
    const accountsUnfollowed = parseInt(
      (await this.getConfig("totalAccountsUnfollowed")) || "0",
    );
    const tweetsMigratedToBluesky: Sqlite3Count = exec(
      this.db,
      "SELECT COUNT(*) AS count FROM tweet_bsky_migration",
      [],
      "get",
    ) as Sqlite3Count;

    databaseStats.tweetsSaved = tweetsSaved.count;
    databaseStats.tweetsDeleted = tweetsDeleted.count;
    databaseStats.retweetsSaved = retweetsSaved.count;
    databaseStats.retweetsDeleted = retweetsDeleted.count;
    databaseStats.likesSaved = likesSaved.count;
    databaseStats.likesDeleted = likesDeleted.count;
    databaseStats.bookmarksSaved = bookmarksSaved.count;
    databaseStats.bookmarksDeleted = bookmarksDeleted.count;
    databaseStats.conversationsDeleted = conversationsDeleted;
    databaseStats.accountsUnfollowed = accountsUnfollowed;
    databaseStats.tweetsMigratedToBluesky = tweetsMigratedToBluesky.count;
    return databaseStats;
  }

  async getDeleteReviewStats(): Promise<XDeleteReviewStats> {
    const deleteReviewStats = emptyXDeleteReviewStats();
    if (!this.account?.username) {
      log.info("XAccountController.getDeleteReviewStats: no account");
      return deleteReviewStats;
    }

    if (!this.db) {
      this.initDB();
    }

    const deleteTweetsStartResponse = await this.deleteTweetsStart();
    const deleteRetweetStartResponse = await this.deleteRetweetsStart();
    const deleteLikesStartResponse = await this.deleteLikesStart();
    const deleteBookmarksStartResponse = await this.deleteBookmarksStart();

    deleteReviewStats.tweetsToDelete = deleteTweetsStartResponse.tweets.length;
    deleteReviewStats.retweetsToDelete =
      deleteRetweetStartResponse.tweets.length;
    deleteReviewStats.likesToDelete = deleteLikesStartResponse.tweets.length;
    deleteReviewStats.bookmarksToDelete =
      deleteBookmarksStartResponse.tweets.length;
    return deleteReviewStats;
  }

  async saveProfileImage(url: string): Promise<void> {
    try {
      const response = await fetch(url, {});
      if (!response.ok) {
        log.warn(
          "XAccountController.saveProfileImage: response not ok",
          response.status,
        );
        return;
      }
      const buffer = await response.buffer();
      const dataURI = `data:${response.headers.get("content-type")};base64,${buffer.toString("base64")}`;
      log.info("XAccountController.saveProfileImage: got profile image!");

      if (this.account) {
        this.account.profileImageDataURI = dataURI;
        saveXAccount(this.account);
      }
    } catch {
      return;
    }
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
    if (!this.db) {
      log.warn(`XAccountController.unzipXArchive: db does not exist, creating`);
      this.initDB();
    }

    if (!this.account) {
      log.warn(
        `XAccountController.unzipXArchive: account does not exist, bailing`,
      );
      return null;
    }

    const unzippedPath = path.join(
      getAccountDataPath("X", this.account.username),
      "tmp",
    );

    const archiveZip = await unzipper.Open.file(archiveZipPath);
    await archiveZip.extract({ path: unzippedPath });

    log.info(`XAccountController.unzipXArchive: unzipped to ${unzippedPath}`);

    return unzippedPath;
  }

  // Delete the unzipped X archive once the build is completed
  async deleteUnzippedXArchive(archivePath: string): Promise<void> {
    fs.rm(archivePath, { recursive: true, force: true }, (err) => {
      if (err) {
        log.error(
          `XAccountController.deleteUnzippedXArchive: Error occured while deleting unzipped folder: ${err}`,
        );
      }
    });
  }

  // Return null on success, and a string (error message) on error
  async verifyXArchive(archivePath: string): Promise<string | null> {
    // If archivePath contains just one folder and no files, update archivePath to point to that inner folder
    const archiveContents = fs.readdirSync(archivePath);
    if (
      archiveContents.length === 1 &&
      fs.lstatSync(path.join(archivePath, archiveContents[0])).isDirectory()
    ) {
      archivePath = path.join(archivePath, archiveContents[0]);
    }

    const foldersToCheck = [archivePath, path.join(archivePath, "data")];

    // Make sure folders exist
    for (let i = 0; i < foldersToCheck.length; i++) {
      if (!fs.existsSync(foldersToCheck[i])) {
        log.error(
          `XAccountController.verifyXArchive: folder does not exist: ${foldersToCheck[i]}`,
        );
        return `The folder ${foldersToCheck[i]} doesn't exist.`;
      }
    }

    // Make sure account.js exists and is readable
    const accountPath = path.join(archivePath, "data", "account.js");
    if (!fs.existsSync(accountPath)) {
      log.error(
        `XAccountController.verifyXArchive: file does not exist: ${accountPath}`,
      );
      return `The file ${accountPath} doesn't exist.`;
    }
    try {
      fs.accessSync(accountPath, fs.constants.R_OK);
    } catch {
      log.error(
        `XAccountController.verifyXArchive: file is not readable: ${accountPath}`,
      );
      return `The file ${accountPath} is not readable.`;
    }

    // Make sure the account.js file belongs to the right account
    let username;
    try {
      const accountFile = fs.readFileSync(accountPath, "utf8");
      const accountData: XArchiveAccount[] = JSON.parse(
        accountFile.slice("window.YTD.account.part0 = ".length),
      );
      if (accountData.length !== 1) {
        log.error(
          `XAccountController.verifyXArchive: account.js has more than one account`,
        );
        return `The account.js file has more than one account.`;
      }

      // Store the username for later use
      username = accountData[0].account.username;

      // We run this check only if we're not in archive only mode
      if (username !== this.account?.username && !this.account?.archiveOnly) {
        log.info(
          `XAccountController.verifyXArchive: username: ${this.account?.username}`,
        );
        log.error(
          `XAccountController.verifyXArchive: account.js does not belong to the right account`,
        );
        return `This archive is for @${username}, not @${this.account?.username}.`;
      }
    } catch {
      return "Error parsing JSON in account.js";
    }

    // If this is an archive-only account (which uses temporary usernames) and we now have the real username,
    // check if we need to rename the account directory or if it already exists with the correct name
    console.log(
      `XAccountController.verifyXArchive: archiveOnly: ${this.account?.archiveOnly}`,
    );
    if (this.account?.archiveOnly) {
      // Close the database before any directory operations
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // `getAccountDataPath` creates the account data path if it doesn't exist
      const oldAccountDataPath = getAccountDataPath("X", this.account.username);
      // We manually build the path here so that we can check if the folder exists
      const dataPath = getDataPath();
      const xDataPath = path.join(dataPath, "X");
      const newAccountDataPath = path.join(xDataPath, username);

      log.info(
        `XAccountController.verifyXArchive: oldAccountDataPath: ${oldAccountDataPath}`,
      );
      log.info(
        `XAccountController.verifyXArchive: newAccountDataPath: ${newAccountDataPath}`,
      );

      // Check if the folder already exists with the correct username
      if (fs.existsSync(newAccountDataPath)) {
        log.info(
          `XAccountController.verifyXArchive: Folder already exists with correct username, using existing folder: ${newAccountDataPath}`,
        );

        // Update the archivePath to point to the correct location in the existing folder
        // If archivePath was pointing to a tmp directory, update it to the new tmp directory
        const oldTmpPath = path.join(oldAccountDataPath, "tmp");

        log.info(
          `XAccountController.verifyXArchive: archivePath: ${archivePath}`,
        );
        log.info(
          `XAccountController.verifyXArchive: oldTmpPath: ${oldTmpPath}`,
        );
        log.info(
          `XAccountController.verifyXArchive: archivePath === oldTmpPath: ${archivePath === oldTmpPath}`,
        );

        // When using an existing folder, we need to copy the archive contents into the account's data directory
        // Create a tmp directory to hold the archive contents temporarily
        const tmpPath = path.join(newAccountDataPath, "tmp");
        if (!fs.existsSync(tmpPath)) {
          fs.mkdirSync(tmpPath, { recursive: true });
        }

        // Copy the archive contents to the tmp directory
        const copyRecursive = (src: string, dest: string) => {
          const items = fs.readdirSync(src);
          for (const item of items) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);

            if (fs.lstatSync(srcPath).isDirectory()) {
              if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
              }
              copyRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        // Copy the original archive contents to the tmp directory
        copyRecursive(archivePath, tmpPath);

        // Update archivePath to point to the tmp directory where we copied the contents
        archivePath = tmpPath;
        log.info(
          `XAccountController.verifyXArchive: Copied archive contents to tmp directory: ${archivePath}`,
        );

        // Update the account username in the database
        this.account.username = username;
        await this.updateAccountUsername(username);

        // Use the existing path
        this.accountDataPath = newAccountDataPath;
        this.initDB();

        this.refreshAccount();
      } else {
        // Only rename if the new folder doesn't already exist
        // `getAccountDataPath` creates the account data path if it doesn't exist
        const newAccountDataPath = getAccountDataPath("X", username);
        try {
          // Move all content recursively from old directory to new directory
          if (fs.existsSync(oldAccountDataPath)) {
            const moveAllContent = (src: string, dest: string) => {
              const items = fs.readdirSync(src);
              for (const item of items) {
                const srcPath = path.join(src, item);
                const destPath = path.join(dest, item);

                if (fs.lstatSync(srcPath).isDirectory()) {
                  if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                  }
                  moveAllContent(srcPath, destPath);
                  fs.rmdirSync(srcPath); // Remove empty directory
                } else {
                  fs.renameSync(srcPath, destPath);
                }
              }
            };

            moveAllContent(oldAccountDataPath, newAccountDataPath);
            log.info(
              `XAccountController.verifyXArchive: Moved all content from ${oldAccountDataPath} to ${newAccountDataPath}`,
            );

            // Update the archivePath to point to the new location
            const oldTmpPath = path.join(oldAccountDataPath, "tmp");
            const newTmpPath = path.join(newAccountDataPath, "tmp");
            if (archivePath === oldTmpPath) {
              archivePath = newTmpPath;
              log.info(
                `XAccountController.verifyXArchive: Updated archivePath from ${oldTmpPath} to ${newTmpPath}`,
              );
            }

            // Delete the old deleted_account_ folder after successful migration
            try {
              if (fs.existsSync(oldAccountDataPath)) {
                // Check if the directory is now empty (all content should have been moved)
                const remainingItems = fs.readdirSync(oldAccountDataPath);
                if (remainingItems.length === 0) {
                  fs.rmdirSync(oldAccountDataPath);
                  log.info(
                    `XAccountController.verifyXArchive: Deleted empty old directory: ${oldAccountDataPath}`,
                  );
                } else {
                  log.warn(
                    `XAccountController.verifyXArchive: Old directory not empty, skipping deletion: ${oldAccountDataPath} (${remainingItems.length} items remaining)`,
                  );
                }
              }
            } catch (error) {
              log.error(
                `XAccountController.verifyXArchive: Failed to delete old directory ${oldAccountDataPath}: ${error}`,
              );
              // Don't fail the import if cleanup fails
            }
          }

          log.info(
            `XAccountController.verifyXArchive: Renamed account directory from ${this.account.username} to ${username}`,
          );

          // Update the account username in the database
          this.account.username = username;
          await this.updateAccountUsername(username);

          // Reinitialize the database connection to point to the new path
          this.accountDataPath = newAccountDataPath;
          this.initDB();

          this.refreshAccount();
        } catch (error) {
          log.error(
            `XAccountController.verifyXArchive: Failed to rename account directory: ${error}`,
          );
          // Continue with import even if rename fails
        }
      }
    }

    return null;
  }

  // Return null on success, and a string (error message) on error
  async importXArchive(
    archivePath: string,
    dataType: string,
  ): Promise<XImportArchiveResponse> {
    let importCount = 0;
    let skipCount = 0;

    // If archivePath contains just one folder and no files, update archivePath to point to that inner folder
    const archiveContents = fs.readdirSync(archivePath);
    if (
      archiveContents.length === 1 &&
      fs.lstatSync(path.join(archivePath, archiveContents[0])).isDirectory()
    ) {
      archivePath = path.join(archivePath, archiveContents[0]);
    }

    // Load the username
    let username: string;
    try {
      const accountFile = fs.readFileSync(
        path.join(archivePath, "data", "account.js"),
        "utf8",
      );
      const accountData: XArchiveAccount[] = JSON.parse(
        accountFile.slice("window.YTD.account.part0 = ".length),
      );
      username = accountData[0].account.username;
    } catch {
      return {
        status: "error",
        errorMessage: "Error parsing JSON in account.js",
        importCount: importCount,
        skipCount: skipCount,
        updatedArchivePath: archivePath,
      };
    }

    // Import tweets
    if (dataType == "tweets") {
      const tweetsFilenames = await glob(
        [
          path.join(archivePath, "data", "tweet.js"),
          path.join(archivePath, "data", "tweets.js"),
          path.join(archivePath, "data", "tweet-part*.js"),
          path.join(archivePath, "data", "tweets-part*.js"),
        ],
        {
          windowsPathsNoEscape: os.platform() == "win32",
        },
      );
      if (tweetsFilenames.length === 0) {
        return {
          status: "error",
          errorMessage: "No tweets files found",
          importCount: importCount,
          skipCount: skipCount,
          updatedArchivePath: archivePath,
        };
      }

      for (let i = 0; i < tweetsFilenames.length; i++) {
        // Load the data
        // New archives use XArchiveTweetContainer[], old archives use XArchiveTweet[]
        let tweetsData: XArchiveTweet[] | XArchiveTweetContainer[];
        try {
          const tweetsFile = fs.readFileSync(tweetsFilenames[i], "utf8");
          tweetsData = JSON.parse(tweetsFile.slice(tweetsFile.indexOf("[")));
        } catch (e) {
          log.error(
            `XAccountController.importXArchive: Error parsing JSON in ${tweetsFilenames[i]}:`,
            e,
          );
          return {
            status: "error",
            errorMessage: "Error parsing JSON in tweets.js",
            importCount: importCount,
            skipCount: skipCount,
            updatedArchivePath: archivePath,
          };
        }

        // Loop through the tweets and add them to the database
        try {
          tweetsData.forEach(async (tweetContainer) => {
            let tweet: XArchiveTweet;
            if (isXArchiveTweetContainer(tweetContainer)) {
              tweet = tweetContainer.tweet;
            } else {
              tweet = tweetContainer;
            }

            // Check if tweet has media and call importXArchiveMedia
            let hasMedia: boolean = false;
            if (
              tweet.extended_entities?.media &&
              tweet.extended_entities?.media?.length
            ) {
              hasMedia = true;
              await this.importXArchiveMedia(tweet, archivePath);
            }

            // Check if tweet has urls and call importXArchiveURLs
            if (tweet.entities?.urls && tweet.entities?.urls?.length) {
              this.importXArchiveURLs(tweet);
            }

            // Import it
            exec(
              this.db,
              "INSERT OR REPLACE INTO tweet (username, tweetID, createdAt, likeCount, retweetCount, isLiked, isRetweeted, isBookmarked, text, path, hasMedia, isReply, replyTweetID, replyUserID, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                username,
                tweet.id_str,
                new Date(tweet.created_at),
                tweet.favorite_count,
                tweet.retweet_count,
                tweet.favorited ? 1 : 0,
                tweet.retweeted ? 1 : 0,
                0,
                tweet.full_text,
                `${username}/status/${tweet.id_str}`,
                hasMedia ? 1 : 0,
                tweet.in_reply_to_status_id_str ? 1 : 0,
                tweet.in_reply_to_status_id_str,
                tweet.in_reply_to_user_id_str,
                new Date(),
              ],
            );
            importCount++;
          });
        } catch (e) {
          return {
            status: "error",
            errorMessage: "Error importing tweets: " + e,
            importCount: importCount,
            skipCount: skipCount,
            updatedArchivePath: archivePath,
          };
        }
      }

      return {
        status: "success",
        errorMessage: "",
        importCount: importCount,
        skipCount: skipCount,
        updatedArchivePath: archivePath,
      };
    }

    // Import likes
    else if (dataType == "likes") {
      const likesFilenames = await glob(
        [
          path.join(archivePath, "data", "like.js"),
          path.join(archivePath, "data", "likes.js"),
          path.join(archivePath, "data", "like-part*.js"),
          path.join(archivePath, "data", "likes-part*.js"),
        ],
        {
          windowsPathsNoEscape: os.platform() == "win32",
        },
      );
      if (likesFilenames.length === 0) {
        return {
          status: "error",
          errorMessage: "No likes files found",
          importCount: importCount,
          skipCount: skipCount,
          updatedArchivePath: archivePath,
        };
      }

      for (let i = 0; i < likesFilenames.length; i++) {
        // Load the data
        let likesData: XArchiveLike[] | XArchiveLikeContainer[];
        try {
          const likesFile = fs.readFileSync(likesFilenames[i], "utf8");
          likesData = JSON.parse(likesFile.slice(likesFile.indexOf("[")));
        } catch (e) {
          log.error(
            `XAccountController.importXArchive: Error parsing JSON in ${likesFilenames[i]}:`,
            e,
          );
          return {
            status: "error",
            errorMessage: "Error parsing JSON in like.js",
            importCount: importCount,
            skipCount: skipCount,
            updatedArchivePath: archivePath,
          };
        }

        // Loop through the likes and add them to the database
        try {
          likesData.forEach((likeContainer) => {
            let like: XArchiveLike;
            if (isXArchiveLikeContainer(likeContainer)) {
              like = likeContainer.like;
            } else {
              like = likeContainer;
            }

            // Is this like already there?
            const existingTweet = exec(
              this.db,
              "SELECT * FROM tweet WHERE tweetID = ?",
              [like.tweetId],
              "get",
            ) as XTweetRow;
            if (existingTweet) {
              if (existingTweet.isLiked) {
                skipCount++;
              } else {
                // Set isLiked to true
                exec(
                  this.db,
                  "UPDATE tweet SET isLiked = ? WHERE tweetID = ?",
                  [1, like.tweetId],
                );
                importCount++;
              }
            } else {
              // Import it
              const url = new URL(like.expandedUrl);
              let path = url.pathname + url.search + url.hash;
              if (path.startsWith("/")) {
                path = path.substring(1);
              }
              exec(
                this.db,
                "INSERT INTO tweet (tweetID, isLiked, text, path, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?)",
                [like.tweetId, 1, like.fullText, path, new Date()],
              );
              importCount++;
            }
          });
        } catch (e) {
          return {
            status: "error",
            errorMessage: "Error importing tweets: " + e,
            importCount: importCount,
            skipCount: skipCount,
            updatedArchivePath: archivePath,
          };
        }
      }

      return {
        status: "success",
        errorMessage: "",
        importCount: importCount,
        skipCount: skipCount,
        updatedArchivePath: archivePath,
      };
    }

    return {
      status: "error",
      errorMessage: "Invalid data type.",
      importCount: importCount,
      skipCount: skipCount,
      updatedArchivePath: archivePath,
    };
  }

  async importXArchiveMedia(tweet: XArchiveTweet, archivePath: string) {
    // Loop over all media items
    tweet.extended_entities?.media?.forEach(
      async (media: XAPILegacyTweetMedia) => {
        const existingMedia = exec(
          this.db,
          "SELECT * FROM tweet_media WHERE mediaID = ?",
          [media.id_str],
          "get",
        ) as XTweetMediaRow;
        if (existingMedia) {
          log.debug(
            `XAccountController.importXArchiveMedia: media already exists: ${media.id_str}`,
          );
          return;
        }
        const filename = await this.saveXArchiveMedia(
          tweet.id_str,
          media,
          archivePath,
        );
        if (filename) {
          // Index media information in tweet_media table
          exec(
            this.db,
            "INSERT INTO tweet_media (mediaID, mediaType, url, filename, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              media.id_str,
              media.type,
              media.url,
              filename,
              media.indices?.[0],
              media.indices?.[1],
              tweet.id_str,
            ],
          );
        }
      },
    );
  }

  async saveXArchiveMedia(
    tweetID: string,
    media: XAPILegacyTweetMedia,
    archivePath: string,
  ): Promise<string | null> {
    if (!this.account) {
      throw new Error("Account not found");
    }

    log.info(
      `XAccountController.saveXArchiveMedia: saving media: ${JSON.stringify(media)}`,
    );

    const mediaURL = getMediaURL(media);
    const mediaExtension = mediaURL.substring(mediaURL.lastIndexOf(".") + 1);
    const filename = `${media["id_str"]}.${mediaExtension}`;

    let archiveMediaFilename = null;
    if (
      (media.type === "video" || media.type === "animated_gif") &&
      media.video_info?.variants
    ) {
      // For videos, find the highest quality MP4 variant
      const mp4Variants = media.video_info.variants
        .filter((v) => v.content_type === "video/mp4")
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (mp4Variants.length > 0) {
        const highestQualityVariant = mp4Variants[0];
        const videoFilename = highestQualityVariant.url
          .split("/")
          .pop()
          ?.split("?")[0];
        if (videoFilename) {
          archiveMediaFilename = path.join(
            archivePath,
            "data",
            "tweets_media",
            `${tweetID}-${videoFilename}`,
          );
        }
      }
    } else {
      // For non-videos
      archiveMediaFilename = path.join(
        archivePath,
        "data",
        "tweets_media",
        `${tweetID}-${mediaURL.substring(mediaURL.lastIndexOf("/") + 1)}`,
      );
    }

    // If file doesn't exist in archive, don't save information in db
    if (!archiveMediaFilename || !fs.existsSync(archiveMediaFilename)) {
      log.info(
        `XAccountController.saveXArchiveMedia: media file not found: ${archiveMediaFilename}`,
      );
      return null;
    }

    // Create path to store tweet media if it doesn't exist already
    const outputPath = await this.getMediaPath();
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath);
    }

    // Copy media from archive
    fs.copyFileSync(archiveMediaFilename, path.join(outputPath, filename));

    return filename;
  }

  importXArchiveURLs(tweet: XArchiveTweet) {
    // Loop over all URL items
    tweet?.entities?.urls.forEach((url: XAPILegacyURL) => {
      // Index url information in tweet_url table
      exec(
        this.db,
        "INSERT OR REPLACE INTO tweet_url (url, displayURL, expandedURL, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?)",
        [
          url.url,
          url.display_url,
          url.expanded_url,
          url.indices?.[0],
          url.indices?.[1],
          tweet.id_str,
        ],
      );
    });
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

  async getConfig(key: string): Promise<string | null> {
    return globalGetConfig(key, this.db);
  }

  async setConfig(key: string, value: string) {
    return globalSetConfig(key, value, this.db);
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
