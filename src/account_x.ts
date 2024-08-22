import path from 'path'
import fs from 'fs'

import fetch from 'node-fetch';

import { ipcMain, session, shell, webContents } from 'electron'
import Database from 'better-sqlite3'

import { getAccountDataPath } from './helpers'
import {
    XAccount,
    XJob,
    XProgress, emptyXProgress,
    XArchiveItem,
    XArchiveStartResponse, emptyXArchiveStartResponse,
    XRateLimitInfo, emptyXRateLimitInfo,
    XIndexMessagesStartResponse
} from './shared_types'
import { runMigrations, getXAccount, exec } from './database'
import { IMITMController, getMITMController } from './mitm_proxy';
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
export class XAccountController {
    private account: XAccount | null;
    private accountDataPath: string;
    private rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();

    // Making this public so it can be accessed in tests
    public db: Database.Database | null;

    private mitmController: IMITMController;
    private progress: XProgress = emptyXProgress();

    constructor(accountID: number, mitmController: IMITMController) {
        this.mitmController = mitmController;

        // Load the account
        this.account = getXAccount(accountID);
        if (!this.account) {
            console.error(`XAccountController: account ${accountID} not found`);
            return;
        }

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
                console.error(`XAccountController: error refreshing account`);
                return;
            }
        }
    }

    initDB() {
        if (!this.account || !this.account.username) {
            console.error("XAccountController: cannot initialize the database because the account is not found, or the account username is not found");
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
    type TEXT,
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
    messageID TEXT NOT NULL,
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
        console.log("XAccountController.resetProgress");
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
        return exec(this.db, "SELECT * FROM job WHERE status = ? ORDER BY id", ["pending"], "all");
    }

    async getLastFinishedJob(jobType: string): Promise<XJob | null> {
        if (!this.account || !this.account.username) {
            return null;
        }

        if (!this.db) {
            this.initDB();
        }

        return exec(
            this.db,
            'SELECT * FROM job WHERE jobType = ? AND status = ? AND finishedAt IS NOT NULL ORDER BY finishedAt DESC LIMIT 1',
            [jobType, "finished"],
            "get"
        );
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

    async getUsername(webContentsID: number): Promise<string | null> {
        let username = null;

        if (this.account) {
            // Start monitoring
            const ses = session.fromPartition(`persist:account-${this.account.id}`);
            await ses.clearCache();
            await this.mitmController.startMonitoring();
            await this.mitmController.startMITM(ses, ["api.x.com/1.1/account/settings.json"]);

            // Load settings page
            const wc = webContents.fromId(webContentsID);
            if (wc) {
                await wc.loadURL("https://x.com/settings");

                // Wait for the URL to finish loading
                while (wc?.isLoading()) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                await new Promise(resolve => setTimeout(resolve, 500));
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

            // Stop monitoring
            await this.mitmController.stopMonitoring();
            await this.mitmController.stopMITM(ses);
        } else {
            console.log("XAccountController.getUsername: account not found");
        }

        return username;
    }

    async indexStart() {
        const ses = session.fromPartition(`persist:account-${this.account?.id}`);
        await ses.clearCache();
        await this.mitmController.startMonitoring();
        await this.mitmController.startMITM(ses, ["x.com/i/api/graphql", "x.com/i/api/1.1/dm"]);
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
        const existing = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweetLegacy["id_str"]], "all");
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
            console.log('XAccountController.indexParseTweetsResponseData: RATE LIMITED');
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
                console.log('XAccountController.indexParseTweetsResponseData: processed', iResponse);

                if (shouldReturnFalse) {
                    return false;
                }
            } catch (error) {
                // TODO: automation error
                console.error('XAccountController.indexParseTweetsResponseData: error', error);
                console.log(responseData.url)
                console.log(responseData.body)

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
        console.log(`XAccountController.indexParseTweets: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexTweets";
        this.progress.isIndexTweetsFinished = false;

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
            const response = await fetch(user.profile_image_url_https);
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
        console.log("XAccountController.indexUser", user);
        if (!this.db) {
            this.initDB();
        }

        // Download the profile image
        const profileImageDataURI = await this.getProfileImageDataURI(user);

        // Have we seen this user before?
        const existing = exec(this.db, 'SELECT * FROM user WHERE userID = ?', [user.id_str], "all");
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
        console.log("XAccountController.indexConversation", conversation);
        if (!this.db) {
            this.initDB();
        }

        let newProgress = false;

        // Have we seen this conversation before?
        const existing = exec(this.db, 'SELECT minEntryID, maxEntryID FROM conversation WHERE conversationID = ?', [conversation.conversation_id], "all");
        if (existing.length > 0) {
            // Have we seen this exact conversation before?
            if (
                !isFirstRun &&
                existing[0].minEntryID == conversation.min_entry_id &&
                existing[0].maxEntryID == conversation.max_entry_id
            ) {
                console.log("XAccountController.indexConversation: conversation already indexed", conversation.conversation_id);
                this.mitmController.responseData[0].processed = true;
                this.progress.isIndexConversationsFinished = true;
                return false;
            }

            console.log("XAccountController.indexConversation: conversation already indexed, but needs to be updated", {
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
            console.log('XAccountController.indexParseConversationsResponseData: RATE LIMITED');
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
                } else {
                    const inbox_timeline: XAPIInboxTimeline = JSON.parse(responseData.body);
                    users = inbox_timeline.inbox_timeline.users;
                    conversations = inbox_timeline.inbox_timeline.conversations;
                }

                // Add the users
                console.log(`XAccountController.indexParseConversationsResponseData: adding ${Object.keys(users).length} users`);
                for (const userID in users) {
                    const user = users[userID];
                    await this.indexUser(user);
                }

                // Add the conversations
                console.log(`XAccountController.indexParseConversationsResponseData: adding ${Object.keys(conversations).length} conversations`);
                for (const conversationID in conversations) {
                    const conversation = conversations[conversationID];
                    if (!this.indexConversation(conversation, isFirstRun)) {
                        shouldReturnFalse = true;
                        break;
                    }
                }

                this.mitmController.responseData[iResponse].processed = true;
                console.log('XAccountController.indexParseConversationsResponseData: processed', iResponse);

                if (shouldReturnFalse) {
                    return false;
                }
            } catch (error) {
                // TODO: automation error
                console.error('XAccountController.indexParseConversationsResponseData: error', error);
                console.log(responseData.url)
                console.log(responseData.body)

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
        console.log(`XAccountController.indexParseConversations: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexConversations";
        this.progress.isIndexMessagesFinished = false;

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            if (!await this.indexParseConversationsResponseData(i, isFirstRun)) {
                return this.progress;
            }
        }

        return this.progress;
    }

    // When you start indexing DMs, return a list of DM conversationIDs to index
    async indexMessagesStart(isFirstRun: boolean): Promise<XIndexMessagesStartResponse> {
        if (!this.db) {
            this.initDB();
        }

        // On first run, we need to index all conversations
        if (isFirstRun) {
            const conversationIDs = exec(this.db, 'SELECT conversationID FROM conversation WHERE deletedAt IS NULL', [], "all");
            return {
                conversationIDs: conversationIDs.map((row) => row.conversationID)
            };
        }

        // Select just the conversations that need to be indexed
        const conversationIDs = exec(this.db, 'SELECT conversationID FROM conversation WHERE shouldIndexMessages = ? AND deletedAt IS NULL', [1], "all");
        return {
            conversationIDs: conversationIDs.map((row) => row.conversationID)
        };
    }

    // Returns false if the loop should stop
    indexMessage(message: XAPIMessage, _isFirstRun: boolean): boolean {
        console.log("XAccountController.indexMessage", message);
        if (!this.db) {
            this.initDB();
        }

        if (!message.message) {
            // skip
            return true;
        }

        // Have we seen this message before?
        const existing = exec(this.db, 'SELECT * FROM message WHERE messageID = ?', [message.message.id], "all");
        if (existing.length > 0) {
            // Delete the message so we can re-add it
            exec(this.db, 'DELETE FROM message WHERE messageID = ?', [message.message.id]);
        }

        // Add the message
        exec(this.db, 'INSERT INTO message (messageID, conversationID, createdAt, senderID, text, deletedAt) VALUES (?, ?, ?, ?, ?, ?)', [
            message.message.id,
            message.message.conversation_id,
            new Date(Number(message.message.time)),
            message.message.message_data.sender_id,
            message.message.message_data.text,
            null,
        ]);

        // Update progress
        if (existing.length == 0) {
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
            console.log('XAccountController.indexParseMessagesResponseData: RATE LIMITED');
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
                console.log("XAccountController.indexParseMessagesResponseData", iResponse);
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
                console.log(`XAccountController.indexParseMessagesResponseData: adding ${entries.length} messages`);
                for (let i = 0; i < entries.length; i++) {
                    const message = entries[i];
                    if (!this.indexMessage(message, isFirstRun)) {
                        shouldReturnFalse = true;
                        break;
                    }
                }

                this.mitmController.responseData[iResponse].processed = true;
                console.log('XAccountController.indexParseMessagesResponseData: processed', iResponse);

                if (shouldReturnFalse) {
                    return false;
                }
            } catch (error) {
                // TODO: automation error
                console.error('XAccountController.indexParseMessagesResponseData: error', error);
                console.log(responseData.url)
                console.log(responseData.body)

                // Throw an exception
                throw error;
            }
        } else {
            // Skip response
            console.log('XAccountController.indexParseMessagesResponseData: skipping response', responseData.url);
            this.mitmController.responseData[iResponse].processed = true;
        }

        return true;
    }

    // Returns true if more data needs to be indexed
    // Returns false if we are caught up
    async indexParseMessages(isFirstRun: boolean): Promise<XProgress> {
        console.log(`XAccountController.indexParseMessages: parsing ${this.mitmController.responseData.length} responses`);

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
        console.log('XAccountController.indexTweetsFinished');
        this.progress.isIndexTweetsFinished = true;
        return this.progress;
    }

    async indexConversationsFinished(): Promise<XProgress> {
        console.log('XAccountController.indexConversationsFinished');
        this.progress.isIndexConversationsFinished = true;
        return this.progress;
    }

    async indexMessagesFinished(): Promise<XProgress> {
        console.log('XAccountController.indexMessagesFinished');
        this.progress.isIndexMessagesFinished = true;
        return this.progress;
    }

    // Save the tconversation's shouldIndexMessages to false
    async indexConversationFinished(conversationID: string): Promise<boolean> {
        if (!this.db) {
            this.initDB();
        }

        exec(this.db, 'UPDATE conversation SET shouldIndexMessages = ? WHERE conversationID = ?', [0, conversationID]);
        return true;
    }

    async indexLikesFinished(): Promise<XProgress> {
        console.log('XAccountController.indexLikesFinished');
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
            const tweetsResp = exec(
                this.db,
                'SELECT tweetID, createdAt, path FROM tweet WHERE username = ? AND isRetweeted = ? ORDER BY createdAt',
                [this.account.username, 0],
                "all"
            );

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

        const tweet = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweetID], "get");
        console.log(tweet);
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
        const tweets = exec(this.db, "SELECT * FROM tweet WHERE username = ? AND isRetweeted = ?", [this.account.username, 0], "all");
        const users = exec(this.db, 'SELECT * FROM user', [], "all");
        const conversations = exec(this.db, 'SELECT * FROM conversation', [], "all");
        const conversationParticipants = exec(this.db, 'SELECT * FROM conversation_participant', [], "all");
        const messages = exec(this.db, 'SELECT * FROM message', [], "all");

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
        const formattedUsers: XArchiveTypes.User[] = users.map((user) => {
            return {
                userID: user.userID,
                name: user.name,
                username: user.screenName,
                profileImageDataURI: user.profileImageDataURI,
            }
        });
        const formattedConversations: XArchiveTypes.Conversation[] = conversations.map((conversation) => {
            return {
                conversationID: conversation.conversationID,
                type: conversation.type,
                sortTimestamp: conversation.sortTimestamp,
                participants: conversationParticipants.filter(
                    (participant) => participant.conversationID == conversation.conversationID
                ).map((participant) => participant.userID),
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
            username: this.account.username,
            createdAt: new Date(),
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

        // TODO: copy the archive files

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

    ipcMain.handle('X:getUsername', async (_, accountID: number, webContentsID: number): Promise<string | null> => {
        const controller = getXAccountController(accountID);
        return await controller.getUsername(webContentsID);
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
};