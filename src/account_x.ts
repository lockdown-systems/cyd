import path from 'path'
import fs from 'fs'

import fetch from 'node-fetch';
import unzipper from 'unzipper';

import { app, ipcMain, session, shell } from 'electron'
import log from 'electron-log/main';
import Database from 'better-sqlite3'

import { getResourcesPath, getAccountDataPath } from './util'
import {
    XAccount,
    XJob,
    XProgress, emptyXProgress,
    XArchiveItem,
    XArchiveStartResponse, emptyXArchiveStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XIndexMessagesStartResponse,
    XProgressInfo, emptyXProgressInfo,
    ResponseData,
    // XTweet
} from './shared_types'
import { runMigrations, getAccount, getXAccount, saveXAccount, exec, Sqlite3Count } from './database'
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
    XAPIUser
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

export class XAccountController {
    private accountUUID: string = "";
    private account: XAccount | null;
    private accountDataPath: string = "";
    private rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();
    private thereIsMore: boolean = false;

    // Making this public so it can be accessed in tests
    public db: Database.Database | null = null;

    public mitmController: IMITMController;
    private progress: XProgress = emptyXProgress();

    constructor(accountID: number, mitmController: IMITMController) {
        this.mitmController = mitmController;

        // Load the X account
        this.account = getXAccount(accountID);
        if (!this.account) {
            log.error(`XAccountController: account ${accountID} not found`);
            return;
        }

        // Load the account to get the UUID
        const account = getAccount(accountID);
        if (!account) {
            log.error(`XAccountController: account ${accountID} not found`);
            return;
        }
        this.accountUUID = account.uuid;
        log.debug(`XAccountController: accountUUID=${this.accountUUID}`);

        // Monitor for rate limits
        const ses = session.fromPartition(`persist:account-${this.account.id}`);
        ses.webRequest.onCompleted((details) => {
            if (details.statusCode == 429) {
                this.rateLimitInfo.isRateLimited = true;
                if (details.responseHeaders) {
                    this.rateLimitInfo.rateLimitReset = Number(details.responseHeaders['x-rate-limit-reset']);
                } else {
                    // If we can't get it from the headers, set it to 15 minutes from now
                    this.rateLimitInfo.rateLimitReset = Math.floor(Date.now() / 1000) + 900;
                }
            }
        });
    }

    refreshAccount() {
        if (this.account) {
            this.account = getXAccount(this.account.id);
            if (!this.account) {
                log.error(`XAccountController: error refreshing account`);
                return;
            }
        }
    }

