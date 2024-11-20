import path from 'path'
import fs from 'fs'

import fetch from 'node-fetch';
import unzipper from 'unzipper';

import { app, ipcMain, session, shell } from 'electron'
import log from 'electron-log/main';
import Database from 'better-sqlite3'

import {
    getResourcesPath,
    getAccountDataPath,
    packageExceptionForReport,
    getTimestampDaysAgo
} from './util'
import {
    XAccount,
    XJob,
    XProgress, emptyXProgress,
    XTweetItem,
    XArchiveStartResponse, emptyXArchiveStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XIndexMessagesStartResponse,
    XDeleteTweetsStartResponse,
    XProgressInfo, emptyXProgressInfo,
    ResponseData,
    XDatabaseStats, emptyXDatabaseStats,
    XDeleteReviewStats, emptyXDeleteReviewStats,
    XArchiveInfo, emptyXArchiveInfo
} from './shared_types'
import {
    runMigrations,
    getAccount,
    saveXAccount,
    exec,
    Sqlite3Count,
    getConfig,
    setConfig,
} from './database'
import { IMITMController, getMITMController } from './mitm';
import {
    XAPILegacyUser,
    XAPILegacyTweet,
    XAPIData,
    XAPIInboxTimeline,
    XAPIInboxInitialState,
    XAPIConversation,
    XAPIConversationTimeline,
    XAPIMessage,
    XAPIUser,
} from './account_x_types'
import * as XArchiveTypes from '../archive-static-sites/x-archive/src/types';

