import path from 'path'
import fs from 'fs'
import os from 'os'

import fetch from 'node-fetch';
import unzipper from 'unzipper';

import { app, session } from 'electron'
import log from 'electron-log/main';
import Database from 'better-sqlite3'
import { glob } from 'glob';

import {
    getResourcesPath,
    getAccountDataPath,
    getTimestampDaysAgo
} from '../util'
import {
    XAccount,
    XJob,
    XProgress, emptyXProgress,
    XTweetItemArchive,
    XArchiveStartResponse, emptyXArchiveStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XIndexMessagesStartResponse,
    XDeleteTweetsStartResponse,
    XProgressInfo, emptyXProgressInfo,
    ResponseData,
    XDatabaseStats, emptyXDatabaseStats,
    XDeleteReviewStats, emptyXDeleteReviewStats,
    XImportArchiveResponse
} from '../shared_types'
import {
    runMigrations,
    getAccount,
    saveXAccount,
    exec,
    Sqlite3Count,
    getConfig,
    setConfig,
} from '../database'
import { IMITMController } from '../mitm';
import {
    XJobRow,
    XTweetRow,
    XTweetMediaRow,
    XTweetURLRow,
    XUserRow,
    XConversationRow,
    XMessageRow,
    XConversationParticipantRow,
    convertXJobRowToXJob,
    convertTweetRowToXTweetItem,
    convertTweetRowToXTweetItemArchive,
    // X API types
    XAPILegacyUser,
    XAPILegacyTweet,
    XAPILegacyTweetMedia,
    XAPILegacyTweetMediaVideoVariant,
    XAPILegacyURL,
    XAPIData,
    XAPIBookmarksData,
    XAPITimeline,
    XAPIInboxTimeline,
    XAPIInboxInitialState,
    XAPIConversation,
    XAPIConversationTimeline,
    XAPIMessage,
    XAPIUser,
    XAPIAll,
    XArchiveAccount,
    XArchiveTweet,
    XArchiveTweetContainer,
    isXArchiveTweetContainer,
    XArchiveLike,
    XArchiveLikeContainer,
    isXArchiveLikeContainer,
    isXAPIBookmarksData,
    isXAPIData,
} from './types'
import * as XArchiveTypes from '../../archive-static-sites/x-archive/src/types';

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

    private cookies: Record<string, string> = {};

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
                    this.rateLimitInfo.rateLimitReset = Number(details.responseHeaders['x-rate-limit-reset']);
                } else {
                    // If we can't get it from the headers, set it to 15 minutes from now
                    this.rateLimitInfo.rateLimitReset = Math.floor(Date.now() / 1000) + 900;
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
            if (details.url.startsWith("https://x.com/") && details.requestHeaders) {
                const cookieHeader = details.requestHeaders['Cookie'];
                if (cookieHeader) {
                    const cookies = cookieHeader.split(';');
                    cookies.forEach((cookie) => {
                        const parts = cookie.split('=');
                        if (parts.length == 2) {
                            this.cookies[parts[0].trim()] = parts[1].trim();
                        }
                    });
                }
            }
        });
    }

    cleanup() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    refreshAccount() {
        // Load the account
        const account = getAccount(this.accountID);
        if (!account) {
            log.error(`XAccountController.refreshAccount: account ${this.accountID} not found`);
            return;
        }

        // Make sure it's an X account
        if (account.type != "X") {
            log.error(`XAccountController.refreshAccount: account ${this.accountID} is not an X account`);
            return;
        }

        // Get the account UUID
        this.accountUUID = account.uuid;
        log.debug(`XAccountController.refreshAccount: accountUUID=${this.accountUUID}`);

        // Load the X account
        this.account = account.xAccount;
        if (!this.account) {
            log.error(`XAccountController.refreshAccount: xAccount ${this.accountID} not found`);
            return;
        }
    }

    initDB() {
        if (!this.account || !this.account.username) {
            log.error("XAccountController: cannot initialize the database because the account is not found, or the account username is not found", this.account, this.account?.username);
            return;
        }

        // Make sure the account data folder exists
        this.accountDataPath = getAccountDataPath('X', this.account.username);
        log.info(`XAccountController.initDB: accountDataPath=${this.accountDataPath}`);

        // Open the database
        this.db = new Database(path.join(this.accountDataPath, 'data.sqlite3'), {});
        this.db.pragma('journal_mode = WAL');
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
);`, `CREATE TABLE tweet (
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
);`, `CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userID TEXT NOT NULL UNIQUE,
    name TEXT,
    screenName TEXT NOT NULL,
    profileImageDataURI TEXT
);`, `CREATE TABLE conversation (
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
);`, `CREATE TABLE conversation_participant (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationID TEXT NOT NULL,
    userID TEXT NOT NULL
);`, `CREATE TABLE message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    messageID TEXT NOT NULL UNIQUE,
    conversationID TEXT NOT NULL,
    createdAt DATETIME NOT NULL,
    senderID TEXT NOT NULL,
    text TEXT NOT NULL,
    deletedAt DATETIME
);`
                ]
            },
            // Add the config table
            {
                name: "20241016_add_config",
                sql: [
                    `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`
                ]
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
                    `ALTER TABLE tweet_new RENAME TO tweet;`
                ]
            },
            // Add isBookmarked to the tweet table, and update isBookarked for all tweets
            {
                name: "20241127_add_isBookmarked",
                sql: [
                    `ALTER TABLE tweet ADD COLUMN isBookmarked BOOLEAN;`,
                    `UPDATE tweet SET isBookmarked = 0;`
                ]
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
                    `UPDATE tweet SET deletedLikeAt = deletedAt WHERE deletedAt IS NOT NULL AND isLiked = 1;`
                ]
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
                    `UPDATE tweet SET hasMedia = 0;`
                ]
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
                    `UPDATE tweet SET isQuote = 0;`
                ]
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
                    `ALTER TABLE tweet_media ADD COLUMN endIndex INTEGER;`
                ]
            },
        ])
        log.info("XAccountController.initDB: database initialized");
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
        exec(this.db, "UPDATE job SET status = ? WHERE status = ?", ["canceled", "pending"]);

        // Create new pending jobs
        jobTypes.forEach((jobType) => {
            exec(this.db, 'INSERT INTO job (jobType, status, scheduledAt) VALUES (?, ?, ?)', [
                jobType,
                'pending',
                new Date(),
            ]);
        });

        // Select pending jobs
        const jobs: XJobRow[] = exec(this.db, "SELECT * FROM job WHERE status = ? ORDER BY id", ["pending"], "all") as XJobRow[];
        return jobs.map(convertXJobRowToXJob);
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
            'SELECT * FROM job WHERE jobType = ? AND status = ? AND finishedAt IS NOT NULL ORDER BY finishedAt DESC LIMIT 1',
            [jobType, "finished"],
            "get"
        ) as XJobRow | null;
        if (job) {
            return convertXJobRowToXJob(job);
        }
        return null;
    }

    updateJob(job: XJob) {
        if (!this.db) {
            this.initDB();
        }

        exec(
            this.db,
            'UPDATE job SET status = ?, startedAt = ?, finishedAt = ?, progressJSON = ?, error = ? WHERE id = ?',
            [job.status, job.startedAt ? job.startedAt : null, job.finishedAt ? job.finishedAt : null, job.progressJSON, job.error, job.id]
        );
    }

    async indexStart() {
        const ses = session.fromPartition(`persist:account-${this.accountID}`);
        await ses.clearCache();
        await this.mitmController.startMonitoring();
        await this.mitmController.startMITM(ses, ["x.com/i/api/graphql", "x.com/i/api/1.1/dm", "x.com/i/api/2/notifications/all.json"]);
        this.thereIsMore = true;
    }

    async indexStop() {
        await this.mitmController.stopMonitoring();
        const ses = session.fromPartition(`persist:account-${this.accountID}`);
        await this.mitmController.stopMITM(ses);
    }

    // Parse all.json and returns stats about the user
    async indexParseAllJSON(): Promise<XAccount> {
        if (!this.account) {
            throw new Error("XAccountController.indexParseAllJSON: account not found");
        }

        await this.mitmController.clearProcessed();
        log.info(`XAccountController.indexParseAllJSON: parsing ${this.mitmController.responseData.length} responses`);

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            const responseData = this.mitmController.responseData[i];
            log.info('XAccountController.indexParseAllJSON: processing', responseData.url);

            if (responseData.processed) {
                continue;
            }

            if (
                responseData.url.includes("/i/api/2/notifications/all.json?") &&
                responseData.status == 200
            ) {
                const body: XAPIAll = JSON.parse(responseData.body);
                if (!body.globalObjects || !body.globalObjects.users) {
                    continue;
                }

                // Loop through the users
                Object.values(body.globalObjects.users).forEach((user: XAPIUser) => {
                    // If it's the logged in user, get the stats
                    if (user.screen_name == this.account?.username) {
                        // Update the account
                        this.account.followingCount = user.friends_count;
                        this.account.followersCount = user.followers_count;
                        this.account.tweetsCount = user.statuses_count;
                        this.account.likesCount = user.favourites_count;
                        log.info('XAccountController.indexParseAllJSON: found the following data', {
                            followingCount: this.account.followingCount,
                            followersCount: this.account.followersCount,
                            tweetsCount: this.account.tweetsCount,
                            likesCount: this.account.likesCount
                        });
                        saveXAccount(this.account);
                    }
                });
            }

            this.mitmController.responseData[i].processed = true;
            log.info('XAccountController.indexParseAllJSON: processed', i);
        }

        return this.account;
    }

    indexTweet(responseIndex: number, userLegacy: XAPILegacyUser, tweetLegacy: XAPILegacyTweet) {
        if (!this.db) {
            this.initDB();
        }

        // Have we seen this tweet before?
        const existing: XTweetRow[] = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweetLegacy["id_str"]], "all") as XTweetRow[];
        if (existing.length > 0) {
            // Delete it, so we can re-add it
            exec(this.db, 'DELETE FROM tweet WHERE tweetID = ?', [tweetLegacy["id_str"]]);
        }

        // Check if tweet has media and call indexTweetMedia
        let hasMedia: boolean = false;
        if (tweetLegacy["entities"]["media"] && tweetLegacy["entities"]["media"].length) {
            hasMedia = true;
            this.indexTweetMedia(tweetLegacy)
        }

        // Check if tweet has URLs and index it
        if (tweetLegacy["entities"]["urls"] && tweetLegacy["entities"]["urls"].length) {
            this.indexTweetURLs(tweetLegacy)
        }

        // Add the tweet
        exec(this.db, 'INSERT INTO tweet (username, tweetID, conversationID, createdAt, likeCount, quoteCount, replyCount, retweetCount, isLiked, isRetweeted, isBookmarked, text, path, hasMedia, isReply, replyTweetID, replyUserID, isQuote, quotedTweet, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            userLegacy["screen_name"],
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
            `${userLegacy['screen_name']}/status/${tweetLegacy['id_str']}`,
            hasMedia ? 1 : 0,
            tweetLegacy["in_reply_to_status_id_str"] ? 1 : 0,
            tweetLegacy["in_reply_to_status_id_str"],
            tweetLegacy["in_reply_to_user_id_str"],
            tweetLegacy["is_quote_status"] ? 1 : 0,
            tweetLegacy["quoted_status_permalink"] ? tweetLegacy["quoted_status_permalink"]["expanded"] : null,
            new Date(),
        ]);

        // Update progress
        if (tweetLegacy["favorited"]) {
            // console.log("DEBUG-### LIKE: ", tweetLegacy["id_str"], userLegacy["screen_name"], tweetLegacy["full_text"]);
            this.progress.likesIndexed++;
        }
        if (tweetLegacy["bookmarked"]) {
            this.progress.bookmarksIndexed++;
        }
        if (tweetLegacy["full_text"].startsWith("RT @")) {
            // console.log("DEBUG-### RETWEET: ", tweetLegacy["id_str"], userLegacy["screen_name"], tweetLegacy["full_text"]);
            this.progress.retweetsIndexed++;
        }
        if (userLegacy["screen_name"] == this.account?.username && !tweetLegacy["full_text"].startsWith("RT @")) {
            // console.log("DEBUG-### TWEET: ", tweetLegacy["id_str"], userLegacy["screen_name"], tweetLegacy["full_text"]);
            this.progress.tweetsIndexed++;
        }
        if (!tweetLegacy["favorited"] && !tweetLegacy["bookmarked"] && !tweetLegacy["full_text"].startsWith("RT @") && userLegacy["screen_name"] != this.account?.username) {
            // console.log("DEBUG-### UNKNOWN: ", tweetLegacy["id_str"], userLegacy["screen_name"], tweetLegacy["full_text"]);
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
            log.warn('XAccountController.indexParseTweetsResponseData: RATE LIMITED');
            this.mitmController.responseData[responseIndex].processed = true;
            return false;
        }

        // Process the next response
        if (
            (
                // Tweets
                responseData.url.includes("/UserTweetsAndReplies?") ||
                // Likes
                responseData.url.includes("/Likes?") ||
                // Bookmarks
                responseData.url.includes("/Bookmarks?")) &&
            responseData.status == 200
        ) {
            // For likes and tweets, body is XAPIData
            // For bookmarks, body is XAPIBookmarksData
            const body: XAPIData | XAPIBookmarksData = JSON.parse(responseData.body);
            let timeline: XAPITimeline;
            if (isXAPIBookmarksData(body)) {
                timeline = (body as XAPIBookmarksData).data.bookmark_timeline_v2;
            } else if (isXAPIData(body)) {
                timeline = (body as XAPIData).data.user.result.timeline_v2;
            } else {
                throw new Error('Invalid response data');
            }

            // Loop through instructions
            timeline.timeline.instructions.forEach((instructions) => {
                if (instructions["type"] != "TimelineAddEntries") {
                    return;
                }

                // If we only have two entries, they both have entryType of TimelineTimelineCursor (one cursorType of Top and the other of Bottom), this means there are no more tweets
                if (
                    instructions.entries?.length == 2 &&
                    instructions.entries[0].content.entryType == "TimelineTimelineCursor" &&
                    instructions.entries[0].content.cursorType == "Top" &&
                    instructions.entries[1].content.entryType == "TimelineTimelineCursor" &&
                    instructions.entries[1].content.cursorType == "Bottom"
                ) {
                    this.thereIsMore = false;
                    return;
                }

                // Loop through the entries
                instructions.entries?.forEach((entries) => {
                    let userLegacy: XAPILegacyUser | undefined;
                    let tweetLegacy: XAPILegacyTweet | undefined;

                    if (entries.content.entryType == "TimelineTimelineModule") {
                        entries.content.items?.forEach((item) => {
                            if (
                                item.item.itemContent.tweet_results &&
                                item.item.itemContent.tweet_results.result &&
                                item.item.itemContent.tweet_results.result.core &&
                                item.item.itemContent.tweet_results.result.core.user_results &&
                                item.item.itemContent.tweet_results.result.core.user_results.result &&
                                item.item.itemContent.tweet_results.result.core.user_results.result.legacy &&
                                item.item.itemContent.tweet_results.result.legacy
                            ) {
                                userLegacy = item.item.itemContent.tweet_results.result.core.user_results.result.legacy;
                                tweetLegacy = item.item.itemContent.tweet_results.result.legacy;
                            }
                            if (
                                item.item.itemContent.tweet_results &&
                                item.item.itemContent.tweet_results.result &&
                                item.item.itemContent.tweet_results.result.tweet &&
                                item.item.itemContent.tweet_results.result.tweet.core &&
                                item.item.itemContent.tweet_results.result.tweet.core.user_results &&
                                item.item.itemContent.tweet_results.result.tweet.core.user_results.result &&
                                item.item.itemContent.tweet_results.result.tweet.core.user_results.result.legacy &&
                                item.item.itemContent.tweet_results.result.tweet.legacy
                            ) {
                                userLegacy = item.item.itemContent.tweet_results.result.tweet.core.user_results.result.legacy;
                                tweetLegacy = item.item.itemContent.tweet_results.result.tweet.legacy;
                            }

                            if (userLegacy && tweetLegacy) {
                                this.indexTweet(responseIndex, userLegacy, tweetLegacy)
                            }
                        });
                    } else if (entries.content.entryType == "TimelineTimelineItem") {
                        if (
                            entries.content.itemContent &&
                            entries.content.itemContent.tweet_results &&
                            entries.content.itemContent.tweet_results.result &&
                            entries.content.itemContent.tweet_results.result.core &&
                            entries.content.itemContent.tweet_results.result.core.user_results &&
                            entries.content.itemContent.tweet_results.result.core.user_results.result &&
                            entries.content.itemContent.tweet_results.result.core.user_results.result.legacy &&
                            entries.content.itemContent.tweet_results.result.legacy
                        ) {
                            userLegacy = entries.content.itemContent.tweet_results.result.core.user_results.result.legacy;
                            tweetLegacy = entries.content.itemContent.tweet_results.result.legacy;
                        }
                        if (
                            entries.content.itemContent &&
                            entries.content.itemContent.tweet_results &&
                            entries.content.itemContent.tweet_results.result &&
                            entries.content.itemContent.tweet_results.result.tweet &&
                            entries.content.itemContent.tweet_results.result.tweet.core &&
                            entries.content.itemContent.tweet_results.result.tweet.core.user_results &&
                            entries.content.itemContent.tweet_results.result.tweet.core.user_results.result &&
                            entries.content.itemContent.tweet_results.result.tweet.core.user_results.result.legacy &&
                            entries.content.itemContent.tweet_results.result.tweet.legacy
                        ) {
                            userLegacy = entries.content.itemContent.tweet_results.result.tweet.core.user_results.result.legacy;
                            tweetLegacy = entries.content.itemContent.tweet_results.result.tweet.legacy;
                        }

                        if (userLegacy && tweetLegacy) {
                            this.indexTweet(responseIndex, userLegacy, tweetLegacy);
                        }
                    }


                });
            });

            this.mitmController.responseData[responseIndex].processed = true;
            log.debug('XAccountController.indexParseTweetsResponseData: processed', responseIndex);
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
        log.info(`XAccountController.indexParseTweets: parsing ${this.mitmController.responseData.length} responses`);

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
        const accountDataPath = getAccountDataPath("X", this.account.username);
        const outputPath = path.join(accountDataPath, "Tweet Media");
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
        tweetLegacy["entities"]["media"].forEach((media: XAPILegacyTweetMedia) => {
            // Get the HTTPS URL of the media -- this works for photos
            let mediaURL = media["media_url_https"];

            // If it's a video, set mediaURL to the video variant with the highest bitrate
            if (media["type"] == "video") {
                let highestBitrate = 0;
                if (media["video_info"] && media["video_info"]["variants"]) {
                    media["video_info"]["variants"].forEach((variant: XAPILegacyTweetMediaVideoVariant) => {
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
                    });
                };
            }

            const mediaExtension = mediaURL.substring(mediaURL.lastIndexOf(".") + 1);

            // Download media locally
            const filename = `${media["media_key"]}.${mediaExtension}`;
            this.saveTweetMedia(mediaURL, filename);

            // Have we seen this media before?
            const existing: XTweetMediaRow[] = exec(this.db, 'SELECT * FROM tweet_media WHERE mediaID = ?', [media["media_key"]], "all") as XTweetMediaRow[];
            if (existing.length > 0) {
                // Delete it, so we can re-add it
                exec(this.db, 'DELETE FROM tweet_media WHERE mediaID = ?', [media["media_key"]]);
            }

            // Index media information in tweet_media table
            exec(this.db, 'INSERT INTO tweet_media (mediaID, mediaType, url, filename, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                media["media_key"],
                media["type"],
                media["url"],
                filename,
                media["indices"]?.[0],
                media["indices"]?.[1],
                tweetLegacy["id_str"],
            ]);
        })
    }

    indexTweetURLs(tweetLegacy: XAPILegacyTweet) {
        log.debug("XAccountController.indexTweetURL");

        // Loop over all URL items
        tweetLegacy["entities"]["urls"].forEach((url: XAPILegacyURL) => {
            // Have we seen this URL before?
            const existing: XTweetURLRow[] = exec(this.db, 'SELECT * FROM tweet_url WHERE url = ? AND tweetID = ?', [url["url"], tweetLegacy["id_str"]], "all") as XTweetURLRow[];
            if (existing.length > 0) {
                // Delete it, so we can re-add it
                exec(this.db, 'DELETE FROM tweet_url WHERE url = ? AND tweetID = ?', [url["url"], tweetLegacy["id_str"]]);
            }

            // Index url information in tweet_url table
            exec(this.db, 'INSERT INTO tweet_url (url, displayURL, expandedURL, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?)', [
                url["url"],
                url["display_url"],
                url["expanded_url"],
                url["indices"]?.[0],
                url["indices"]?.[1],
                tweetLegacy["id_str"],
            ]);
        })
    }

    async getProfileImageDataURI(user: XAPIUser): Promise<string> {
        if (!user.profile_image_url_https) {
            return "";
        }
        try {
            const response = await fetch(user.profile_image_url_https, {});
            if (!response.ok) {
                return "";
            }
            const buffer = await response.buffer();
            return `data:${response.headers.get('content-type')};base64,${buffer.toString('base64')}`;
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
        const profileImageDataURI = await this.getProfileImageDataURI(user);

        // Have we seen this user before?
        const existing: XUserRow[] = exec(this.db, 'SELECT * FROM user WHERE userID = ?', [user.id_str], "all") as XUserRow[];
        if (existing.length > 0) {
            // Update the user
            exec(this.db, 'UPDATE user SET name = ?, screenName = ?, profileImageDataURI = ? WHERE userID = ?', [
                user.name,
                user.screen_name,
                profileImageDataURI,
                user.id_str,
            ]);
        } else {
            // Add the user
            exec(this.db, 'INSERT INTO user (userID, name, screenName, profileImageDataURI) VALUES (?, ?, ?, ?)', [
                user.id_str,
                user.name,
                user.screen_name,
                profileImageDataURI,
            ]);
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
        const existing: XConversationRow[] = exec(this.db, 'SELECT minEntryID, maxEntryID FROM conversation WHERE conversationID = ?', [conversation.conversation_id], "all") as XConversationRow[];
        if (existing.length > 0) {
            log.debug("XAccountController.indexConversation: conversation already indexed, but needs to be updated", {
                oldMinEntryID: existing[0].minEntryID,
                oldMaxEntryID: existing[0].maxEntryID,
                newMinEntryID: conversation.min_entry_id,
                newMaxEntryID: conversation.max_entry_id,
            });

            // Update the conversation
            exec(this.db, 'UPDATE conversation SET sortTimestamp = ?, type = ?, minEntryID = ?, maxEntryID = ?, isTrusted = ?, updatedInDatabaseAt = ?, shouldIndexMessages = ?, deletedAt = NULL WHERE conversationID = ?', [
                conversation.sort_timestamp,
                conversation.type,
                conversation.min_entry_id,
                conversation.max_entry_id,
                conversation.trusted ? 1 : 0,
                new Date(),
                1,
                conversation.conversation_id,
            ]);
        } else {
            // Add the conversation
            exec(this.db, 'INSERT INTO conversation (conversationID, type, sortTimestamp, minEntryID, maxEntryID, isTrusted, addedToDatabaseAt, shouldIndexMessages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
                conversation.conversation_id,
                conversation.type,
                conversation.sort_timestamp,
                conversation.min_entry_id,
                conversation.max_entry_id,
                conversation.trusted ? 1 : 0,
                new Date(),
                1
            ]);
        }

        // Delete participants
        exec(this.db, 'DELETE FROM conversation_participant WHERE conversationID = ?', [conversation.conversation_id]);

        // Add the participants
        conversation.participants.forEach((participant) => {
            exec(this.db, 'INSERT INTO conversation_participant (conversationID, userID) VALUES (?, ?)', [
                conversation.conversation_id,
                participant.user_id,
            ]);
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
            log.warn('XAccountController.indexParseConversationsResponseData: RATE LIMITED');
            this.mitmController.responseData[responseIndex].processed = true;
            return false;
        }

        // Process the response
        if (
            (
                // XAPIInboxTimeline
                responseData.url.includes("/i/api/1.1/dm/inbox_timeline/trusted.json") ||
                responseData.url.includes("/i/api/1.1/dm/inbox_timeline/untrusted.json") ||

                // XAPIInboxInitialState
                responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json") ||
                responseData.url.includes("/i/api/1.1/dm/user_updates.json")
            ) &&
            responseData.status == 200
        ) {
            let users: Record<string, XAPIUser>;
            let conversations: Record<string, XAPIConversation>;
            if (
                responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json") ||
                responseData.url.includes("/i/api/1.1/dm/user_updates.json")
            ) {
                const inbox_initial_state: XAPIInboxInitialState = JSON.parse(responseData.body);
                if (!inbox_initial_state.inbox_initial_state) {
                    // Skip this response
                    return true;
                }
                users = inbox_initial_state.inbox_initial_state.users;
                conversations = inbox_initial_state.inbox_initial_state.conversations;
                this.thereIsMore = inbox_initial_state.inbox_initial_state.inbox_timelines.trusted?.status == "HAS_MORE";
            } else {
                const inbox_timeline: XAPIInboxTimeline = JSON.parse(responseData.body);
                users = inbox_timeline.inbox_timeline.users;
                conversations = inbox_timeline.inbox_timeline.conversations;
                this.thereIsMore = inbox_timeline.inbox_timeline.status == "HAS_MORE";
            }

            // Add the users
            if (users) {
                log.info(`XAccountController.indexParseConversationsResponseData: adding ${Object.keys(users).length} users`);
                for (const userID in users) {
                    const user = users[userID];
                    await this.indexUser(user);
                }
            } else {
                log.info('XAccountController.indexParseConversationsResponseData: no users');
            }

            // Add the conversations
            if (conversations) {
                log.info(`XAccountController.indexParseConversationsResponseData: adding ${Object.keys(conversations).length} conversations`);
                for (const conversationID in conversations) {
                    const conversation = conversations[conversationID];
                    this.indexConversation(conversation);
                }
            } else {
                log.info('XAccountController.indexParseConversationsResponseData: no conversations');
            }

            this.mitmController.responseData[responseIndex].processed = true;
            log.debug('XAccountController.indexParseConversationsResponseData: processed', responseIndex);
        } else {
            // Skip response
            this.mitmController.responseData[responseIndex].processed = true;
        }
    }

    // Returns true if more data needs to be indexed
    // Returns false if we are caught up
    async indexParseConversations(): Promise<XProgress> {
        await this.mitmController.clearProcessed();
        log.info(`XAccountController.indexParseConversations: parsing ${this.mitmController.responseData.length} responses`);

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
        const conversationIDs: XConversationRow[] = exec(this.db, 'SELECT conversationID FROM conversation WHERE shouldIndexMessages = ? AND deletedAt IS NULL', [1], "all") as XConversationRow[];
        const totalConversations: Sqlite3Count = exec(this.db, 'SELECT COUNT(*) AS count FROM conversation WHERE deletedAt IS NULL', [], "get") as Sqlite3Count;
        log.debug("XAccountController.indexMessagesStart", conversationIDs, totalConversations);
        return {
            conversationIDs: conversationIDs.map((row) => row.conversationID),
            totalConversations: totalConversations.count
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

        // Have we seen this message before?
        const existingCount: Sqlite3Count = exec(this.db, 'SELECT COUNT(*) AS count FROM message WHERE messageID = ?', [message.message.id], "get") as Sqlite3Count;
        log.debug("XAccountController.indexMessage: existingCount", existingCount);

        // Insert of replace message
        exec(this.db, 'INSERT OR REPLACE INTO message (messageID, conversationID, createdAt, senderID, text, deletedAt) VALUES (?, ?, ?, ?, ?, ?)', [
            message.message.id,
            message.message.conversation_id,
            new Date(Number(message.message.time)),
            message.message.message_data.sender_id,
            message.message.message_data.text,
            null,
        ]);

        // Update progress
        const insertMessageID: string = message.message.id;
        if (!this.messageIDsIndexed.some(messageID => messageID === insertMessageID)) {
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
            log.warn('XAccountController.indexParseMessagesResponseData: RATE LIMITED');
            this.mitmController.responseData[responseIndex].processed = true;
            return false;
        }

        // Process the response
        if (
            (
                // XAPIConversationTimeline
                responseData.url.includes("/i/api/1.1/dm/conversation/") ||

                // XAPIInboxInitialState
                responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json")
            ) &&
            responseData.status == 200
        ) {
            log.debug("XAccountController.indexParseMessagesResponseData", responseIndex);
            let entries: XAPIMessage[];

            if (responseData.url.includes("/i/api/1.1/dm/conversation/")) {
                // XAPIConversationTimeline
                const conversationTimeline: XAPIConversationTimeline = JSON.parse(responseData.body);
                if (!conversationTimeline.conversation_timeline.entries) {
                    // Skip this response
                    return true;
                }
                entries = conversationTimeline.conversation_timeline.entries;
            } else {
                // XAPIInboxInitialState
                const inbox_initial_state: XAPIInboxInitialState = JSON.parse(responseData.body);
                if (!inbox_initial_state.inbox_initial_state) {
                    // Skip this response
                    return true;
                }
                entries = inbox_initial_state.inbox_initial_state.entries;
            }

            // Add the messages
            if (entries) {
                log.info(`XAccountController.indexParseMessagesResponseData: adding ${entries.length} messages`);
                for (let i = 0; i < entries.length; i++) {
                    const message = entries[i];
                    this.indexMessage(message);
                }
            } else {
                log.info('XAccountController.indexParseMessagesResponseData: no entries');
            }

            this.mitmController.responseData[responseIndex].processed = true;
            log.debug('XAccountController.indexParseMessagesResponseData: processed', responseIndex);
        } else {
            // Skip response
            log.debug('XAccountController.indexParseMessagesResponseData: skipping response', responseData.url);
            this.mitmController.responseData[responseIndex].processed = true;
        }

        return true;
    }

    async indexParseMessages(): Promise<XProgress> {
        log.info(`XAccountController.indexParseMessages: parsing ${this.mitmController.responseData.length} responses`);

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

        exec(this.db, 'UPDATE conversation SET shouldIndexMessages = ? WHERE conversationID = ?', [0, conversationID]);
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
                'SELECT tweetID, text, likeCount, retweetCount, createdAt, path FROM tweet WHERE username = ? AND text NOT LIKE ? ORDER BY createdAt',
                [this.account.username, "RT @%"],
                "all"
            ) as XTweetRow[];

            const items: XTweetItemArchive[] = [];
            for (let i = 0; i < tweetsResp.length; i++) {
                items.push(convertTweetRowToXTweetItemArchive(tweetsResp[i]))
            }

            return {
                outputPath: await this.archiveTweetsOutputPath(),
                items: items
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

        exec(this.db, 'UPDATE tweet SET archivedAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
    }

    // If the tweet doesn't have an archivedAt timestamp, set one
    async archiveTweetCheckDate(tweetID: string) {
        if (!this.db) {
            this.initDB();
        }

        const tweet: XTweetRow = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweetID], "get") as XTweetRow;
        if (!tweet.archivedAt) {
            exec(this.db, 'UPDATE tweet SET archivedAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        }
    }

    async archiveBuild() {
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            return false;
        }

        log.info("XAccountController.archiveBuild: building archive");

        // Tweets
        const tweets: XTweetRow[] = exec(
            this.db,
            "SELECT * FROM tweet WHERE text NOT LIKE ? AND username = ? ORDER BY createdAt DESC",
            ["RT @%", this.account.username],
            "all"
        ) as XTweetRow[];

        // Retweets
        const retweets: XTweetRow[] = exec(
            this.db,
            "SELECT * FROM tweet WHERE text LIKE ? ORDER BY createdAt DESC",
            ["RT @%"],
            "all"
        ) as XTweetRow[];

        // Likes
        const likes: XTweetRow[] = exec(
            this.db,
            "SELECT * FROM tweet WHERE isLiked = ? ORDER BY createdAt DESC",
            [1],
            "all"
        ) as XTweetRow[];

        // Bookmarks
        const bookmarks: XTweetRow[] = exec(
            this.db,
            "SELECT * FROM tweet WHERE isBookmarked = ? ORDER BY createdAt DESC",
            [1],
            "all"
        ) as XTweetRow[];

        // Load all media and URLs, to process later
        const media: XTweetMediaRow[] = exec(
            this.db,
            "SELECT * FROM tweet_media",
            [],
            "all"
        ) as XTweetMediaRow[];
        const urls: XTweetURLRow[] = exec(
            this.db,
            "SELECT * FROM tweet_url",
            [],
            "all"
        ) as XTweetURLRow[];

        // Users
        const users: XUserRow[] = exec(
            this.db,
            'SELECT * FROM user',
            [],
            "all"
        ) as XUserRow[];

        // Conversations and messages
        const conversations: XConversationRow[] = exec(
            this.db,
            'SELECT * FROM conversation ORDER BY sortTimestamp DESC',
            [],
            "all"
        ) as XConversationRow[];
        const conversationParticipants: XConversationParticipantRow[] = exec(
            this.db,
            'SELECT * FROM conversation_participant',
            [],
            "all"
        ) as XConversationParticipantRow[];
        const messages: XMessageRow[] = exec(
            this.db,
            'SELECT * FROM message ORDER BY createdAt',
            [],
            "all"
        ) as XMessageRow[];

        // Get the current account's userID
        const accountUser = users.find((user) => user.screenName == this.account?.username);
        const accountUserID = accountUser?.userID;

        const tweetRowToArchiveTweet = (tweet: XTweetRow): XArchiveTypes.Tweet => {
            const archiveTweet: XArchiveTypes.Tweet = {
                tweetID: tweet.tweetID,
                username: tweet.username,
                createdAt: tweet.createdAt,
                likeCount: tweet.likeCount,
                quoteCount: tweet.quoteCount,
                replyCount: tweet.replyCount,
                retweetCount: tweet.retweetCount,
                isLiked: tweet.isLiked,
                isRetweeted: tweet.isRetweeted,
                text: tweet.text,
                path: tweet.path,
                quotedTweet: tweet.quotedTweet,
                archivedAt: tweet.archivedAt,
                deletedTweetAt: tweet.deletedTweetAt,
                deletedRetweetAt: tweet.deletedRetweetAt,
                deletedLikeAt: tweet.deletedLikeAt,
                deletedBookmarkAt: tweet.deletedBookmarkAt,
                media: [],
                urls: [],
            };
            // Loop through media and URLs
            media.forEach((media) => {
                if (media.tweetID == tweet.tweetID) {
                    archiveTweet.media.push({
                        mediaType: media.mediaType,
                        url: media.url,
                        filename: media.filename,
                    });
                }
            });
            urls.forEach((url) => {
                if (url.tweetID == tweet.tweetID) {
                    archiveTweet.urls.push({
                        url: url.url,
                        displayURL: url.displayURL,
                        expandedURL: url.expandedURL,
                    });
                }
            });

            return archiveTweet
        }

        // Build the archive object
        const formattedTweets: XArchiveTypes.Tweet[] = tweets.map((tweet) => {
            return tweetRowToArchiveTweet(tweet);
        });
        const formattedRetweets: XArchiveTypes.Tweet[] = retweets.map((tweet) => {
            return tweetRowToArchiveTweet(tweet);
        });
        const formattedLikes: XArchiveTypes.Tweet[] = likes.map((tweet) => {
            return tweetRowToArchiveTweet(tweet);
        });
        const formattedBookmarks: XArchiveTypes.Tweet[] = bookmarks.map((tweet) => {
            return tweetRowToArchiveTweet(tweet);
        });
        const formattedUsers: Record<string, XArchiveTypes.User> = users.reduce((acc, user) => {
            acc[user.userID] = {
                userID: user.userID,
                name: user.name ? user.name : "",
                username: user.screenName,
                profileImageDataURI: user.profileImageDataURI ? user.profileImageDataURI : "",
            };
            return acc;
        }, {} as Record<string, XArchiveTypes.User>);
        const formattedConversations: XArchiveTypes.Conversation[] = conversations.map((conversation) => {
            let participants = conversationParticipants.filter(
                (participant) => participant.conversationID == conversation.conversationID
            ).map((participant) => participant.userID);
            // Delete accountUserID from participants
            participants = participants.filter((participant) => participant != accountUserID);
            let participantSearchString = "";
            for (let i = 0; i < participants.length; i++) {
                const user = formattedUsers[participants[i]];
                if (user) {
                    participantSearchString += user.name + " ";
                    participantSearchString += user.username + " ";
                }
            }
            return {
                conversationID: conversation.conversationID,
                type: conversation.type,
                sortTimestamp: conversation.sortTimestamp,
                participants: participants,
                participantSearchString: participantSearchString,
                deletedAt: conversation.deletedAt,
            }
        });
        const formattedMessages: XArchiveTypes.Message[] = messages.map((message) => {
            return {
                messageID: message.messageID,
                conversationID: message.conversationID,
                createdAt: message.createdAt,
                senderID: message.senderID,
                text: message.text,
                deletedAt: message.deletedAt,
            }
        });

        log.info(`XAccountController.archiveBuild: archive has ${tweets.length} tweets, ${retweets.length} retweets, ${likes.length} likes, ${bookmarks.length} bookmarks, ${users.length} users, ${conversations.length} conversations, and ${messages.length} messages`);

        // Save the archive object to a file using streaming
        const assetsPath = path.join(getAccountDataPath("X", this.account.username), "assets");
        if (!fs.existsSync(assetsPath)) {
            fs.mkdirSync(assetsPath);
        }
        const archivePath = path.join(assetsPath, "archive.js");

        const streamWriter = fs.createWriteStream(archivePath);
        try {
            // Write the window.archiveData prefix
            streamWriter.write('window.archiveData=');

            // Write the archive metadata
            streamWriter.write('{\n');
            streamWriter.write(`  "appVersion": ${JSON.stringify(app.getVersion())},\n`);
            streamWriter.write(`  "username": ${JSON.stringify(this.account.username)},\n`);
            streamWriter.write(`  "createdAt": ${JSON.stringify(new Date().toLocaleString())},\n`);

            // Write each array separately using a streaming approach in case the arrays are large
            await this.writeJSONArray(streamWriter, formattedTweets, "tweets");
            streamWriter.write(',\n');
            await this.writeJSONArray(streamWriter, formattedRetweets, "retweets");
            streamWriter.write(',\n');
            await this.writeJSONArray(streamWriter, formattedLikes, "likes");
            streamWriter.write(',\n');
            await this.writeJSONArray(streamWriter, formattedBookmarks, "bookmarks");
            streamWriter.write(',\n');
            await this.writeJSONArray(streamWriter, Object.values(formattedUsers), "users");
            streamWriter.write(',\n');
            await this.writeJSONArray(streamWriter, formattedConversations, "conversations");
            streamWriter.write(',\n');
            await this.writeJSONArray(streamWriter, formattedMessages, "messages");

            // Close the object
            streamWriter.write('};');

            await new Promise((resolve) => streamWriter.end(resolve));
        } catch (error) {
            streamWriter.end();
            throw error;
        }

        log.info(`XAccountController.archiveBuild: archive saved to ${archivePath}`);

        // Unzip x-archive.zip to the account data folder using unzipper
        const archiveZipPath = path.join(getResourcesPath(), "x-archive.zip");
        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: getAccountDataPath("X", this.account.username) });
    }

    async writeJSONArray<T>(streamWriter: fs.WriteStream, items: T[], propertyName: string) {
        streamWriter.write(`  "${propertyName}": [\n`);
        for (let i = 0; i < items.length; i++) {
            const suffix = i < items.length - 1 ? ',\n' : '\n';
            streamWriter.write('    ' + JSON.stringify(items[i]) + suffix);
        }
        streamWriter.write('  ]');
    }

    // When you start deleting tweets, return a list of tweets to delete
    async deleteTweetsStart(): Promise<XDeleteTweetsStartResponse> {
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            throw new Error("Account not found");
        }

        // Select just the tweets that need to be deleted based on the settings
        let tweets: XTweetRow[];
        const daysOldTimestamp = this.account.deleteTweetsDaysOldEnabled ? getTimestampDaysAgo(this.account.deleteTweetsDaysOld) : getTimestampDaysAgo(0);
        if (this.account.deleteTweetsLikesThresholdEnabled && this.account.deleteTweetsRetweetsThresholdEnabled) {
            // Both likes and retweets thresholds
            tweets = exec(
                this.db,
                'SELECT tweetID, text, likeCount, retweetCount, createdAt FROM tweet WHERE deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ? AND retweetCount <= ? ORDER BY createdAt ASC',
                ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsLikesThreshold, this.account.deleteTweetsRetweetsThreshold],
                "all"
            ) as XTweetRow[];
        } else if (this.account.deleteTweetsLikesThresholdEnabled && !this.account.deleteTweetsRetweetsThresholdEnabled) {
            // Just likes threshold
            tweets = exec(
                this.db,
                'SELECT tweetID, text, likeCount, retweetCount, createdAt FROM tweet WHERE deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ? ORDER BY createdAt ASC',
                ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsLikesThreshold],
                "all"
            ) as XTweetRow[];
        } else if (!this.account.deleteTweetsLikesThresholdEnabled && this.account.deleteTweetsRetweetsThresholdEnabled) {
            // Just retweets threshold
            tweets = exec(
                this.db,
                'SELECT tweetID, text, likeCount, retweetCount, createdAt FROM tweet WHERE deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND retweetCount <= ? ORDER BY createdAt ASC',
                ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsRetweetsThreshold],
                "all"
            ) as XTweetRow[];
        } else {
            // Neither likes nor retweets threshold
            tweets = exec(
                this.db,
                'SELECT tweetID, text, likeCount, retweetCount, createdAt FROM tweet WHERE deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? ORDER BY createdAt ASC',
                ["RT @%", this.account.username, daysOldTimestamp],
                "all"
            ) as XTweetRow[];
        }

        // log.debug("XAccountController.deleteTweetsStart", tweets);
        return {
            tweets: tweets.map((row) => (convertTweetRowToXTweetItem(row))),
        };
    }

    // Returns the count of tweets that are not archived
    // If total is true, return the total count of tweets not archived
    // Otherwise, return the count of tweets not archived that will be deleted
    async deleteTweetsCountNotArchived(total: boolean): Promise<number> {
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
                'SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ?',
                ["RT @%", this.account.username],
                "get"
            ) as Sqlite3Count;
        } else {
            const daysOldTimestamp = this.account.deleteTweetsDaysOldEnabled ? getTimestampDaysAgo(this.account.deleteTweetsDaysOld) : getTimestampDaysAgo(0);
            if (this.account.deleteTweetsLikesThresholdEnabled && this.account.deleteTweetsRetweetsThresholdEnabled) {
                // Both likes and retweets thresholds
                count = exec(
                    this.db,
                    'SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ? AND retweetCount <= ?',
                    ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsLikesThreshold, this.account.deleteTweetsRetweetsThreshold],
                    "get"
                ) as Sqlite3Count;
            } else if (this.account.deleteTweetsLikesThresholdEnabled && !this.account.deleteTweetsRetweetsThresholdEnabled) {
                // Just likes threshold
                count = exec(
                    this.db,
                    'SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ?',
                    ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsLikesThreshold],
                    "get"
                ) as Sqlite3Count;
            } else if (!this.account.deleteTweetsLikesThresholdEnabled && this.account.deleteTweetsRetweetsThresholdEnabled) {
                // Just retweets threshold
                count = exec(
                    this.db,
                    'SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND retweetCount <= ?',
                    ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsRetweetsThreshold],
                    "get"
                ) as Sqlite3Count;
            } else {
                // Neither likes nor retweets threshold
                count = exec(
                    this.db,
                    'SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ?',
                    ["RT @%", this.account.username, daysOldTimestamp],
                    "get"
                ) as Sqlite3Count;
            }
        }

        return count.count;
    }

    // When you start deleting retweets, return a list of tweets to delete
    async deleteRetweetsStart(): Promise<XDeleteTweetsStartResponse> {
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            throw new Error("Account not found");
        }

        // Select just the retweets that need to be deleted based on the settings
        const daysOldTimestamp = this.account.deleteRetweetsDaysOldEnabled ? getTimestampDaysAgo(this.account.deleteRetweetsDaysOld) : getTimestampDaysAgo(0);
        const tweets: XTweetRow[] = exec(
            this.db,
            'SELECT tweetID, text, likeCount, retweetCount, createdAt FROM tweet WHERE deletedRetweetAt IS NULL AND text LIKE ? AND createdAt <= ? ORDER BY createdAt ASC',
            ["RT @%", daysOldTimestamp],
            "all"
        ) as XTweetRow[];

        return {
            tweets: tweets.map((row) => (convertTweetRowToXTweetItem(row))),
        };
    }

    // When you start deleting likes, return a list of tweets to unlike
    async deleteLikesStart(): Promise<XDeleteTweetsStartResponse> {
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            throw new Error("Account not found");
        }

        // Select just the tweets that need to be unliked based on the settings
        const tweets: XTweetRow[] = exec(
            this.db,
            'SELECT tweetID, text, likeCount, retweetCount, createdAt FROM tweet WHERE deletedLikeAt IS NULL AND isLiked = ? ORDER BY createdAt ASC',
            [1],
            "all"
        ) as XTweetRow[];

        return {
            tweets: tweets.map((row) => (convertTweetRowToXTweetItem(row))),
        };
    }

    // When you start deleting bookmarks, return a list of tweets to unbookmark
    async deleteBookmarksStart(): Promise<XDeleteTweetsStartResponse> {
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            throw new Error("Account not found");
        }

        // Select just the tweets that need to be unliked based on the settings
        const tweets: XTweetRow[] = exec(
            this.db,
            'SELECT tweetID, text, likeCount, retweetCount, createdAt FROM tweet WHERE deletedBookmarkAt IS NULL AND isBookmarked = ? ORDER BY createdAt ASC',
            [1],
            "all"
        ) as XTweetRow[];

        return {
            tweets: tweets.map((row) => (convertTweetRowToXTweetItem(row))),
        };
    }

    // Save the tweet's deleted*At timestamp
    async deleteTweet(tweetID: string, deleteType: string) {
        if (!this.db) {
            this.initDB();
        }

        if (deleteType == "tweet") {
            exec(this.db, 'UPDATE tweet SET deletedTweetAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        } else if (deleteType == "retweet") {
            exec(this.db, 'UPDATE tweet SET deletedRetweetAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        } else if (deleteType == "like") {
            exec(this.db, 'UPDATE tweet SET deletedLikeAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        } else if (deleteType == "bookmark") {
            exec(this.db, 'UPDATE tweet SET deletedBookmarkAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        } else {
            throw new Error("Invalid deleteType");
        }
    }

    deleteDMsMarkDeleted(conversationID: string) {
        log.info(`XAccountController.deleteDMsMarkDeleted: conversationID=${conversationID}`);

        if (!this.db) {
            this.initDB();
        }

        // Mark the conversation as deleted
        exec(this.db, 'UPDATE conversation SET deletedAt = ? WHERE conversationID = ?', [new Date(), conversationID]);

        // Mark all the messages as deleted
        exec(this.db, 'UPDATE message SET deletedAt = ? WHERE conversationID = ? AND deletedAt is NULL', [new Date(), conversationID]);

        // Update the progress
        this.progress.conversationsDeleted++;
    }

    async deleteDMsMarkAllDeleted(): Promise<void> {
        if (!this.db) {
            this.initDB();
        }

        const conversations = exec(this.db, 'SELECT conversationID FROM conversation WHERE deletedAt IS NULL', [], "all") as XConversationRow[];
        log.info(`XAccountController.deleteDMsMarkAllDeleted: marking ${conversations.length} conversations deleted`)

        for (let i = 0; i < conversations.length; i++) {
            this.deleteDMsMarkDeleted(conversations[i].conversationID)
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
            "get"
        ) as Sqlite3Count;
        const totalTweetsArchived: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NOT NULL",
            [],
            "get"
        ) as Sqlite3Count;
        const totalRetweetsIndexed: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ?",
            ["RT @%"],
            "get"
        ) as Sqlite3Count;
        const totalLikesIndexed: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ?",
            [1],
            "get"
        ) as Sqlite3Count;
        const totalBookmarksIndexed: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ?",
            [1],
            "get"
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
            "get"
        ) as Sqlite3Count;
        const totalTweetsDeleted: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE username = ? AND text NOT LIKE ? AND isLiked = ? AND deletedTweetAt IS NOT NULL",
            [this.account?.username || "", "RT @%", 0],
            "get"
        ) as Sqlite3Count;
        const totalRetweetsDeleted: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedRetweetAt IS NOT NULL",
            ["RT @%"],
            "get"
        ) as Sqlite3Count;
        const totalLikesDeleted: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedLikeAt IS NOT NULL",
            [1],
            "get"
        ) as Sqlite3Count;
        const totalBookmarksDeleted: Sqlite3Count = exec(
            this.db,
            "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ? AND deletedBookmarkAt IS NOT NULL",
            [1],
            "get"
        ) as Sqlite3Count;

        const totalConversationsDeletedConfig: string | null = await this.getConfig("totalConversationsDeleted");
        let totalConversationsDeleted: number = 0;
        if (totalConversationsDeletedConfig) {
            totalConversationsDeleted = parseInt(totalConversationsDeletedConfig);
        }

        const totalAccountsUnfollowedConfig: string | null = await this.getConfig("totalAccountsUnfollowed");
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
        return progressInfo;
    }

    async getDatabaseStats(): Promise<XDatabaseStats> {
        const databaseStats = emptyXDatabaseStats();
        if (!this.account?.username) {
            log.info('XAccountController.getDatabaseStats: no account');
            return databaseStats;
        }

        if (!this.db) {
            this.initDB();
        }

        const username = this.account.username;

        const tweetsSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND isLiked = ? AND username = ?", ["RT @%", 0, username], "get") as Sqlite3Count;
        const tweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND isLiked = ? AND username = ? AND deletedTweetAt IS NOT NULL", ["RT @%", 0, username], "get") as Sqlite3Count;
        const retweetsSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ?", ["RT @%"], "get") as Sqlite3Count;
        const retweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedRetweetAt IS NOT NULL", ["RT @%"], "get") as Sqlite3Count;
        const likesSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ?", [1], "get") as Sqlite3Count;
        const likesDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedLikeAt IS NOT NULL", [1], "get") as Sqlite3Count;
        const bookmarksSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ?", [1], "get") as Sqlite3Count;
        const bookmarksDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ? AND deletedBookmarkAt IS NOT NULL", [1], "get") as Sqlite3Count;
        const conversationsDeleted = parseInt(await this.getConfig("totalConversationsDeleted") || "0");
        const accountsUnfollowed = parseInt(await this.getConfig("totalAccountsUnfollowed") || "0");

        databaseStats.tweetsSaved = tweetsSaved.count;
        databaseStats.tweetsDeleted = tweetsDeleted.count;
        databaseStats.retweetsSaved = retweetsSaved.count;
        databaseStats.retweetsDeleted = retweetsDeleted.count;
        databaseStats.likesSaved = likesSaved.count;
        databaseStats.likesDeleted = likesDeleted.count;
        databaseStats.bookmarksSaved = bookmarksSaved.count;
        databaseStats.bookmarksDeleted = bookmarksDeleted.count;
        databaseStats.conversationsDeleted = conversationsDeleted;
        databaseStats.accountsUnfollowed = accountsUnfollowed
        return databaseStats;
    }

    async getDeleteReviewStats(): Promise<XDeleteReviewStats> {
        const deleteReviewStats = emptyXDeleteReviewStats();
        if (!this.account?.username) {
            log.info('XAccountController.getDeleteReviewStats: no account');
            return deleteReviewStats;
        }

        if (!this.db) {
            this.initDB();
        }

        const deleteTweetsStartResponse = await this.deleteTweetsStart()
        const deleteRetweetStartResponse = await this.deleteRetweetsStart()
        const deleteLikesStartResponse = await this.deleteLikesStart()
        const deleteBookmarksStartResponse = await this.deleteBookmarksStart()

        deleteReviewStats.tweetsToDelete = deleteTweetsStartResponse.tweets.length;
        deleteReviewStats.retweetsToDelete = deleteRetweetStartResponse.tweets.length;
        deleteReviewStats.likesToDelete = deleteLikesStartResponse.tweets.length;
        deleteReviewStats.bookmarksToDelete = deleteBookmarksStartResponse.tweets.length;
        return deleteReviewStats;
    }

    async saveProfileImage(url: string): Promise<void> {
        try {
            const response = await fetch(url, {});
            if (!response.ok) {
                log.warn('XAccountController.saveProfileImage: response not ok', response.status);
                return;
            }
            const buffer = await response.buffer();
            const dataURI = `data:${response.headers.get('content-type')};base64,${buffer.toString('base64')}`;
            log.info('XAccountController.saveProfileImage: got profile image!');

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
        if (!this.account) {
            return null;
        }
        const unzippedPath = path.join(getAccountDataPath("X", this.account.username), "tmp");

        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: unzippedPath });

        log.info(`XAccountController.unzipXArchive: unzipped to ${unzippedPath}`);

        return unzippedPath;
    }

    // Delete the unzipped X archive once the build is completed
    async deleteUnzippedXArchive(archivePath: string): Promise<void> {
        fs.rm(archivePath, { recursive: true, force: true }, err => {
            if (err) {
                log.error(`XAccountController.deleteUnzippedXArchive: Error occured while deleting unzipped folder: ${err}`);
            }
        });
    }

    // Return null on success, and a string (error message) on error
    async verifyXArchive(archivePath: string): Promise<string | null> {
        const foldersToCheck = [
            archivePath,
            path.join(archivePath, "data"),
        ];

        // Make sure folders exist
        for (let i = 0; i < foldersToCheck.length; i++) {
            if (!fs.existsSync(foldersToCheck[i])) {
                log.error(`XAccountController.verifyXArchive: folder does not exist: ${foldersToCheck[i]}`);
                return `The folder ${foldersToCheck[i]} doesn't exist.`;
            }
        }

        // Make sure account.js exists and is readable
        const accountPath = path.join(archivePath, "data", "account.js");
        if (!fs.existsSync(accountPath)) {
            log.error(`XAccountController.verifyXArchive: file does not exist: ${accountPath}`);
            return `The file ${accountPath} doesn't exist.`;
        }
        try {
            fs.accessSync(accountPath, fs.constants.R_OK);
        } catch {
            log.error(`XAccountController.verifyXArchive: file is not readable: ${accountPath}`);
            return `The file ${accountPath} is not readable.`;
        }

        // Make sure the account.js file belongs to the right account
        try {
            const accountFile = fs.readFileSync(accountPath, 'utf8');
            const accountData: XArchiveAccount[] = JSON.parse(accountFile.slice("window.YTD.account.part0 = ".length));
            if (accountData.length !== 1) {
                log.error(`XAccountController.verifyXArchive: account.js has more than one account`);
                return `The account.js file has more than one account.`;
            }
            if (accountData[0].account.username !== this.account?.username) {
                log.error(`XAccountController.verifyXArchive: account.js does not belong to the right account`);
                return `This archive is for @${accountData[0].account.username}, not @${this.account?.username}.`;
            }
        } catch {
            return "Error parsing JSON in account.js";
        }

        return null;
    }

    // Return null on success, and a string (error message) on error
    async importXArchive(archivePath: string, dataType: string): Promise<XImportArchiveResponse> {
        let importCount = 0;
        let skipCount = 0;

        // Load the username
        let username: string;
        try {
            const accountFile = fs.readFileSync(path.join(archivePath, "data", "account.js"), 'utf8');
            const accountData: XArchiveAccount[] = JSON.parse(accountFile.slice("window.YTD.account.part0 = ".length));
            username = accountData[0].account.username;
        } catch {
            return {
                status: "error",
                errorMessage: "Error parsing JSON in account.js",
                importCount: importCount,
                skipCount: skipCount,
            };
        }

        // Import tweets
        if (dataType == "tweets") {
            const tweetsFilenames = await glob(
                [
                    path.join(archivePath, "data", "tweet.js"),
                    path.join(archivePath, "data", "tweets.js"),
                    path.join(archivePath, "data", "tweet-part*.js"),
                    path.join(archivePath, "data", "tweets-part*.js")
                ],
                {
                    windowsPathsNoEscape: os.platform() == 'win32'
                }
            );
            if (tweetsFilenames.length === 0) {
                return {
                    status: "error",
                    errorMessage: "No tweets files found",
                    importCount: importCount,
                    skipCount: skipCount,
                };
            }

            for (let i = 0; i < tweetsFilenames.length; i++) {
                // Load the data
                // New archives use XArchiveTweetContainer[], old archives use XArchiveTweet[]
                let tweetsData: XArchiveTweet[] | XArchiveTweetContainer[];
                try {
                    const tweetsFile = fs.readFileSync(tweetsFilenames[i], 'utf8');
                    tweetsData = JSON.parse(tweetsFile.slice(tweetsFile.indexOf('[')));
                } catch (e) {
                    return {
                        status: "error",
                        errorMessage: "Error parsing JSON in tweets.js",
                        importCount: importCount,
                        skipCount: skipCount,
                    };
                }

                // Loop through the tweets and add them to the database
                try {
                    tweetsData.forEach((tweetContainer) => {
                        let tweet: XArchiveTweet;
                        if (isXArchiveTweetContainer(tweetContainer)) {
                            tweet = tweetContainer.tweet;
                        } else {
                            tweet = tweetContainer;
                        }

                        // Is this tweet already there?
                        const existingTweet = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweet.id_str], "get") as XTweetRow;
                        if (existingTweet) {
                            skipCount++;
                        } else {
                            // Check if tweet has media and call importXArchiveMedia
                            let hasMedia: boolean = false;
                            if (tweet.entities?.media && tweet.entities?.media?.length){
                                hasMedia = true;
                                this.importXArchiveMedia(tweet, archivePath);
                            }

                            // Check if tweet has urls and call importXArchiveURLs
                            if (tweet.entities?.urls && tweet.entities?.urls?.length){
                                this.importXArchiveURLs(tweet);
                            }

                            // Import it
                            exec(this.db, 'INSERT INTO tweet (username, tweetID, createdAt, likeCount, retweetCount, isLiked, isRetweeted, isBookmarked, text, path, hasMedia, isReply, replyTweetID, replyUserID, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
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
                            ]);
                            importCount++;
                        }
                    });
                } catch (e) {
                    return {
                        status: "error",
                        errorMessage: "Error importing tweets: " + e,
                        importCount: importCount,
                        skipCount: skipCount,
                    };
                }
            }

            return {
                status: "success",
                errorMessage: "",
                importCount: importCount,
                skipCount: skipCount,
            };
        }

        // Import likes
        else if (dataType == "likes") {
            const likesFilenames = await glob(
                [
                    path.join(archivePath, "data", "like.js"),
                    path.join(archivePath, "data", "likes.js"),
                    path.join(archivePath, "data", "like-part*.js"),
                    path.join(archivePath, "data", "likes-part*.js")
                ],
                {
                    windowsPathsNoEscape: os.platform() == 'win32'
                }
            );
            if (likesFilenames.length === 0) {
                return {
                    status: "error",
                    errorMessage: "No likes files found",
                    importCount: importCount,
                    skipCount: skipCount,
                };
            }

            for (let i = 0; i < likesFilenames.length; i++) {
                // Load the data
                let likesData: XArchiveLike[] | XArchiveLikeContainer[];
                try {
                    const likesFile = fs.readFileSync(likesFilenames[i], 'utf8');
                    likesData = JSON.parse(likesFile.slice(likesFile.indexOf('[')));
                } catch (e) {
                    return {
                        status: "error",
                        errorMessage: "Error parsing JSON in like.js",
                        importCount: importCount,
                        skipCount: skipCount,
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
                        const existingTweet = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [like.tweetId], "get") as XTweetRow;
                        if (existingTweet) {
                            if (existingTweet.isLiked) {
                                skipCount++;
                            } else {
                                // Set isLiked to true
                                exec(this.db, 'UPDATE tweet SET isLiked = ? WHERE tweetID = ?', [1, like.tweetId]);
                                importCount++;
                            }
                        } else {
                            // Import it
                            const url = new URL(like.expandedUrl);
                            let path = url.pathname + url.search + url.hash;
                            if (path.startsWith('/')) {
                                path = path.substring(1);
                            }
                            exec(this.db, 'INSERT INTO tweet (tweetID, isLiked, text, path, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?)', [
                                like.tweetId,
                                1,
                                like.fullText,
                                path,
                                new Date(),
                            ]);
                            importCount++;
                        }
                    });
                } catch (e) {
                    return {
                        status: "error",
                        errorMessage: "Error importing tweets: " + e,
                        importCount: importCount,
                        skipCount: skipCount,
                    };
                }
            }

            return {
                status: "success",
                errorMessage: "",
                importCount: importCount,
                skipCount: skipCount,
            };
        }

        // // Import direct message groups
        // else if (dataType == "dmGroups" || dataType == "dms") {
        //     let dmsFilename: string;
        //     if (dataType == "dmGroups") {
        //         dmsFilename = "direct-messages-group.js";
        //         if (!fs.existsSync(dmsFilename)) {
        //             // Old X archives might put it in direct-message-group.js
        //             dmsFilename = path.join(archivePath, "data", "direct-message-group.js");
        //             if (!fs.existsSync(dmsFilename)) {
        //                 return {
        //                     status: "error",
        //                     errorMessage: "direct-messages-group.js",
        //                     importCount: importCount,
        //                     skipCount: skipCount,
        //                 };
        //             }
        //         }
        //     } else {
        //         dmsFilename = "direct-messages.js";
        //         if (!fs.existsSync(dmsFilename)) {
        //             // Old X archives might put it in direct-message.js
        //             dmsFilename = path.join(archivePath, "data", "direct-message.js");
        //             if (!fs.existsSync(dmsFilename)) {
        //                 return {
        //                     status: "error",
        //                     errorMessage: "direct-messages.js",
        //                     importCount: importCount,
        //                     skipCount: skipCount,
        //                 };
        //             }
        //         }
        //     }

        //     // Load the data
        //     const dmsPath = path.join(archivePath, "data", dmsFilename);
        //     let dmsData: XArchiveDMConversation[];
        //     try {
        //         const dmsFile = fs.readFileSync(dmsPath, 'utf8');
        //         dmsData = JSON.parse(dmsFile.slice(dmsFile.indexOf('[')));
        //     } catch (e) {
        //         return {
        //             status: "error",
        //             errorMessage: `Error parsing JSON in ${dmsFilename}`,
        //             importCount: importCount,
        //             skipCount: skipCount,
        //         };
        //     }

        //     // Loop through the DM conversations/messages and add them to the database
        //     try {
        //         dmsData.forEach((conversation) => {
        //             // Find the min and max entry ID
        //             let minEntryID: string | null = null, maxEntryID: string | null = null;
        //             // Find the first messageCreate message
        //             for (let i = 0; i < conversation.dmConversation.messages.length; i++) {
        //                 if (conversation.dmConversation.messages[i].messageCreate) {
        //                     minEntryID = conversation.dmConversation.messages[i].messageCreate?.id || null;
        //                     break;
        //                 }
        //             }
        //             // Find the last messageCreate message
        //             for (let i = conversation.dmConversation.messages.length - 1; i >= 0; i--) {
        //                 if (conversation.dmConversation.messages[i].messageCreate) {
        //                     maxEntryID = conversation.dmConversation.messages[i].messageCreate?.id || null;
        //                     break;
        //                 }
        //             }

        //             // Is this conversation already there?
        //             const existingConversation = exec(this.db, 'SELECT * FROM conversation WHERE conversationID = ?', [conversation.dmConversation.conversationId], "get") as XConversationRow;
        //             if (existingConversation) {
        //                 // Update
        //                 const newMinEntryID = minEntryID ? minEntryID : existingConversation.minEntryID;
        //                 const newMaxEntryID = maxEntryID ? maxEntryID : existingConversation.maxEntryID;
        //                 exec(this.db, 'UPDATE conversation SET minEntryID = ?, maxEntryID = ?, updatedInDatabaseAt = ? WHERE conversationID = ?', [newMinEntryID, newMaxEntryID, new Date(), conversation.dmConversation.conversationId]);
        //             } else {
        //                 // Create
        //                 exec(this.db, 'INSERT INTO conversation (conversationID, type, minEntryID, maxEntryID, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?)', [
        //                     conversation.dmConversation.conversationId,
        //                     dataType == "dmGroups" ? 'GROUP_DM' : 'ONE_TO_ONE',
        //                     minEntryID,
        //                     maxEntryID,
        //                     new Date(),
        //                 ]);
        //             }

        //             // Keep track of participant user IDs
        //             const participantUserIDs: string[] = [];

        //             // Add the messages
        //             conversation.dmConversation.messages.forEach((message => {
        //                 if (message.messageCreate) {
        //                     // Does this message exist?
        //                     const existingMessage = exec(this.db, 'SELECT * FROM message WHERE messageID = ?', [message.messageCreate.id], "get") as XMessageRow;
        //                     if (existingMessage) {
        //                         skipCount++;
        //                     } else {
        //                         // Import it
        //                         exec(this.db, 'INSERT INTO message (messageID, conversationID, createdAt, senderID, text) VALUES (?, ?, ?, ?, ?)', [
        //                             message.messageCreate.id,
        //                             conversation.dmConversation.conversationId,
        //                             message.messageCreate.createdAt,
        //                             message.messageCreate.senderId,
        //                             message.messageCreate.text
        //                         ]);
        //                         importCount++;

        //                         // Add this to the list of participant user IDs, if it's not already there
        //                         if (participantUserIDs.includes(message.messageCreate.senderId) == false) {
        //                             participantUserIDs.push(message.messageCreate.senderId);
        //                         }
        //                     }
        //                 }
        //             }))

        //             // Add the participants
        //             participantUserIDs.forEach((userID) => {
        //                 const existingParticipant = exec(this.db, 'SELECT * FROM conversation_participant WHERE conversationID = ? AND userID = ?', [conversation.dmConversation.conversationId, userID], "get") as XConversationParticipantRow;
        //                 if (!existingParticipant) {
        //                     exec(this.db, 'INSERT INTO conversation_participant (conversationID, userID) VALUES (?, ?)', [conversation.dmConversation.conversationId, userID]);
        //                 }
        //             });
        //         });
        //     } catch (e) {
        //         return {
        //             status: "error",
        //             errorMessage: "Error importing direct messages: " + e,
        //             importCount: importCount,
        //             skipCount: skipCount,
        //         };
        //     }

        //     return {
        //         status: "success",
        //         errorMessage: "",
        //         importCount: importCount,
        //         skipCount: skipCount,
        //     };
        // }

        return {
            status: "error",
            errorMessage: "Invalid data type.",
            importCount: importCount,
            skipCount: skipCount,
        };
    }

    importXArchiveMedia(tweet: XArchiveTweet, archivePath: string) {
        // Check if extended_entities has more item than entities. In archived
        // data, sometimes tweets with multiple media has only one entity in entities
        // but multiple in extended_entities
        let mediaList = tweet.entities?.media;
        if (tweet.extended_entities?.media.length > mediaList.length) {
            mediaList = tweet.extended_entities?.media.length;
        }

        // Loop over all media items
        mediaList.forEach((media: XAPILegacyTweetMedia) => {
            const existingMedia = exec(this.db, 'SELECT * FROM tweet_media WHERE mediaID = ?', [media.id_str], "get") as XTweetMediaRow;
            if (existingMedia) {
                return;
            }
            const filename = this.saveXArchiveMedia(tweet.id_str, media, archivePath);
            if (filename) {
                // Index media information in tweet_media table
                exec(this.db, 'INSERT INTO tweet_media (mediaID, mediaType, url, filename, start_index, end_index, tweetID) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                    media.id_str,
                    media.type,
                    media.url,
                    filename,
                    media.indices?.[0],
                    media.indices?.[1],
                    tweet.id_str,
                ]);
            }
        });
    }

    saveXArchiveMedia(tweet_id:string, media: XAPILegacyTweetMedia, archivePath: string): string | null {
        if (!this.account) {
            throw new Error("Account not found");
        }

        const filename = `${media.id_str}.${media.media_url_https.substring(media.media_url_https.lastIndexOf(".") + 1)}`;
        const archiveMediaFilename = path.join(
            archivePath,
            "data",
            `${tweet_id}-${media.media_url_https.substring(media.media_url_https.lastIndexOf("/") + 1)}`
        );

        // If file doesn't exist in archive, don't save information in db
        if (!fs.existsSync(archiveMediaFilename)) {
            return null;
        }

        // Create path to store tweet media if it doesn't exist already
        const accountDataPath = getAccountDataPath("X", this.account.username);
        const outputPath = path.join(accountDataPath, "Tweet Media");
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath);
        }

        // Copy media from archive
        fs.copyFileSync(archiveMediaFilename, path.join(outputPath, filename));

        return filename
    }

    importXArchiveURLs(tweet: XArchiveTweet) {

        // Loop over all URL items
        tweet?.entities?.urls.forEach((url: XAPILegacyURL) => {
            // Index url information in tweet_url table
            exec(this.db, 'INSERT INTO tweet_url (url, displayURL, expandedURL, start_index, end_index, tweetID) VALUES (?, ?, ?, ?, ?, ?)', [
                url.url,
                url.display_url,
                url.expanded_url,
                url.indices?.[0],
                url.indices?.[1],
                tweet.id_str,
            ]);
        })
    }

    async getCookie(name: string): Promise<string | null> {
        return this.cookies[name] || null;
    }

    async getConfig(key: string): Promise<string | null> {
        return getConfig(key, this.db);
    }

    async setConfig(key: string, value: string) {
        return setConfig(key, value, this.db);
    }
}
