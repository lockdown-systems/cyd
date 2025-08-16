import path from "path";
import fs from "fs";
import os from "os";

import fetch from "node-fetch";
import unzipper from "unzipper";
import mime from "mime-types";

// Simple image dimension reader for PNG and JPG
async function getImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await fs.promises.readFile(filePath);

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      // PNG: width and height are at bytes 16-19 and 20-23 (big-endian)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPG/JPEG signature: FF D8
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      // Scan for SOF0 (Start of Frame) marker: FF C0
      for (let i = 2; i < buffer.length - 8; i++) {
        if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
          // Height at offset 5-6, width at offset 7-8 (big-endian)
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
      }
    }

    return null;
  } catch (error) {
    log.error(`Error reading image dimensions: ${error}`);
    return null;
  }
}

import { app, session, shell } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";
import { glob } from "glob";

import {
  NodeOAuthClient,
  NodeSavedState,
  NodeSavedSession,
  OAuthSession,
  NodeOAuthClientFromMetadataOptions,
} from "@atproto/oauth-client-node";
import { Agent, BlobRef, RichText } from "@atproto/api";
import { Record as BskyPostRecord } from "@atproto/api/dist/client/types/app/bsky/feed/post";

import {
  getResourcesPath,
  getDataPath,
  getAccountDataPath,
  getTimestampDaysAgo,
} from "../util";
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
  BlueskyAPIError,
  isBlueskyAPIError,
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
import {
  XJobRow,
  XTweetRow,
  XTweetMediaRow,
  XTweetURLRow,
  XUserRow,
  XConversationRow,
  XTweetBlueskyMigrationRow,
  // X API types
  XAPILegacyTweet,
  XAPILegacyTweetMedia,
  XAPILegacyTweetMediaVideoVariant,
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

const getMediaURL = (media: XAPILegacyTweetMedia): string => {
  // Get the HTTPS URL of the media -- this works for photos
  let mediaURL = media["media_url_https"];

  // If it's a video, set mediaURL to the video variant with the highest bitrate
  if (media["type"] === "video") {
    let highestBitrate = 0;
    if (media["video_info"] && media["video_info"]["variants"]) {
      media["video_info"]["variants"].forEach(
        (variant: XAPILegacyTweetMediaVideoVariant) => {
          if (variant["bitrate"] && variant["bitrate"] > highestBitrate) {
            highestBitrate = variant["bitrate"];
            mediaURL = variant["url"];

            // Stripe query parameters from the URL.
            // For some reason video variants end with `?tag=12`, and when we try downloading with that
            // it responds with 404.
            const queryIndex = mediaURL.indexOf("?");
            if (queryIndex > -1) {
              mediaURL = mediaURL.substring(0, queryIndex);
            }
          }
        },
      );
    }
  }
  // If it's a GIF, there is only one video variant with a bitrate of 0, so select the first item
  else if (media["type"] === "animated_gif") {
    if (media["video_info"] && media["video_info"]["variants"]) {
      mediaURL = media["video_info"]["variants"]?.[0]["url"];

      // Stripe query parameters from the URL.
      // For some reason video variants end with `?tag=12`, and when we try downloading with that
      // it responds with 404.
      const queryIndex = mediaURL.indexOf("?");
      if (queryIndex > -1) {
        mediaURL = mediaURL.substring(0, queryIndex);
      }
    }
  }
  return mediaURL;
};

export class XAccountController {
  private accountUUID: string = "";
  // Making this public so it can be accessed in tests
  public account: XAccount | null = null;
  private accountID: number = 0;
  private accountDataPath: string = "";
  private rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();
  private thereIsMore: boolean = false;

  // Temp variable for accurately counting message progress
  private messageIDsIndexed: string[] = [];

  // Making this public so it can be accessed in tests
  public db: Database.Database | null = null;

  public mitmController: IMITMController;
  private progress: XProgress = emptyXProgress();

  private cookies: Record<string, Record<string, string>> = {};

  private blueskyClient: NodeOAuthClient | null = null;

  constructor(accountID: number, mitmController: IMITMController) {
    this.mitmController = mitmController;

    this.accountID = accountID;
    this.refreshAccount();

    // Monitor web request metadata
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

    ses.webRequest.onSendHeaders((details) => {
      // Keep track of cookies
      if (details.requestHeaders) {
        const hostname = new URL(details.url).hostname;
        const cookieHeader = details.requestHeaders["Cookie"];
        if (cookieHeader) {
          const cookies = cookieHeader.split(";");
          cookies.forEach((cookie) => {
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
    });
  }

  cleanup() {
    if (this.db) {
      this.db.pragma("wal_checkpoint(FULL)");
      this.db.close();
      this.db = null;
    }
  }

  refreshAccount() {
    // Load the account
    const account = getAccount(this.accountID);
    if (!account) {
      log.error(
        `XAccountController.refreshAccount: account ${this.accountID} not found`,
      );
      return;
    }

    // Make sure it's an X account
    if (account.type != "X") {
      log.error(
        `XAccountController.refreshAccount: account ${this.accountID} is not an X account`,
      );
      return;
    }

    // Get the account UUID
    this.accountUUID = account.uuid;
    log.debug(
      `XAccountController.refreshAccount: accountUUID=${this.accountUUID}`,
    );

    // Load the X account
    this.account = account.xAccount;
    if (!this.account) {
      log.error(
        `XAccountController.refreshAccount: xAccount ${this.accountID} not found`,
      );
      return;
    }
  }

  initDB() {
    if (!this.account) {
      log.error("XAccountController.initDB: account does not exist");
      return;
    }

    log.info("XAccountController.initDB: account", this.account);

    // Make sure the account data folder exists
    this.accountDataPath = getAccountDataPath("X", this.account.username);
    log.info(
      `XAccountController.initDB: accountDataPath=${this.accountDataPath}`,
    );

    // Open the database
    this.db = new Database(path.join(this.accountDataPath, "data.sqlite3"), {});
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db, [
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
          `CREATE TABLE tweet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    tweetID TEXT NOT NULL UNIQUE,
    conversationID TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    likeCount INTEGER NOT NULL,
    quoteCount INTEGER NOT NULL,
    replyCount INTEGER NOT NULL,
    retweetCount INTEGER NOT NULL,
    isLiked BOOLEAN NOT NULL,
    isRetweeted BOOLEAN NOT NULL,
    text TEXT NOT NULL,
    path TEXT NOT NULL,
    addedToDatabaseAt DATETIME NOT NULL,
    archivedAt DATETIME,
    deletedAt DATETIME
);`,
          `CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL UNIQUE,
    name TEXT,
    screenName TEXT NOT NULL,
    profileImageDataURI TEXT
);`,
          `CREATE TABLE conversation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationID TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    sortTimestamp TEXT,
    minEntryID TEXT,
    maxEntryID TEXT,
    isTrusted BOOLEAN,
    shouldIndexMessages BOOLEAN,
    addedToDatabaseAt DATETIME NOT NULL,
    updatedInDatabaseAt DATETIME,
    deletedAt DATETIME
);`,
          `CREATE TABLE conversation_participant (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationID TEXT NOT NULL,
    userID TEXT NOT NULL
);`,
          `CREATE TABLE message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageID TEXT NOT NULL UNIQUE,
    conversationID TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    senderID TEXT NOT NULL,
    text TEXT NOT NULL,
    deletedAt DATETIME
);`,
        ],
      },
      // Add the config table
      {
        name: "20241016_add_config",
        sql: [
          `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`,
        ],
      },
      // Update the tweet table to make some columns nullable
      {
        name: "20241127_make_tweet_cols_nullable",
        sql: [
          `CREATE TABLE tweet_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    tweetID TEXT NOT NULL UNIQUE,
    conversationID TEXT,
    createdAt DATETIME,
    likeCount INTEGER,
    quoteCount INTEGER,
    replyCount INTEGER,
    retweetCount INTEGER,
    isLiked BOOLEAN,
    isRetweeted BOOLEAN,
    text TEXT,
    path TEXT NOT NULL,
    addedToDatabaseAt DATETIME NOT NULL,
    archivedAt DATETIME,
    deletedAt DATETIME
);`,
          `INSERT INTO tweet_new SELECT * FROM tweet;`,
          `DROP TABLE tweet;`,
          `ALTER TABLE tweet_new RENAME TO tweet;`,
        ],
      },
      // Add isBookmarked to the tweet table, and update isBookarked for all tweets
      {
        name: "20241127_add_isBookmarked",
        sql: [
          `ALTER TABLE tweet ADD COLUMN isBookmarked BOOLEAN;`,
          `UPDATE tweet SET isBookmarked = 0;`,
        ],
      },
      // Add deletedTweetAt, deletedRetweetAt, deletedLikeAt, and deletedBookmarkAt to the tweet table, and
      // try to guess which types of deletions have already occured
      {
        name: "20241127_add_deletedAt_fields",
        sql: [
          `ALTER TABLE tweet ADD COLUMN deletedTweetAt DATETIME;`,
          `ALTER TABLE tweet ADD COLUMN deletedRetweetAt DATETIME;`,
          `ALTER TABLE tweet ADD COLUMN deletedLikeAt DATETIME;`,
          `ALTER TABLE tweet ADD COLUMN deletedBookmarkAt DATETIME;`,
          `UPDATE tweet SET deletedTweetAt = deletedAt WHERE deletedAt IS NOT NULL AND isLiked = 0 AND text NOT LIKE 'RT @%';`,
          `UPDATE tweet SET deletedRetweetAt = deletedAt WHERE deletedAt IS NOT NULL AND isLiked = 0 AND text LIKE 'RT @%';`,
          `UPDATE tweet SET deletedLikeAt = deletedAt WHERE deletedAt IS NOT NULL AND isLiked = 1;`,
        ],
      },
      // Add tweet_bsky_migration table
      {
        name: "20250205_add_tweet_bsky_migration_table",
        sql: [
          `CREATE TABLE tweet_bsky_migration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tweetID TEXT NOT NULL,
    atprotoURI TEXT NOT NULL,
    atprotoCID TEXT NOT NULL,
    migratedAt DATETIME NOT NULL
);`,
        ],
      },
      // Add hasMedia to the tweet table, and create tweet_media table
      {
        name: "20250206_add_hasMedia_and_tweet_media",
        sql: [
          `CREATE TABLE tweet_media (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mediaID TEXT NOT NULL UNIQUE,
                        mediaType TEXT NOT NULL,
                        tweetID TEXT NOT NULL
                    );`,
          `ALTER TABLE tweet ADD COLUMN hasMedia BOOLEAN;`,
          `UPDATE tweet SET hasMedia = 0;`,
        ],
      },
      // Add isReply, replyTweetID, replyUserID, isQuote and quotedTweet to the tweet table
      {
        name: "20250206_add_reply_and_quote_fields",
        sql: [
          `ALTER TABLE tweet ADD COLUMN isReply BOOLEAN;`,
          `ALTER TABLE tweet ADD COLUMN replyTweetID TEXT;`,
          `ALTER TABLE tweet ADD COLUMN replyUserID TEXT;`,
          `ALTER TABLE tweet ADD COLUMN isQuote BOOLEAN;`,
          `ALTER TABLE tweet ADD COLUMN quotedTweet TEXT;`,
          `UPDATE tweet SET isReply = 0;`,
          `UPDATE tweet SET isQuote = 0;`,
        ],
      },
      // Add tweet_url table. Add url and indices to tweet_media table
      {
        name: "20250207_add_tweet_urls_and_more_tweet_media_fields",
        sql: [
          `CREATE TABLE tweet_url (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        url TEXT NOT NULL,
                        displayURL TEXT NOT NULL,
                        expandedURL TEXT NOT NULL,
                        startIndex INTEGER NOT NULL,
                        endIndex INTEGER NOT NULL,
                        tweetID TEXT NOT NULL,
                        UNIQUE(url, tweetID)
                    );`,
          `ALTER TABLE tweet_media ADD COLUMN url TEXT;`,
          `ALTER TABLE tweet_media ADD COLUMN filename TEXT;`,
          `ALTER TABLE tweet_media ADD COLUMN startIndex INTEGER;`,
          `ALTER TABLE tweet_media ADD COLUMN endIndex INTEGER;`,
        ],
      },
    ]);
    log.info("XAccountController.initDB: database initialized");
  }

  // Helper function to fetch tweets with media and URLs
  private fetchTweetsWithMediaAndURLs(
    whereClause: string,
    params: (string | number)[],
  ): XTweetItem[] {
    const query = `
            SELECT
                t.tweetID, t.text, t.likeCount, t.retweetCount, t.createdAt,
                tm.mediaType, tm.filename AS mediaFilename,
                tu.expandedURL AS urlExpanded
            FROM tweet t
            LEFT JOIN tweet_media tm ON t.tweetID = tm.tweetID
            LEFT JOIN tweet_url tu ON t.tweetID = tu.tweetID
            WHERE ${whereClause}
            ORDER BY t.createdAt ASC
        `;

    const rows = exec(this.db, query, params, "all") as {
      tweetID: string;
      text: string;
      likeCount: number;
      retweetCount: number;
      createdAt: string;
      mediaType: string | null;
      mediaFilename: string | null;
      urlExpanded: string | null;
    }[];

    // Group the results by tweetID
    const tweetMap: Record<string, XTweetItem> = {};
    for (const row of rows) {
      if (!tweetMap[row.tweetID]) {
        tweetMap[row.tweetID] = {
          id: row.tweetID,
          t: row.text ? row.text.replace(/(?:\r\n|\r|\n)/g, "<br>").trim() : "",
          l: row.likeCount,
          r: row.retweetCount,
          d: row.createdAt,
          i: [],
          v: [],
        };
      }

      // Add media files
      if (row.mediaType === "photo") {
        tweetMap[row.tweetID].i.push(row.mediaFilename!);
      } else if (row.mediaType === "video") {
        tweetMap[row.tweetID].v.push(row.mediaFilename!);
      }

      // Replace URLs in the text
      if (row.urlExpanded) {
        tweetMap[row.tweetID].t = tweetMap[row.tweetID].t.replace(
          row.urlExpanded,
          row.urlExpanded,
        );
      }
    }

    return Object.values(tweetMap);
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

  updateJob(job: XJob) {
    if (!this.db) {
      this.initDB();
    }

    exec(
      this.db,
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
    log.debug("XAccountController.indexTweetURL");

    // Loop over all URL items
    tweetLegacy.entities?.urls.forEach((url: XAPILegacyURL) => {
      // Make sure we have all of the URL information before importing
      if (
        !url["url"] ||
        !url["display_url"] ||
        !url["expanded_url"] ||
        !url["indices"]
      ) {
        return;
      }

      // Index url information in tweet_url table
      exec(
        this.db,
        "INSERT OR REPLACE INTO tweet_url (url, displayURL, expandedURL, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?)",
        [
          url["url"],
          url["display_url"],
          url["expanded_url"],
          url["indices"]?.[0],
          url["indices"]?.[1],
          tweetLegacy["id_str"],
        ],
      );
    });
  }

  async getImageDataURI(url: string): Promise<string> {
    if (!url) {
      return "";
    }
    try {
      const response = await fetch(url, {});
      if (!response.ok) {
        return "";
      }
      const buffer = await response.buffer();
      return `data:${response.headers.get("content-type")};base64,${buffer.toString("base64")}`;
    } catch {
      return "";
    }
  }

  async indexUser(user: XAPIUser) {
    log.debug("XAccountController.indexUser", user);
    if (!this.db) {
      this.initDB();
    }

    // Download the profile image
    const profileImageDataURI = user.profile_image_url_https
      ? await this.getImageDataURI(user.profile_image_url_https)
      : "";

    // Have we seen this user before?
    const existing: XUserRow[] = exec(
      this.db,
      "SELECT * FROM user WHERE userID = ?",
      [user.id_str],
      "all",
    ) as XUserRow[];
    if (existing.length > 0) {
      // Update the user
      exec(
        this.db,
        "UPDATE user SET name = ?, screenName = ?, profileImageDataURI = ? WHERE userID = ?",
        [user.name, user.screen_name, profileImageDataURI, user.id_str],
      );
    } else {
      // Add the user
      exec(
        this.db,
        "INSERT INTO user (userID, name, screenName, profileImageDataURI) VALUES (?, ?, ?, ?)",
        [user.id_str, user.name, user.screen_name, profileImageDataURI],
      );
    }

    // Update progress
    if (existing.length == 0) {
      this.progress.usersIndexed++;
    }
  }

  indexConversation(conversation: XAPIConversation) {
    log.debug("XAccountController.indexConversation", conversation);
    if (!this.db) {
      this.initDB();
    }

    // Have we seen this conversation before?
    const existing: XConversationRow[] = exec(
      this.db,
      "SELECT minEntryID, maxEntryID FROM conversation WHERE conversationID = ?",
      [conversation.conversation_id],
      "all",
    ) as XConversationRow[];
    if (existing.length > 0) {
      log.debug(
        "XAccountController.indexConversation: conversation already indexed, but needs to be updated",
        {
          oldMinEntryID: existing[0].minEntryID,
          oldMaxEntryID: existing[0].maxEntryID,
          newMinEntryID: conversation.min_entry_id,
          newMaxEntryID: conversation.max_entry_id,
        },
      );

      // Update the conversation
      exec(
        this.db,
        "UPDATE conversation SET sortTimestamp = ?, type = ?, minEntryID = ?, maxEntryID = ?, isTrusted = ?, updatedInDatabaseAt = ?, shouldIndexMessages = ?, deletedAt = NULL WHERE conversationID = ?",
        [
          conversation.sort_timestamp,
          conversation.type,
          conversation.min_entry_id,
          conversation.max_entry_id,
          conversation.trusted ? 1 : 0,
          new Date(),
          1,
          conversation.conversation_id,
        ],
      );
    } else {
      // Add the conversation
      exec(
        this.db,
        "INSERT INTO conversation (conversationID, type, sortTimestamp, minEntryID, maxEntryID, isTrusted, addedToDatabaseAt, shouldIndexMessages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          conversation.conversation_id,
          conversation.type,
          conversation.sort_timestamp,
          conversation.min_entry_id,
          conversation.max_entry_id,
          conversation.trusted ? 1 : 0,
          new Date(),
          1,
        ],
      );
    }

    // Delete participants
    exec(
      this.db,
      "DELETE FROM conversation_participant WHERE conversationID = ?",
      [conversation.conversation_id],
    );

    // Add the participants
    conversation.participants.forEach((participant) => {
      exec(
        this.db,
        "INSERT INTO conversation_participant (conversationID, userID) VALUES (?, ?)",
        [conversation.conversation_id, participant.user_id],
      );
    });

    // Update progress
    this.progress.conversationsIndexed++;
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

  async syncProgress(progressJSON: string) {
    this.progress = JSON.parse(progressJSON);
  }

  async resetRateLimitInfo(): Promise<void> {
    this.rateLimitInfo = emptyXRateLimitInfo();
  }

  async isRateLimited(): Promise<XRateLimitInfo> {
    return this.rateLimitInfo;
  }

  async getProgress(): Promise<XProgress> {
    return this.progress;
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

  async blueskyClientFromClientID(
    host: string,
    path: string,
  ): Promise<NodeOAuthClient> {
    const options: NodeOAuthClientFromMetadataOptions = {
      clientId: `https://${host}/${path}`,
      stateStore: {
        set: async (
          key: string,
          internalState: NodeSavedState,
        ): Promise<void> => {
          await this.setConfig(
            `blueskyStateStore-${key}`,
            JSON.stringify(internalState),
          );
        },
        get: async (key: string): Promise<NodeSavedState | undefined> => {
          const stateStore = await this.getConfig(`blueskyStateStore-${key}`);
          return stateStore ? JSON.parse(stateStore) : undefined;
        },
        del: async (key: string): Promise<void> => {
          await this.setConfig(`blueskyStateStore-${key}`, "");
        },
      },
      sessionStore: {
        set: async (sub: string, session: NodeSavedSession): Promise<void> => {
          await this.setConfig(
            `blueskySessionStore-${sub}`,
            JSON.stringify(session),
          );
        },
        get: async (sub: string): Promise<NodeSavedSession | undefined> => {
          const sessionStore = await this.getConfig(
            `blueskySessionStore-${sub}`,
          );
          return sessionStore ? JSON.parse(sessionStore) : undefined;
        },
        del: async (sub: string): Promise<void> => {
          await this.setConfig(`blueskySessionStore-${sub}`, "");
        },
      },
    };
    const clientMetadata = await NodeOAuthClient.fetchMetadata(options);
    return new NodeOAuthClient({ ...options, clientMetadata });
  }

  async blueskyInitClient(): Promise<NodeOAuthClient> {
    // Figure out the host and path
    let host;
    if (process.env.CYD_MODE === "prod") {
      host = "api.cyd.social";
    } else {
      host = "dev-api.cyd.social";
    }
    const path = "bluesky/client-metadata.json";

    // Create the client
    try {
      // Try creating a client
      return await this.blueskyClientFromClientID(host, path);
    } catch (e) {
      log.error(
        "XAccountController.blueskyInitClient: Error creating Bluesky client",
        e,
      );
      // On error, disconnect and delete old state and session data
      await this.blueskyDisconnect();

      // And try again
      return await this.blueskyClientFromClientID(host, path);
    }
  }

  async blueskyGetProfile(): Promise<BlueskyMigrationProfile | null> {
    if (!this.blueskyClient) {
      this.blueskyClient = await this.blueskyInitClient();
    }

    const did = await this.getConfig("blueskyDID");
    if (!did) {
      return null;
    }

    let session: OAuthSession;
    try {
      session = await this.blueskyClient.restore(did);
    } catch (e) {
      log.warn(
        "XAccountController.blueskyGetProfile: Failed to restore session",
        e,
      );
      return null;
    }
    const agent = new Agent(session);
    if (!agent.did) {
      return null;
    }

    const profile = await agent.getProfile({ actor: agent.did });
    const blueskyMigrationProfile: BlueskyMigrationProfile = {
      did: profile.data.did,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
    };
    return blueskyMigrationProfile;
  }

  async blueskyAuthorize(handle: string): Promise<boolean | string> {
    // Initialize the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.blueskyInitClient();
    }

    try {
      // Check if the handle starts with @. If so, strip the @ and try authorizing
      if (handle.startsWith("@")) {
        handle = handle.substring(1);
      }

      // Authorize the handle
      const url = await this.blueskyClient.authorize(handle);

      // Save the account ID in the global config
      await globalSetConfig("blueskyOAuthAccountID", this.accountID.toString());

      // Open the URL in the default browser
      await shell.openExternal(url.toString());

      return true;
    } catch (e: unknown) {
      if (e instanceof Error) {
        log.error(
          "XAccountController.blueskyAuthorize: Error authorizing Bluesky client",
          e,
        );
        return e.message;
      } else {
        log.error("XAccountController.blueskyAuthorize: Unknown error", e);
        return String(e);
      }
    }
  }

  async blueskyCallback(queryString: string): Promise<boolean | string> {
    // Initialize the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.blueskyInitClient();
    }

    const params = new URLSearchParams(queryString);

    // Handle errors
    const error = params.get("error");
    const errorDescription = params.get("error_description");
    if (errorDescription) {
      return errorDescription;
    }
    if (error) {
      return `The authorization failed with error: ${error}`;
    }

    // Finish the callback
    const { session, state } = await this.blueskyClient.callback(params);

    log.info(
      "XAccountController.blueskyCallback: authorize() was called with state",
      state,
    );
    log.info(
      "XAccountController.blueskyCallback: user authenticated as",
      session.did,
    );

    // Save the did
    await this.setConfig("blueskyDID", session.did);

    const agent = new Agent(session);
    if (agent.did) {
      // Make Authenticated API calls
      const profile = await agent.getProfile({ actor: agent.did });
      log.info("Bluesky profile:", profile.data);

      return true;
    } else {
      return "agent.did is null";
    }
  }

  async blueskyDisconnect(): Promise<void> {
    // Revoke the session
    try {
      if (!this.blueskyClient) {
        this.blueskyClient = await this.blueskyInitClient();
      }
      const did = await this.getConfig("blueskyDID");
      if (did) {
        const session = await this.blueskyClient.restore(did);
        await session.signOut();
      }
    } catch (e) {
      log.error(
        "XAccountController.blueskyDisconnect: Error revoking session",
        e,
      );
    }

    // Delete from global config
    await globalDeleteConfig("blueskyOAuthAccountID");

    // Delete from account config
    await this.deleteConfig("blueskyDID");
    await this.deleteConfigLike("blueskyStateStore-%");
    await this.deleteConfigLike("blueskySessionStore-%");
  }

  async blueskyGetTweetCounts(): Promise<XMigrateTweetCounts> {
    if (!this.db) {
      this.initDB();
    }
    if (!this.account) {
      throw new Error("Account not found");
    }

    const username = this.account.username;
    const userID = this.account.userID;

    // Total tweets count
    const totalTweets: Sqlite3Count = exec(
      this.db,
      `
            SELECT COUNT(*) AS count
            FROM tweet
            WHERE tweet.isLiked = ?
            AND tweet.username = ?
            AND tweet.deletedTweetAt IS NULL
        `,
      [0, username],
      "get",
    ) as Sqlite3Count;

    // Total retweets count
    const totalRetweets: Sqlite3Count = exec(
      this.db,
      `
            SELECT COUNT(*) AS count
            FROM tweet
            WHERE tweet.text LIKE ?
            AND tweet.isLiked = ?
            AND tweet.username = ?
            AND tweet.deletedTweetAt IS NULL
        `,
      ["RT @%", 0, username],
      "get",
    ) as Sqlite3Count;

    // Tweets to migrate (including deleted tweets)
    const toMigrateTweets = this.fetchTweetsWithMediaAndURLs(
      `
            t.text NOT LIKE ?
            AND t.isLiked = ?
            AND t.username = ?
            AND t.tweetID NOT IN (SELECT tweetID FROM tweet_bsky_migration)
            AND (t.isReply = ? OR (t.isReply = ? AND t.replyUserID = ?))
        `,
      ["RT @%", 0, username, 0, 1, userID],
    );

    // Tweets that cannot be migrated
    const cannotMigrate: Sqlite3Count = exec(
      this.db,
      `
            SELECT COUNT(*) AS count
            FROM tweet
            LEFT JOIN tweet_bsky_migration ON tweet.tweetID = tweet_bsky_migration.tweetID
            WHERE tweet_bsky_migration.tweetID IS NULL
            AND tweet.text NOT LIKE ?
            AND tweet.isLiked = ?
            AND tweet.username = ?
            AND (tweet.isReply = ? AND tweet.replyUserID != ?)
        `,
      ["RT @%", 0, username, 1, userID],
      "get",
    ) as Sqlite3Count;

    // Already migrated tweets (including deleted ones)
    const alreadyMigratedTweets = this.fetchTweetsWithMediaAndURLs(
      `
            t.text NOT LIKE ?
            AND t.isLiked = ?
            AND t.username = ?
            AND t.tweetID IN (SELECT tweetID FROM tweet_bsky_migration)
        `,
      ["RT @%", 0, username],
    );

    // Return the counts
    const resp: XMigrateTweetCounts = {
      totalTweetsCount: totalTweets.count,
      totalRetweetsCount: totalRetweets.count,
      toMigrateTweets,
      cannotMigrateCount: cannotMigrate.count,
      alreadyMigratedTweets,
    };

    log.info("XAccountController.blueskyGetTweetCounts: returning", resp);
    return resp;
  }

  async blueskyMigrateTweetBuildRecord(
    agent: Agent,
    tweetID: string,
  ): Promise<[BskyPostRecord, string] | string> {
    // In case the tweet needs to be split into multiple posts, this is the text of the second post
    let nextPostText = "";

    // Select the tweet
    let tweet: XTweetRow;
    try {
      tweet = exec(
        this.db,
        `
                SELECT *
                FROM tweet
                WHERE tweetID = ?
            `,
        [tweetID],
        "get",
      ) as XTweetRow;
    } catch (e) {
      return `Error selecting tweet: ${e}`;
    }

    // Start building the tweet text and facets
    let text = tweet.text;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facets: any[] = [];

    // Replace t.co links with actual links
    let tweetURLs: XTweetURLRow[];
    try {
      tweetURLs = exec(
        this.db,
        `
                SELECT *
                FROM tweet_url
                WHERE tweetID = ?
            `,
        [tweetID],
        "all",
      ) as XTweetURLRow[];
    } catch (e) {
      return `Error selecting tweet URLs: ${e}`;
    }
    for (const tweetURL of tweetURLs) {
      text = text.replace(tweetURL.url, tweetURL.expandedURL);
    }

    // Handle replies
    const userID = this.account?.userID;
    let reply = null;
    if (tweet.isReply && tweet.replyUserID == userID) {
      // Find the parent tweet migration
      let parentMigration: XTweetBlueskyMigrationRow;
      try {
        parentMigration = exec(
          this.db,
          `
                    SELECT *
                    FROM tweet_bsky_migration
                    WHERE tweetID = ?
                `,
          [tweet.replyTweetID],
          "get",
        ) as XTweetBlueskyMigrationRow;
      } catch (e) {
        return `Error selecting parent migration: ${e}`;
      }
      if (parentMigration) {
        // Find the root tweet in the thread
        let foundRoot = false;
        let rootTweetID = tweet.replyTweetID;
        while (!foundRoot) {
          let parentTweet: XTweetRow;
          try {
            parentTweet = exec(
              this.db,
              `
                            SELECT *
                            FROM tweet
                            WHERE tweetID = ?
                        `,
              [rootTweetID],
              "get",
            ) as XTweetRow;
          } catch (e) {
            return `Error selecting parent tweet: ${e}`;
          }
          if (
            parentTweet &&
            parentTweet.isReply &&
            parentTweet.replyUserID == userID
          ) {
            rootTweetID = parentTweet.replyTweetID;
          } else {
            foundRoot = true;
          }
        }

        if (foundRoot) {
          // Get the root migration
          let rootMigration: XTweetBlueskyMigrationRow;
          try {
            rootMigration = exec(
              this.db,
              `
                            SELECT *
                            FROM tweet_bsky_migration
                            WHERE tweetID = ?
                        `,
              [rootTweetID],
              "get",
            ) as XTweetBlueskyMigrationRow;
          } catch (e) {
            return `Error selecting root migration: ${e}`;
          }
          if (rootMigration) {
            // Build the reply
            reply = {
              root: {
                uri: rootMigration.atprotoURI,
                cid: rootMigration.atprotoCID,
              },
              parent: {
                uri: parentMigration.atprotoURI,
                cid: parentMigration.atprotoCID,
              },
            };
          }
        }
      }
    }

    // Handle quotes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let embed: any = null;
    if (tweet.isQuote && tweet.quotedTweet) {
      // Parse the quoted tweet URL to see if it's a self-quote
      // URL looks like: https://twitter.com/{username}/status/{tweetID}
      const quotedTweetURL = new URL(tweet.quotedTweet);
      const quotedTweetUsername = quotedTweetURL.pathname.split("/")[1];
      const quotedTweetID = quotedTweetURL.pathname.split("/")[3];

      // Self quote
      if (quotedTweetUsername == this.account?.username) {
        // Load the quoted tweet migration
        let quotedMigration: XTweetBlueskyMigrationRow;
        try {
          quotedMigration = exec(
            this.db,
            `
                        SELECT *
                        FROM tweet_bsky_migration
                        WHERE tweetID = ?
                    `,
            [quotedTweetID],
            "get",
          ) as XTweetBlueskyMigrationRow;
        } catch (e) {
          return `Error selecting quoted migration: ${e}`;
        }
        if (quotedMigration) {
          embed = {
            $type: "app.bsky.embed.record",
            record: {
              uri: quotedMigration.atprotoURI,
              cid: quotedMigration.atprotoCID,
            },
          };
        }
      }

      // External quote? Make it a website card
      if (!embed) {
        embed = {
          $type: "app.bsky.embed.external",
          external: {
            uri: tweet.quotedTweet,
            title: "Quoted Tweet on X",
            description: `View tweet at ` + quotedTweetURL,
          },
        };
      }
    }

    // Handle media
    let tweetMedia: XTweetMediaRow[];
    try {
      tweetMedia = exec(
        this.db,
        `
                SELECT *
                FROM tweet_media
                WHERE tweetID = ?
            `,
        [tweetID],
        "all",
      ) as XTweetMediaRow[];
    } catch (e) {
      return `Error selecting tweet media: ${e}`;
    }

    // Check if we have any video or animated_gif media
    const videoMedia = tweetMedia.find(
      (media) =>
        media.mediaType === "video" || media.mediaType === "animated_gif",
    );

    if (videoMedia) {
      // Video media (Bluesky only supports one video per post, so use the first one)
      const allVideoMedia = tweetMedia.filter(
        (media) =>
          media.mediaType === "video" || media.mediaType === "animated_gif",
      );
      if (allVideoMedia.length > 1) {
        log.warn(
          `XAccountController.blueskyMigrateTweetBuildRecord: Tweet has ${allVideoMedia.length} videos/animated GIFs, but Bluesky only supports 1. Using the first one: ${videoMedia.filename}`,
        );
      }

      // max size for videos: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/video.json
      const maxSize = 50000000;

      // Load the video (use first video/animated_gif found)
      const outputPath = await this.getMediaPath();
      const mediaPath = path.join(outputPath, videoMedia.filename);
      let mediaData;
      try {
        mediaData = fs.readFileSync(mediaPath);
      } catch (e) {
        return `Error reading media file: ${e}`;
      }

      let shouldContinue = true;

      // Make sure it's not too big
      if (mediaData.length > maxSize) {
        log.warn(
          `XAccountController.blueskyMigrateTweetBuildRecord: media file too large: ${videoMedia.filename}`,
        );
        shouldContinue = false;
      }

      if (shouldContinue) {
        // Determine the MIME type
        let mimeType = mime.lookup(mediaPath);
        if (mimeType == "application/mp4") {
          mimeType = "video/mp4";
        }
        if (!mimeType) {
          log.warn(
            `XAccountController.blueskyMigrateTweetBuildRecord: could not determine MIME type for media file: ${videoMedia.filename}`,
          );
          shouldContinue = false;
        }
        if (mimeType != "video/mp4") {
          log.warn(
            `XAccountController.blueskyMigrateTweetBuildRecord: video file is not mp4: ${videoMedia.filename} (mime type is ${mimeType})`,
          );
          shouldContinue = false;
        }
      }

      if (shouldContinue) {
        // Upload the video
        log.info(
          `XAccountController.blueskyMigrateTweetBuildRecord: uploading video ${videoMedia.filename}`,
        );
        const resp = await agent.uploadBlob(mediaData, {
          encoding: "video/mp4",
        });
        log.info(
          `XAccountController.blueskyMigrateTweetBuildRecord: uploaded video ${videoMedia.filename} response`,
          resp,
        );
        const videoBlob: BlobRef = resp.data.blob;

        // Remove the link from the tweet text
        text = text.replace(videoMedia.url, "");
        text = text.trim();

        // If there's already an embedded record, turn it into a recordWithMedia embed
        if (embed && embed["$type"] == "app.bsky.embed.record") {
          embed = {
            $type: "app.bsky.embed.recordWithMedia",
            record: embed,
            media: {
              $type: "app.bsky.embed.video",
              video: videoBlob,
            },
          };
        } else {
          // If there's an embedded external link, turn it into a facet
          if (
            embed &&
            embed["$type"] == "app.bsky.embed.external" &&
            embed.external?.uri
          ) {
            text += ` ${embed.external.uri}`;
            facets.push({
              index: {
                byteStart: text.length - embed.external.uri.length,
                byteEnd: text.length,
              },
              features: [
                {
                  $type: "app.bsky.richtext.facet#link",
                  uri: embed.external.uri,
                },
              ],
            });
          }

          // Embed the video
          embed = {
            $type: "app.bsky.embed.video",
            video: videoBlob,
          };
        }
      }
    }

    // Handle remaining non-video media as images
    const imageMedia = tweetMedia.filter(
      (media) =>
        media.mediaType !== "video" && media.mediaType !== "animated_gif",
    );

    if (imageMedia.length > 0) {
      // Images media
      // max size for images: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/embed/images.json
      const maxSize = 1000000;

      // Keep track of images for the embed
      const images: {
        alt: string;
        image: BlobRef;
        aspectRatio?: {
          width: number;
          height: number;
        };
      }[] = [];

      for (const media of imageMedia) {
        // Load the image
        const outputPath = await this.getMediaPath();
        const mediaPath = path.join(outputPath, media.filename);
        let mediaData;
        try {
          mediaData = fs.readFileSync(mediaPath);
        } catch (e) {
          return `Error reading media file: ${e}`;
        }

        // Make sure it's not too big
        if (mediaData.length > maxSize) {
          log.warn(
            `XAccountController.blueskyMigrateTweetBuildRecord: media file too large: ${media.filename}`,
          );
          continue;
        }

        // Determine the MIME type
        const mimeType = mime.lookup(mediaPath);
        if (!mimeType) {
          log.warn(
            `XAccountController.blueskyMigrateTweetBuildRecord: could not determine MIME type for media file: ${media.filename}`,
          );
          continue;
        }

        // Determine the aspect ratio
        const dimensions = await getImageDimensions(mediaPath);

        // Upload the image
        log.info(
          `XAccountController.blueskyMigrateTweetBuildRecord: uploading image ${media.filename}`,
        );
        const resp = await agent.uploadBlob(mediaData, { encoding: mimeType });
        log.info(
          `XAccountController.blueskyMigrateTweetBuildRecord: uploaded image ${media.filename} response`,
          resp,
        );

        // Add it to the list
        images.push({
          alt: "",
          image: resp.data.blob,
          aspectRatio: {
            width: dimensions?.width || 1,
            height: dimensions?.height || 1,
          },
        });

        // Remove the link from the tweet text
        text = text.replace(media.url, "");
        text = text.trim();
      }

      // If there's already an embedded record, turn it into a recordWithMedia embed
      if (embed && embed["$type"] == "app.bsky.embed.record") {
        embed = {
          $type: "app.bsky.embed.recordWithMedia",
          record: embed,
          media: {
            $type: "app.bsky.embed.images",
            images: images,
          },
        };
      } else {
        // If there's an embedded external link, turn it into a facet
        if (
          embed &&
          embed["$type"] == "app.bsky.embed.external" &&
          embed.external?.uri
        ) {
          text += ` ${embed.external.uri}`;
          facets.push({
            index: {
              byteStart: text.length - embed.external.uri.length,
              byteEnd: text.length,
            },
            features: [
              {
                $type: "app.bsky.richtext.facet#link",
                uri: embed.external.uri,
              },
            ],
          });
        }

        // Embed the images
        embed = {
          $type: "app.bsky.embed.images",
          images: images,
        };
      }
    }

    // Start a richtext object
    let rt = new RichText({
      text: text,
      facets: facets,
    });
    await rt.detectFacets(agent);

    // Is it too long?
    if (rt.graphemeLength > 300) {
      // If it's too long, fall back to t.co links because they're shortened
      text = tweet.text;
      for (const tweetURL of tweetURLs) {
        text = text.replace(tweetURL.expandedURL, tweetURL.url);
      }

      // Update the richtext object
      rt = new RichText({
        text: text,
        facets: facets,
      });
      await rt.detectFacets(agent);
    }

    // Is it STILL too long?
    if (rt.graphemeLength > 300) {
      // Make the links longer again because why not
      text = tweet.text;
      for (const tweetURL of tweetURLs) {
        text = text.replace(tweetURL.url, tweetURL.expandedURL);
      }

      // Split the text into words
      const words = text.split(" ");

      // Initialize the new text and nextText
      let newText = "";
      const continuationText = " (...)";

      // Iterate through the words to build the new text
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if ((newText + " " + word + continuationText).length <= 300) {
          newText += (newText ? " " : "") + word;
        } else {
          nextPostText = words.slice(i).join(" ");
          break;
        }
      }

      // Append the continuation text
      newText += continuationText;

      // Update the text and nextText variables
      text = newText;
      rt = new RichText({
        text: text,
        facets: facets,
      });
      await rt.detectFacets(agent);
    }

    // Build the record
    const record: BskyPostRecord = {
      $type: "app.bsky.feed.post",
      text: rt.text,
      facets: rt.facets,
      createdAt: tweet.createdAt,
    };
    if (reply) {
      record["reply"] = reply;
    }
    if (embed) {
      record["embed"] = embed;
    }
    return [record, nextPostText];
  }

  handleBlueskyAPIError(e: unknown, method: string, message: string): string {
    if (isBlueskyAPIError(e)) {
      const error = e as BlueskyAPIError;
      if (error.error == "RateLimitExceeded") {
        log.error(
          `XAccountController.${method}: Rate limit exceeded`,
          JSON.stringify(e),
        );
        this.rateLimitInfo.isRateLimited = true;
        this.rateLimitInfo.rateLimitReset = Number(
          error.headers["ratelimit-reset"],
        );
        return `RateLimitExceeded`;
      } else {
        log.error(
          `XAccountController.${method}: Bluesky error`,
          JSON.stringify(e),
        );
        return `${message}: ${e}`;
      }
    }

    log.error(`XAccountController.${method}: ${message}`, e);
    return `${message}: ${e}`;
  }

  // Return true on success, and a string (error message) on error
  async blueskyMigrateTweet(tweetID: string): Promise<boolean | string> {
    if (!this.db) {
      this.initDB();
    }
    if (!this.account) {
      throw new Error("Account not found");
    }

    // Get the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.blueskyInitClient();
    }
    const did = await this.getConfig("blueskyDID");
    if (!did) {
      return "Bluesky DID not found";
    }
    const session = await this.blueskyClient.restore(did);
    const agent: Agent = new Agent(session);

    // Build the record
    let resp: [BskyPostRecord, string] | string;
    try {
      resp = await this.blueskyMigrateTweetBuildRecord(agent, tweetID);
    } catch (e) {
      return this.handleBlueskyAPIError(
        e,
        "blueskyMigrateTweetBuildRecord",
        `Error building atproto record`,
      );
    }
    if (typeof resp === "string") {
      return resp;
    }
    const [record, nextPostText] = resp;

    try {
      // Post it to Bluesky
      const { uri, cid } = await agent.post(record);

      // Do we need to post a continuation?
      if (nextPostText != "") {
        let rootURI;
        let rootCID;
        if (record.reply) {
          rootURI = record.reply.root.uri;
          rootCID = record.reply.root.cid;
        } else {
          rootURI = uri;
          rootCID = cid;
        }

        // Build the rich text
        const rt = new RichText({
          text: nextPostText,
        });
        await rt.detectFacets(agent);

        // Build the record
        const continuationRecord: BskyPostRecord = {
          $type: "app.bsky.feed.post",
          text: rt.text,
          facets: rt.facets,
          createdAt: record.createdAt,
          reply: {
            root: {
              uri: rootURI,
              cid: rootCID,
            },
            parent: {
              uri: uri,
              cid: cid,
            },
          },
        };

        // Post it to Bluesky
        try {
          const { uri: continuationURI, cid: continuationCID } =
            await agent.post(continuationRecord);

          // Record that we migrated this tweet
          try {
            exec(
              this.db,
              `
                        INSERT INTO tweet_bsky_migration (tweetID, atprotoURI, atprotoCID, migratedAt)
                        VALUES (?, ?, ?, ?)
                    `,
              [tweetID, continuationURI, continuationCID, new Date()],
            );
          } catch (e) {
            return `Error recording migration: ${e}`;
          }
        } catch (e) {
          return this.handleBlueskyAPIError(
            e,
            "blueskyMigrateTweet",
            `Error migrating continuation tweet to Bluesky`,
          );
        }
      }

      // Record that we migrated this tweet
      try {
        exec(
          this.db,
          `
                    INSERT INTO tweet_bsky_migration (tweetID, atprotoURI, atprotoCID, migratedAt)
                    VALUES (?, ?, ?, ?)
                `,
          [tweetID, uri, cid, new Date()],
        );
      } catch (e) {
        return `Error recording migration: ${e}`;
      }

      return true;
    } catch (e) {
      return this.handleBlueskyAPIError(
        e,
        "blueskyMigrateTweet",
        `Error migrating tweet to Bluesky`,
      );
    }
  }

  async blueskyDeleteMigratedTweet(tweetID: string): Promise<boolean | string> {
    if (!this.db) {
      this.initDB();
    }
    if (!this.account) {
      throw new Error("Account not found");
    }

    // Get the Bluesky client
    if (!this.blueskyClient) {
      this.blueskyClient = await this.blueskyInitClient();
    }
    const did = await this.getConfig("blueskyDID");
    if (!did) {
      return "Bluesky DID not found";
    }
    const session = await this.blueskyClient.restore(did);
    const agent = new Agent(session);

    // Select the migration record
    const migration: XTweetBlueskyMigrationRow = exec(
      this.db,
      `
            SELECT *
            FROM tweet_bsky_migration
            WHERE tweetID = ?
        `,
      [tweetID],
      "get",
    ) as XTweetBlueskyMigrationRow;

    try {
      // Delete it from Bluesky
      await agent.deletePost(migration.atprotoURI);

      try {
        // Delete the migration record
        exec(
          this.db,
          `
                    DELETE FROM tweet_bsky_migration WHERE tweetID = ?
                `,
          [tweetID],
        );
      } catch (e) {
        return `Error deleting migration record: ${e}`;
      }

      return true;
    } catch (e) {
      return this.handleBlueskyAPIError(
        e,
        "blueskyDeleteMigratedTweet",
        `Error deleting from Bluesky`,
      );
    }
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