function formatDateToYYYYMMDD(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export interface XJobRow {
    id: number;
    jobType: string;
    status: string;
    scheduledAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    progressJSON: string | null;
    error: string | null;
}

export interface XTweetRow {
    id: number;
    username: string;
    tweetID: string;
    conversationID: string;
    createdAt: string;
    likeCount: number;
    quoteCount: number;
    replyCount: number;
    retweetCount: number;
    isLiked: boolean;
    isRetweeted: boolean;
    text: string;
    path: string;
    addedToDatabaseAt: string;
    archivedAt: string | null;
    deletedAt: string | null;
}

export interface XUserRow {
    id: number;
    userID: string;
    name: string | null;
    screenName: string;
    profileImageDataURI: string | null;
}

export interface XConversationRow {
    id: number;
    conversationID: string;
    type: string;
    sortTimestamp: string | null;
    minEntryID: string | null;
    maxEntryID: string | null;
    isTrusted: boolean | null;
    shouldIndexMessages: boolean | null;
    addedToDatabaseAt: string;
    updatedInDatabaseAt: string | null;
    deletedAt: string | null;
}

export interface XConversationParticipantRow {
    id: number;
    conversationID: string;
    userID: string;
}

export interface XMessageRow {
    id: number;
    messageID: string;
    conversationID: string;
    createdAt: string;
    senderID: string;
    text: string;
    deletedAt: string | null;
}

function convertXJobRowToXJob(row: XJobRow): XJob {
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

function convertTweetRowToXTweetItem(row: XTweetRow): XTweetItem {
    return {
        url: `https://x.com/${row.path}`,
        tweetID: row.tweetID,
        basename: `${formatDateToYYYYMMDD(row.createdAt)}_${row.tweetID}`,
        username: row.username
    };
}

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
            {
                name: "20241016_add_config",
                sql: [
                    `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`
                ]
            }
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
        await this.mitmController.startMITM(ses, ["x.com/i/api/graphql", "x.com/i/api/1.1/dm"]);
        this.thereIsMore = true;
    }

    async indexStop() {
        await this.mitmController.stopMonitoring();
        const ses = session.fromPartition(`persist:account-${this.accountID}`);
        await this.mitmController.stopMITM(ses);
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

        // Add the tweet
        exec(this.db, 'INSERT INTO tweet (username, tweetID, conversationID, createdAt, likeCount, quoteCount, replyCount, retweetCount, isLiked, isRetweeted, text, path, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
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
            tweetLegacy["full_text"],
            `${userLegacy['screen_name']}/status/${tweetLegacy['id_str']}`,
            new Date(),
        ]);

        // Update progress
        if (tweetLegacy["retweeted"]) {
            this.progress.retweetsIndexed++;
        }
        if (tweetLegacy["favorited"]) {
            this.progress.likesIndexed++;
        }
        if (userLegacy["screen_name"] == this.account?.username && !tweetLegacy["retweeted"]) {
            this.progress.tweetsIndexed++;
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
            (responseData.url.includes("/UserTweetsAndReplies?") || responseData.url.includes("/Likes?")) &&
            responseData.status == 200
        ) {
            const body: XAPIData = JSON.parse(responseData.body);

            // Loop through instructions
            body.data.user.result.timeline_v2.timeline.instructions.forEach((instructions) => {
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
    async indexParseTweets(): Promise<XProgress> {
        log.info(`XAccountController.indexParseTweets: parsing ${this.mitmController.responseData.length} responses`);

        await this.mitmController.clearProcessed();

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            this.indexParseTweetsResponseData(i);
        }

        return this.progress;
    }

    // Parses the response data so far to index likes that have been collected
    // Returns the progress object
    async indexParseLikes(): Promise<XProgress> {
        log.info(`XAccountController.indexParseLikes: parsing ${this.mitmController.responseData.length} responses`);

        await this.mitmController.clearProcessed();

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            // Parsing likes uses indexParseTweetsResponseData too, since it's the same data
            this.indexParseTweetsResponseData(i);
        }

        return this.progress;
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
        log.info(`XAccountController.indexParseConversations: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexConversations";
        this.progress.isIndexMessagesFinished = false;

        await this.mitmController.clearProcessed();

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

    async indexTweetsFinished(): Promise<XProgress> {
        log.info('XAccountController.indexTweetsFinished');
        this.progress.isIndexTweetsFinished = true;
        return this.progress;
    }

    async indexConversationsFinished(): Promise<XProgress> {
        log.info('XAccountController.indexConversationsFinished');
        this.progress.isIndexConversationsFinished = true;
        return this.progress;
    }

    async indexMessagesFinished(): Promise<XProgress> {
        log.info('XAccountController.indexMessagesFinished');
        this.progress.isIndexMessagesFinished = true;
        return this.progress;
    }

    // Set the conversation's shouldIndexMessages to false
    async indexConversationFinished(conversationID: string) {
        if (!this.db) {
            this.initDB();
        }

        exec(this.db, 'UPDATE conversation SET shouldIndexMessages = ? WHERE conversationID = ?', [0, conversationID]);
    }

    async indexLikesFinished(): Promise<XProgress> {
        log.info('XAccountController.indexLikesFinished');
        this.progress.isIndexLikesFinished = true;
        return this.progress;
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
                'SELECT tweetID, createdAt, path, username FROM tweet WHERE username = ? AND text NOT LIKE ? ORDER BY createdAt',
                [this.account.username, "RT @%"],
                "all"
            ) as XTweetRow[];

            const items: XTweetItem[] = [];
            for (let i = 0; i < tweetsResp.length; i++) {
                items.push(convertTweetRowToXTweetItem(tweetsResp[i]))
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

        // Select everything from database
        const tweets: XTweetRow[] = exec(
            this.db,
            "SELECT * FROM tweet WHERE text NOT LIKE ? AND username = ? ORDER BY createdAt DESC",
            ["RT @%", this.account.username],
            "all"
        ) as XTweetRow[];
        const retweets: XTweetRow[] = exec(
            this.db,
            "SELECT * FROM tweet WHERE text LIKE ? ORDER BY createdAt DESC",
            ["RT @%"],
            "all"
        ) as XTweetRow[];
        const likes: XTweetRow[] = exec(
            this.db,
            "SELECT * FROM tweet WHERE isLiked = ? ORDER BY createdAt DESC",
            [1],
            "all"
        ) as XTweetRow[];
        const users: XUserRow[] = exec(
            this.db,
            'SELECT * FROM user',
            [],
            "all"
        ) as XUserRow[];
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

        // Build the archive object
        const formattedTweets: XArchiveTypes.Tweet[] = tweets.map((tweet) => {
            return {
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
                archivedAt: tweet.archivedAt,
                deletedAt: tweet.deletedAt,
            }
        });
        const formattedRetweets: XArchiveTypes.Tweet[] = retweets.map((tweet) => {
            return {
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
                archivedAt: tweet.archivedAt,
                deletedAt: tweet.deletedAt,
            }
        });
        const formattedLikes: XArchiveTypes.Tweet[] = likes.map((tweet) => {
            return {
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
                archivedAt: tweet.archivedAt,
                deletedAt: tweet.deletedAt,
            }
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
                participantSearchString += user.name + " ";
                participantSearchString += user.username + " ";
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

        const archive: XArchiveTypes.XArchive = {
            appVersion: app.getVersion(),
            username: this.account.username,
            createdAt: new Date().toLocaleString(),
            tweets: formattedTweets,
            retweets: formattedRetweets,
            likes: formattedLikes,
            users: formattedUsers,
            conversations: formattedConversations,
            messages: formattedMessages,
        }

        // Save the archive object to a file
        const assetsPath = path.join(getAccountDataPath("X", this.account.username), "assets");
        if (!fs.existsSync(assetsPath)) {
            fs.mkdirSync(assetsPath);
        }
        const archivePath = path.join(assetsPath, "archive.js");
        fs.writeFileSync(archivePath, `window.archiveData=${JSON.stringify(archive, null, 2)};`);

        // Unzip x-archive.zip to the account data folder using unzipper
        const archiveZipPath = path.join(getResourcesPath(), "x-archive.zip");
        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: getAccountDataPath("X", this.account.username) });
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
        const daysOldTimestamp = getTimestampDaysAgo(this.account.deleteTweetsDaysOld);
        if (this.account.deleteTweetsLikesThresholdEnabled && this.account.deleteTweetsRetweetsThresholdEnabled) {
            // Both likes and retweets thresholds
            tweets = exec(
                this.db,
                'SELECT tweetID, createdAt, path, username FROM tweet WHERE deletedAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ? AND retweetCount <= ? ORDER BY createdAt DESC',
                ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsLikesThreshold, this.account.deleteTweetsRetweetsThreshold],
                "all"
            ) as XTweetRow[];
        } else if (this.account.deleteTweetsLikesThresholdEnabled && !this.account.deleteTweetsRetweetsThresholdEnabled) {
            // Just likes threshold
            tweets = exec(
                this.db,
                'SELECT tweetID, createdAt, path, username FROM tweet WHERE deletedAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ? ORDER BY createdAt DESC',
                ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsLikesThreshold],
                "all"
            ) as XTweetRow[];
        } else if (!this.account.deleteTweetsLikesThresholdEnabled && this.account.deleteTweetsRetweetsThresholdEnabled) {
            // Just retweets threshold
            tweets = exec(
                this.db,
                'SELECT tweetID, createdAt, path, username FROM tweet WHERE deletedAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND retweetCount <= ? ORDER BY createdAt DESC',
                ["RT @%", this.account.username, daysOldTimestamp, this.account.deleteTweetsRetweetsThreshold],
                "all"
            ) as XTweetRow[];
        } else {
            // Neither likes nor retweets threshold
            tweets = exec(
                this.db,
                'SELECT tweetID, createdAt, path, username FROM tweet WHERE deletedAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? ORDER BY createdAt DESC',
                ["RT @%", this.account.username, daysOldTimestamp],
                "all"
            ) as XTweetRow[];
        }

        log.debug("XAccountController.deleteTweetsStart", tweets);
        return {
            tweets: tweets.map((row) => (convertTweetRowToXTweetItem(row))),
        };
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
        const daysOldTimestamp = getTimestampDaysAgo(this.account.deleteRetweetsDaysOld);
        const tweets: XTweetRow[] = exec(
            this.db,
            'SELECT id, tweetID, username FROM tweet WHERE deletedAt IS NULL AND text LIKE ? AND createdAt <= ? ORDER BY createdAt DESC',
            ["RT @%", daysOldTimestamp],
            "all"
        ) as XTweetRow[];

        log.debug("XAccountController.deleteRetweetsStart", tweets);
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
        const daysOldTimestamp = getTimestampDaysAgo(this.account.deleteLikesDaysOld);
        const tweets: XTweetRow[] = exec(
            this.db,
            'SELECT id, tweetID, username FROM tweet WHERE deletedAt IS NULL AND isLiked = ? AND createdAt <= ? ORDER BY createdAt DESC',
            [1, daysOldTimestamp],
            "all"
        ) as XTweetRow[];

        log.debug("XAccountController.deleteLikesStart", tweets);
        return {
            tweets: tweets.map((row) => (convertTweetRowToXTweetItem(row))),
        };
    }

    // Save the tweet's deletedAt timestamp
    async deleteTweet(tweetID: string) {
        if (!this.db) {
            this.initDB();
        }

        exec(this.db, 'UPDATE tweet SET deletedAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
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

    async openFolder(folderName: string) {
        if (!this.account) {
            return;
        }
        const folderPath = path.join(getAccountDataPath("X", this.account?.username), folderName);
        await shell.openPath(folderPath);
    }

    async getArchiveInfo(): Promise<XArchiveInfo> {
        const archiveInfo = emptyXArchiveInfo();
        if (!this.account || !this.account.username) {
            return archiveInfo;
        }
        const accountDataPath = getAccountDataPath("X", this.account?.username);
        const indexHTMLFilename = path.join(accountDataPath, "index.html");

        archiveInfo.folderEmpty = !fs.existsSync(accountDataPath) || fs.readdirSync(accountDataPath).length === 0;
        archiveInfo.indexHTMLExists = fs.existsSync(indexHTMLFilename);
        return archiveInfo;
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

        const totalTweetsArchived: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NOT NULL", [], "get") as Sqlite3Count;
        const totalMessagesIndexed: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM message", [], "get") as Sqlite3Count;
        const totalTweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND deletedAt IS NOT NULL", ["RT @%"], "get") as Sqlite3Count;
        const totalRetweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedAt IS NOT NULL", ["RT @%"], "get") as Sqlite3Count;
        const totalLikesDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedAt IS NOT NULL", [1], "get") as Sqlite3Count;
        const totalConversationsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM conversation WHERE deletedAt IS NOT NULL", [], "get") as Sqlite3Count;

        const progressInfo = emptyXProgressInfo();
        progressInfo.accountUUID = this.accountUUID;
        progressInfo.totalTweetsArchived = totalTweetsArchived.count;
        progressInfo.totalMessagesIndexed = totalMessagesIndexed.count;
        progressInfo.totalTweetsDeleted = totalTweetsDeleted.count;
        progressInfo.totalRetweetsDeleted = totalRetweetsDeleted.count;
        progressInfo.totalLikesDeleted = totalLikesDeleted.count;
        progressInfo.totalConversationsDeleted = totalConversationsDeleted.count;
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
        const tweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND isLiked = ? AND username = ? AND deletedAt IS NOT NULL", ["RT @%", 0, username], "get") as Sqlite3Count;
        const retweetsSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ?", ["RT @%"], "get") as Sqlite3Count;
        const retweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedAt IS NOT NULL", ["RT @%"], "get") as Sqlite3Count;
        const likesSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ?", [1], "get") as Sqlite3Count;
        const likesDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedAt IS NOT NULL", [1], "get") as Sqlite3Count;
        const conversationsSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM conversation", [], "get") as Sqlite3Count;
        const conversationsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM conversation WHERE deletedAt IS NOT NULL", [], "get") as Sqlite3Count;
        const messagesSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM message", [], "get") as Sqlite3Count;
        const messagesDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM message WHERE deletedAt IS NOT NULL", [], "get") as Sqlite3Count;

        databaseStats.tweetsSaved = tweetsSaved.count;
        databaseStats.tweetsDeleted = tweetsDeleted.count;
        databaseStats.retweetsSaved = retweetsSaved.count;
        databaseStats.retweetsDeleted = retweetsDeleted.count;
        databaseStats.likesSaved = likesSaved.count;
        databaseStats.likesDeleted = likesDeleted.count;
        databaseStats.conversationsSaved = conversationsSaved.count;
        databaseStats.conversationsDeleted = conversationsDeleted.count;
        databaseStats.messagesSaved = messagesSaved.count;
        databaseStats.messagesDeleted = messagesDeleted.count
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

        deleteReviewStats.tweetsToDelete = deleteTweetsStartResponse.tweets.length;
        deleteReviewStats.retweetsToDelete = deleteRetweetStartResponse.tweets.length;
        deleteReviewStats.likesToDelete = deleteLikesStartResponse.tweets.length;
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

    async getConfig(key: string): Promise<string | null> {
        return getConfig(key, this.db);
    }

    async setConfig(key: string, value: string) {
        return setConfig(key, value, this.db);
    }
}

const controllers: Record<number, XAccountController> = {};

const getXAccountController = (accountID: number): XAccountController => {
    log.info(`getXAccountController: accountID=${accountID}`);
    if (!controllers[accountID]) {
        controllers[accountID] = new XAccountController(accountID, getMITMController(accountID));
    }
    controllers[accountID].refreshAccount();
    return controllers[accountID];
}

export const defineIPCX = () => {
    ipcMain.handle('X:resetProgress', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return controller.resetProgress();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:createJobs', async (_, accountID: number, jobTypes: string[]): Promise<XJob[]> => {
        try {
            const controller = getXAccountController(accountID);
            return controller.createJobs(jobTypes);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getLastFinishedJob', async (_, accountID: number, jobType: string): Promise<XJob | null> => {
        try {
            const controller = getXAccountController(accountID);
            return controller.getLastFinishedJob(jobType);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:updateJob', async (_, accountID: number, jobJSON: string) => {
        try {
            const controller = getXAccountController(accountID);
            const job = JSON.parse(jobJSON) as XJob;
            controller.updateJob(job);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexStart', async (_, accountID: number) => {
        try {
            const controller = getXAccountController(accountID);
            await controller.indexStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexStop', async (_, accountID: number) => {
        try {
            const controller = getXAccountController(accountID);
            await controller.indexStop();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseTweets', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseTweets();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseLikes', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseLikes();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexTweetsFinished', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexTweetsFinished();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseConversations', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseConversations();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexIsThereMore', async (_, accountID: number): Promise<boolean> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexIsThereMore();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:resetThereIsMore', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.resetThereIsMore();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexMessagesStart', async (_, accountID: number): Promise<XIndexMessagesStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexMessagesStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexParseMessages', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexParseMessages();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexConversationsFinished', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexConversationsFinished();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexMessagesFinished', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexMessagesFinished();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexConversationFinished', async (_, accountID: number, conversationID: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.indexConversationFinished(conversationID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:indexLikesFinished', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.indexLikesFinished();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweetsStart', async (_, accountID: number): Promise<XArchiveStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.archiveTweetsStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweetsOutputPath', async (_, accountID: number): Promise<string> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.archiveTweetsOutputPath();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweet', async (_, accountID: number, tweetID: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.archiveTweet(tweetID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveTweetCheckDate', async (_, accountID: number, tweetID: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.archiveTweetCheckDate(tweetID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:archiveBuild', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.archiveBuild();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:syncProgress', async (_, accountID: number, progressJSON: string) => {
        try {
            const controller = getXAccountController(accountID);
            await controller.syncProgress(progressJSON);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:openFolder', async (_, accountID: number, folderName: string) => {
        try {
            const controller = getXAccountController(accountID);
            await controller.openFolder(folderName);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getArchiveInfo', async (_, accountID: number): Promise<XArchiveInfo> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getArchiveInfo();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:resetRateLimitInfo', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.resetRateLimitInfo();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:isRateLimited', async (_, accountID: number): Promise<XRateLimitInfo> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.isRateLimited();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getProgress', async (_, accountID: number): Promise<XProgress> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getProgress();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getProgressInfo', async (_, accountID: number): Promise<XProgressInfo> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getProgressInfo();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getDatabaseStats', async (_, accountID: number): Promise<XDatabaseStats> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getDatabaseStats();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getDeleteReviewStats', async (_, accountID: number): Promise<XDeleteReviewStats> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getDeleteReviewStats();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:saveProfileImage', async (_, accountID: number, url: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.saveProfileImage(url);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getLatestResponseData', async (_, accountID: number): Promise<ResponseData | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getLatestResponseData();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteTweetsStart', async (_, accountID: number): Promise<XDeleteTweetsStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteTweetsStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteRetweetsStart', async (_, accountID: number): Promise<XDeleteTweetsStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteRetweetsStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteLikesStart', async (_, accountID: number): Promise<XDeleteTweetsStartResponse> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.deleteLikesStart();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteTweet', async (_, accountID: number, tweetID: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.deleteTweet(tweetID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:deleteDMsMarkAllDeleted', async (_, accountID: number): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            await controller.deleteDMsMarkAllDeleted();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:getConfig', async (_, accountID: number, key: string): Promise<string | null> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.getConfig(key);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('X:setConfig', async (_, accountID: number, key: string, value: string): Promise<void> => {
        try {
            const controller = getXAccountController(accountID);
            return await controller.setConfig(key, value);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });
};