    initDB() {
        if (!this.account || !this.account.username) {
            log.error("XAccountController: cannot initialize the database because the account is not found, or the account username is not found");
            return;
        }

        // Make sure the account data folder exists
        this.accountDataPath = getAccountDataPath('X', this.account.username);

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
            }
        ])
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

    async getUsernameStart() {
        log.info("XAccountController.getUsernameStart");
        const ses = session.fromPartition(`persist:account-${this.account?.id}`);
        await ses.clearCache();
        await this.mitmController.startMonitoring();
        await this.mitmController.startMITM(ses, ["api.x.com/1.1/account/settings.json"]);
    }

    async getUsernameStop() {
        log.info("XAccountController.getUsernameStop");
        await this.mitmController.stopMonitoring();
        const ses = session.fromPartition(`persist:account-${this.account?.id}`);
        await this.mitmController.stopMITM(ses);
    }

    async getUsername(): Promise<string | null> {
        log.info("XAccountController.getUsername");
        let username = null;
        if (!this.account) {
            log.error("XAccountController.getUsername: account not found");
            return username;
        }

        // See if we got settings.json
        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            // If URL starts with /1.1/account/settings.json
            if (this.mitmController.responseData[i].url.includes("/1.1/account/settings.json") && this.mitmController.responseData[i].status == 200) {
                const body = JSON.parse(this.mitmController.responseData[i].body);
                username = body.screen_name;
                break;
            }
        }

        return username;
    }

    async indexStart() {
        const ses = session.fromPartition(`persist:account-${this.account?.id}`);
        await ses.clearCache();
        await this.mitmController.startMonitoring();
        await this.mitmController.startMITM(ses, ["x.com/i/api/graphql", "x.com/i/api/1.1/dm"]);
        this.thereIsMore = true;
    }

    async indexStop() {
        await this.mitmController.stopMonitoring();
        const ses = session.fromPartition(`persist:account-${this.account?.id}`);
        await this.mitmController.stopMITM(ses);
    }

    // Returns false if the loop should stop
    indexTweet(iResponse: number, userLegacy: XAPILegacyUser, tweetLegacy: XAPILegacyTweet, isFirstRun: boolean): boolean {
        if (!this.db) {
            this.initDB();
        }

        // Have we seen this tweet before?
        const existing: XTweetRow[] = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweetLegacy["id_str"]], "all") as XTweetRow[];
        if (existing.length > 0) {
            if (isFirstRun) {
                // Delete it, so we can re-add it
                exec(this.db, 'DELETE FROM tweet WHERE tweetID = ?', [tweetLegacy["id_str"]]);
            } else {
                // We have seen this tweet, so return early
                this.mitmController.responseData[iResponse].processed = true;
                this.progress.isIndexTweetsFinished = true;
                return false;
            }
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
        if (existing.length == 0) {
            if (tweetLegacy["retweeted"]) {
                this.progress.retweetsIndexed++;
            } else {
                this.progress.tweetsIndexed++;
            }
        }

        return true;
    }

    // Returns false if the loop should stop
    indexParseTweetsResponseData(iResponse: number, isFirstRun: boolean): boolean {
        let shouldReturnFalse = false;
        const responseData = this.mitmController.responseData[iResponse];

        // Already processed?
        if (responseData.processed) {
            return true;
        }

        // Rate limited?
        if (responseData.status == 429) {
            log.warn('XAccountController.indexParseTweetsResponseData: RATE LIMITED');
            this.mitmController.responseData[iResponse].processed = true;
            return false;
        }

        // Process the next response
        if (
            responseData.url.includes("/UserTweetsAndReplies?") &&
            responseData.status == 200
        ) {
            try {
                const body: XAPIData = JSON.parse(responseData.body);

                // Loop through instructions
                body.data.user.result.timeline_v2.timeline.instructions.forEach((instructions) => {
                    if (instructions["type"] != "TimelineAddEntries") {
                        return;
                    }

                    // Loop through the entries
                    instructions.entries?.forEach((entries) => {
                        let userLegacy: XAPILegacyUser | undefined;
                        let tweetLegacy: XAPILegacyTweet | undefined;

                        if (entries.content.entryType == "TimelineTimelineModule") {
                            entries.content.items?.forEach((item) => {
                                if (item.item.itemContent.tweet_results?.result.core) {
                                    userLegacy = item.item.itemContent.tweet_results?.result.core.user_results.result?.legacy;
                                    tweetLegacy = item.item.itemContent.tweet_results?.result.legacy;
                                }
                                if (item.item.itemContent.tweet_results?.result.tweet) {
                                    userLegacy = item.item.itemContent.tweet_results?.result.tweet.core.user_results.result?.legacy;
                                    tweetLegacy = item.item.itemContent.tweet_results?.result.tweet.legacy;
                                }

                                if (userLegacy && tweetLegacy && !this.indexTweet(iResponse, userLegacy, tweetLegacy, isFirstRun)) {
                                    shouldReturnFalse = true;
                                    return;
                                }
                            });
                        } else if (entries.content.entryType == "TimelineTimelineItem") {
                            if (entries.content.itemContent?.tweet_results?.result.core) {
                                userLegacy = entries.content.itemContent?.tweet_results?.result.core.user_results.result?.legacy;
                                tweetLegacy = entries.content.itemContent?.tweet_results?.result.legacy;
                            }
                            if (entries.content.itemContent?.tweet_results?.result.tweet) {
                                userLegacy = entries.content.itemContent?.tweet_results?.result.tweet.core.user_results.result?.legacy;
                                tweetLegacy = entries.content.itemContent?.tweet_results?.result.tweet.legacy;
                            }

                            if (userLegacy && tweetLegacy && !this.indexTweet(iResponse, userLegacy, tweetLegacy, isFirstRun)) {
                                shouldReturnFalse = true;
                                return;
                            }
                        }


                    });

                    if (shouldReturnFalse) {
                        return;
                    }
                });

                this.mitmController.responseData[iResponse].processed = true;
                log.debug('XAccountController.indexParseTweetsResponseData: processed', iResponse);

                if (shouldReturnFalse) {
                    return false;
                }
            } catch (error) {
                // TODO: automation error
                log.error('XAccountController.indexParseTweetsResponseData: error', error);
                log.debug(responseData.url)
                log.debug(responseData.body)

                // Throw an exception
                throw error;
            }
        } else {
            // Skip response
            this.mitmController.responseData[iResponse].processed = true;
        }

        return true;
    }

    // Parses the response data so far to index tweets that have been collected
    // Returns the progress object
    async indexParseTweets(isFirstRun: boolean): Promise<XProgress> {
        log.info(`XAccountController.indexParseTweets: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexTweets";
        this.progress.isIndexTweetsFinished = false;

        await this.mitmController.clearProcessed();

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            if (!this.indexParseTweetsResponseData(i, isFirstRun)) {
                return this.progress;
            }
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

    // Returns false if the loop should stop
    indexConversation(conversation: XAPIConversation, isFirstRun: boolean): boolean {
        log.debug("XAccountController.indexConversation", conversation);
        if (!this.db) {
            this.initDB();
        }

        let newProgress = false;

        // Have we seen this conversation before?
        const existing: XConversationRow[] = exec(this.db, 'SELECT minEntryID, maxEntryID FROM conversation WHERE conversationID = ?', [conversation.conversation_id], "all") as XConversationRow[];
        if (existing.length > 0) {
            // Have we seen this exact conversation before?
            if (
                !isFirstRun &&
                existing[0].minEntryID == conversation.min_entry_id &&
                existing[0].maxEntryID == conversation.max_entry_id
            ) {
                log.debug("XAccountController.indexConversation: conversation already indexed", conversation.conversation_id);
                this.mitmController.responseData[0].processed = true;
                this.progress.isIndexConversationsFinished = true;
                return false;
            }

            log.debug("XAccountController.indexConversation: conversation already indexed, but needs to be updated", {
                oldMinEntryID: existing[0].minEntryID,
                oldMaxEntryID: existing[0].maxEntryID,
                newMinEntryID: conversation.min_entry_id,
                newMaxEntryID: conversation.max_entry_id,
            });

            newProgress = true;

            // Update the conversation
            exec(this.db, 'UPDATE conversation SET sortTimestamp = ?, type = ?, minEntryID = ?, maxEntryID = ?, isTrusted = ?, updatedInDatabaseAt = ?, shouldIndexMessages = ? WHERE conversationID = ?', [
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
            newProgress = true;

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
        if (newProgress) {
            this.progress.conversationsIndexed++;
        }

        return true;
    }

    // Returns false if the loop should stop
    async indexParseConversationsResponseData(iResponse: number, isFirstRun: boolean): Promise<boolean> {
        let shouldReturnFalse = false;
        const responseData = this.mitmController.responseData[iResponse];

        // Already processed?
        if (responseData.processed) {
            return true;
        }

        // Rate limited?
        if (responseData.status == 429) {
            log.warn('XAccountController.indexParseConversationsResponseData: RATE LIMITED');
            this.mitmController.responseData[iResponse].processed = true;
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
            try {
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
                log.info(`XAccountController.indexParseConversationsResponseData: adding ${Object.keys(users).length} users`);
                for (const userID in users) {
                    const user = users[userID];
                    await this.indexUser(user);
                }

                // Add the conversations
                log.info(`XAccountController.indexParseConversationsResponseData: adding ${Object.keys(conversations).length} conversations`);
                for (const conversationID in conversations) {
                    const conversation = conversations[conversationID];
                    if (!this.indexConversation(conversation, isFirstRun)) {
                        shouldReturnFalse = true;
                        break;
                    }
                }

                this.mitmController.responseData[iResponse].processed = true;
                log.debug('XAccountController.indexParseConversationsResponseData: processed', iResponse);

                if (shouldReturnFalse) {
                    return false;
                }
            } catch (error) {
                // TODO: automation error
                log.error('XAccountController.indexParseConversationsResponseData: error', error);
                log.debug(responseData.url)
                log.debug(responseData.body)

                // Throw an exception
                throw error;
            }
        } else {
            // Skip response
            this.mitmController.responseData[iResponse].processed = true;
        }

        return true;
    }

    // Returns true if more data needs to be indexed
    // Returns false if we are caught up
    async indexParseConversations(isFirstRun: boolean): Promise<XProgress> {
        log.info(`XAccountController.indexParseConversations: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexConversations";
        this.progress.isIndexMessagesFinished = false;

        await this.mitmController.clearProcessed();

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            if (!await this.indexParseConversationsResponseData(i, isFirstRun)) {
                return this.progress;
            }
        }

        return this.progress;
    }

    async indexIsThereMore(): Promise<boolean> {
        return this.thereIsMore;
    }

    // When you start indexing DMs, return a list of DM conversationIDs to index
    async indexMessagesStart(isFirstRun: boolean): Promise<XIndexMessagesStartResponse> {
        if (!this.db) {
            this.initDB();
        }

        // On first run, we need to index all conversations
        if (isFirstRun) {
            const conversationIDs: XConversationRow[] = exec(this.db, 'SELECT conversationID FROM conversation WHERE deletedAt IS NULL', [], "all") as XConversationRow[];
            return {
                conversationIDs: conversationIDs.map((row) => row.conversationID),
                totalConversations: conversationIDs.length
            };
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

    // Returns false if the loop should stop
    indexMessage(message: XAPIMessage, _isFirstRun: boolean): boolean {
        log.debug("XAccountController.indexMessage", message);
        if (!this.db) {
            this.initDB();
        }

        if (!message.message) {
            // skip
            return true;
        }

        // Have we seen this message before?
        const existingCount: Sqlite3Count = exec(this.db, 'SELECT COUNT(*) AS count FROM message WHERE messageID = ?', [message.message.id], "get") as Sqlite3Count;
        log.debug("XAccountController.indexMessage: existingCount", existingCount);
        const isInsert = existingCount.count === 0;

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
        if (isInsert) {
            this.progress.messagesIndexed++;
        }

        return true;
    }

    // Returns false if the loop should stop
    async indexParseMessagesResponseData(iResponse: number, isFirstRun: boolean): Promise<boolean> {
        let shouldReturnFalse = false;
        const responseData = this.mitmController.responseData[iResponse];

        // Already processed?
        if (responseData.processed) {
            return true;
        }

        // Rate limited?
        if (responseData.status == 429) {
            log.warn('XAccountController.indexParseMessagesResponseData: RATE LIMITED');
            this.mitmController.responseData[iResponse].processed = true;
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
            try {
                log.debug("XAccountController.indexParseMessagesResponseData", iResponse);
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
                log.info(`XAccountController.indexParseMessagesResponseData: adding ${entries.length} messages`);
                for (let i = 0; i < entries.length; i++) {
                    const message = entries[i];
                    if (!this.indexMessage(message, isFirstRun)) {
                        shouldReturnFalse = true;
                        break;
                    }
                }

                this.mitmController.responseData[iResponse].processed = true;
                log.debug('XAccountController.indexParseMessagesResponseData: processed', iResponse);

                if (shouldReturnFalse) {
                    return false;
                }
            } catch (error) {
                // TODO: automation error
                log.error('XAccountController.indexParseMessagesResponseData: error', error);
                log.debug(responseData.url)
                log.debug(responseData.body)

                // Throw an exception
                throw error;
            }
        } else {
            // Skip response
            log.debug('XAccountController.indexParseMessagesResponseData: skipping response', responseData.url);
            this.mitmController.responseData[iResponse].processed = true;
        }

        return true;
    }

    // Returns true if more data needs to be indexed
    // Returns false if we are caught up
    async indexParseMessages(isFirstRun: boolean): Promise<XProgress> {
        log.info(`XAccountController.indexParseMessages: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexMessages";
        this.progress.isIndexMessagesFinished = false;

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            if (!await this.indexParseMessagesResponseData(i, isFirstRun)) {
                this.progress.shouldStopEarly = true;
                return this.progress;
            }
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
    async indexConversationFinished(conversationID: string): Promise<boolean> {
        if (!this.db) {
            this.initDB();
        }

        exec(this.db, 'UPDATE conversation SET shouldIndexMessages = ? WHERE conversationID = ?', [0, conversationID]);
        return true;
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
                'SELECT tweetID, createdAt, path FROM tweet WHERE username = ? AND isRetweeted = ? ORDER BY createdAt',
                [this.account.username, 0],
                "all"
            ) as XTweetRow[];

            const items: XArchiveItem[] = [];
            for (let i = 0; i < tweetsResp.length; i++) {
                items.push({
                    url: `https://x.com/${tweetsResp[i].path}`,
                    id: tweetsResp[i].tweetID,
                    basename: `${formatDateToYYYYMMDD(tweetsResp[i].createdAt)}_${tweetsResp[i].tweetID}`
                })
            }

            // Make sure the Archived Tweets folder exists
            const accountDataPath = getAccountDataPath("X", this.account.username);
            const outputPath = path.join(accountDataPath, "Archived Tweets");
            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath);
            }

            return {
                outputPath: outputPath,
                items: items
            };
        }
        return emptyXArchiveStartResponse();
    }

    // Save the tweet's archivedAt timestamp
    async archiveTweet(tweetID: string): Promise<boolean> {
        if (!this.db) {
            this.initDB();
        }

        exec(this.db, 'UPDATE tweet SET archivedAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        return true;
    }

    // If the tweet doesn't have an archivedAt timestamp, set one
    async archiveTweetCheckDate(tweetID: string): Promise<boolean> {
        if (!this.db) {
            this.initDB();
        }

        const tweet: XTweetRow = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweetID], "get") as XTweetRow;
        if (!tweet.archivedAt) {
            exec(this.db, 'UPDATE tweet SET archivedAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        }
        return true;
    }

    async archiveBuild(): Promise<boolean> {
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            return false;
        }

        // Select everything from database
        const tweets: XTweetRow[] = exec(this.db, "SELECT * FROM tweet WHERE username = ? AND isRetweeted = ?", [this.account.username, 0], "all") as XTweetRow[];
        const users: XUserRow[] = exec(this.db, 'SELECT * FROM user', [], "all") as XUserRow[];
        const conversations: XConversationRow[] = exec(this.db, 'SELECT * FROM conversation ORDER BY sortTimestamp DESC', [], "all") as XConversationRow[];
        const conversationParticipants: XConversationParticipantRow[] = exec(this.db, 'SELECT * FROM conversation_participant', [], "all") as XConversationParticipantRow[];
        const messages: XMessageRow[] = exec(this.db, 'SELECT * FROM message', [], "all") as XMessageRow[];

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
            semipheralVersion: app.getVersion(),
            username: this.account.username,
            createdAt: new Date().toLocaleString(),
            tweets: formattedTweets,
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
        fs.writeFileSync(archivePath, `window.archiveData=${JSON.stringify(archive)};`);

        // Unzip x-archive.zip to the account data folder using unzipper
        const archiveZipPath = path.join(getResourcesPath(), "x-archive.zip");
        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: getAccountDataPath("X", this.account.username) });

        return true;
    }

    async syncProgress(progressJSON: string) {
        this.progress = JSON.parse(progressJSON);
    }

    async openFolder(folderName: string) {
        if (this.account) {
            const folderPath = path.join(getAccountDataPath("X", this.account?.username), folderName);
            await shell.openPath(folderPath);
        }
    }

    async resetRateLimitInfo(): Promise<void> {
        this.rateLimitInfo = emptyXRateLimitInfo();
    }

    async isRateLimited(): Promise<XRateLimitInfo> {
        return this.rateLimitInfo;
    }

    async getProgressInfo(): Promise<XProgressInfo> {
        const totalTweetsArchived: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NOT NULL", [], "get") as Sqlite3Count;
        const totalMessagesIndexed: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM message", [], "get") as Sqlite3Count;
        const totalTweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE deletedAt IS NOT NULL", [], "get") as Sqlite3Count;
        const totalRetweetsDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM tweet WHERE isRetweeted = ? AND deletedAt IS NOT NULL", [1], "get") as Sqlite3Count;
        const totalMessagesDeleted: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM message WHERE deletedAt IS NOT NULL", [], "get") as Sqlite3Count;

        const progressInfo = emptyXProgressInfo();
        progressInfo.accountUUID = this.accountUUID;
        progressInfo.totalTweetsArchived = totalTweetsArchived.count;
        progressInfo.totalMessagesIndexed = totalMessagesIndexed.count;
        progressInfo.totalTweetsDeleted = totalTweetsDeleted.count;
        progressInfo.totalRetweetsDeleted = totalRetweetsDeleted.count;
        progressInfo.totalLikesDeleted = 0;
        progressInfo.totalMessagesDeleted = totalMessagesDeleted.count;
        return progressInfo;
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
}

const controllers: Record<number, XAccountController> = {};

const getXAccountController = (accountID: number): XAccountController => {
    if (!controllers[accountID]) {
        controllers[accountID] = new XAccountController(accountID, getMITMController(accountID));
    }
    controllers[accountID].refreshAccount();
    return controllers[accountID];
}

export const defineIPCX = () => {
    ipcMain.handle('X:resetProgress', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return controller.resetProgress();
    });

    ipcMain.handle('X:createJobs', async (_, accountID: number, jobTypes: string[]): Promise<XJob[]> => {
        const controller = getXAccountController(accountID);
        return controller.createJobs(jobTypes);
    });

    ipcMain.handle('X:getLastFinishedJob', async (_, accountID: number, jobType: string): Promise<XJob | null> => {
        const controller = getXAccountController(accountID);
        return controller.getLastFinishedJob(jobType);
    });

    ipcMain.handle('X:updateJob', async (_, accountID: number, jobJSON: string) => {
        const controller = getXAccountController(accountID);
        const job = JSON.parse(jobJSON) as XJob;
        controller.updateJob(job);
    });

    ipcMain.handle('X:getUsernameStart', async (_, accountID: number): Promise<void> => {
        const controller = getXAccountController(accountID);
        await controller.getUsernameStart();
    });

    ipcMain.handle('X:getUsernameStop', async (_, accountID: number): Promise<void> => {
        const controller = getXAccountController(accountID);
        await controller.getUsernameStop();
    });

    ipcMain.handle('X:getUsername', async (_, accountID: number): Promise<string | null> => {
        const controller = getXAccountController(accountID);
        return await controller.getUsername();
    });

    ipcMain.handle('X:indexStart', async (_, accountID: number) => {
        const controller = getXAccountController(accountID);
        await controller.indexStart();

    });

    ipcMain.handle('X:indexStop', async (_, accountID: number) => {
        const controller = getXAccountController(accountID);
        await controller.indexStop();
    });

    ipcMain.handle('X:indexParseTweets', async (_, accountID: number, isFirstRun: boolean): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexParseTweets(isFirstRun);
    });

    ipcMain.handle('X:indexTweetsFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexTweetsFinished();
    });

    ipcMain.handle('X:indexParseConversations', async (_, accountID: number, isFirstRun: boolean): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexParseConversations(isFirstRun);
    });

    ipcMain.handle('X:indexIsThereMore', async (_, accountID: number): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.indexIsThereMore();
    });

    ipcMain.handle('X:indexMessagesStart', async (_, accountID: number, isFirstRun: boolean): Promise<XIndexMessagesStartResponse> => {
        const controller = getXAccountController(accountID);
        return await controller.indexMessagesStart(isFirstRun);
    });

    ipcMain.handle('X:indexParseMessages', async (_, accountID: number, isFirstRun: boolean): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexParseMessages(isFirstRun);
    });

    ipcMain.handle('X:indexConversationsFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexConversationsFinished();
    });

    ipcMain.handle('X:indexMessagesFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexMessagesFinished();
    });

    ipcMain.handle('X:indexConversationFinished', async (_, accountID: number, conversationID: string): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.indexConversationFinished(conversationID);
    });

    ipcMain.handle('X:indexLikesFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexLikesFinished();
    });

    ipcMain.handle('X:archiveTweetsStart', async (_, accountID: number): Promise<XArchiveStartResponse> => {
        const controller = getXAccountController(accountID);
        return await controller.archiveTweetsStart();
    });

    ipcMain.handle('X:archiveTweet', async (_, accountID: number, tweetID: string): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.archiveTweet(tweetID);
    });

    ipcMain.handle('X:archiveTweetCheckDate', async (_, accountID: number, tweetID: string): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.archiveTweetCheckDate(tweetID);
    });

    ipcMain.handle('X:archiveBuild', async (_, accountID: number): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.archiveBuild();
    });

    ipcMain.handle('X:syncProgress', async (_, accountID: number, progressJSON: string) => {
        const controller = getXAccountController(accountID);
        await controller.syncProgress(progressJSON);
    });

    ipcMain.handle('X:openFolder', async (_, accountID: number, folderName: string) => {
        const controller = getXAccountController(accountID);
        await controller.openFolder(folderName);
    });

    ipcMain.handle('X:resetRateLimitInfo', async (_, accountID: number): Promise<void> => {
        const controller = getXAccountController(accountID);
        return await controller.resetRateLimitInfo();
    });

    ipcMain.handle('X:isRateLimited', async (_, accountID: number): Promise<XRateLimitInfo> => {
        const controller = getXAccountController(accountID);
        return await controller.isRateLimited();
    });

    ipcMain.handle('X:getProgressInfo', async (_, accountID: number): Promise<XProgressInfo> => {
        const controller = getXAccountController(accountID);
        return await controller.getProgressInfo();
    });

    ipcMain.handle('X:saveProfileImage', async (_, accountID: number, url: string): Promise<void> => {
        const controller = getXAccountController(accountID);
        return await controller.saveProfileImage(url);
    });

    ipcMain.handle('X:getLatestResponseData', async (_, accountID: number): Promise<ResponseData | null> => {
        const controller = getXAccountController(accountID);
        return await controller.getLatestResponseData();
    });
};