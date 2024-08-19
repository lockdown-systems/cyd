import path from 'path'
import fs from 'fs'

import fetch from 'node-fetch';

import { ipcMain, session, shell, webContents } from 'electron'
import Database from 'better-sqlite3'

import { getAccountDataPath } from './helpers'
import { XAccount, XJob, XProgress, XArchiveItem, XArchiveStartResponse, XIsRateLimitedResponse, XIndexDMsStartResponse } from './shared_types'
import { runMigrations, getXAccount, exec } from './database'
import { IMITMController, getMITMController } from './mitm_proxy';
import { XAPILegacyUser, XAPILegacyTweet, XAPIData, XAPIInboxTimeline, XAPIInboxInitialState, XAPIConversation, XAPIConversationTimeline, XAPIMessage, XAPIUser } from './account_x_types'

function formatDateToYYYYMMDD(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function emptyProgress(): XProgress {
    return {
        currentJob: "",
        isIndexTweetsFinished: false,
        isIndexDMConversationsFinished: false,
        isIndexDMsFinished: false,
        isIndexLikesFinished: false,
        isArchiveTweetsFinished: false,
        isDeleteFinished: false,
        tweetsIndexed: 0,
        retweetsIndexed: 0,
        dmUsersIndexed: 0,
        dmConversationsIndexed: 0,
        dmMessagesIndexed: 0,
        likesIndexed: 0,
        totalTweetsToArchive: 0,
        tweetsArchived: 0,
        tweetsDeleted: 0,
        retweetsDeleted: 0,
        likesDeleted: 0,
        dmConversationsDeleted: 0,
        isRateLimited: false,
        rateLimitReset: null,
    }
}

export class XAccountController {
    private account: XAccount | null;
    private accountDataPath: string;

    // Making this public so it can be accessed in tests
    public db: Database.Database | null;

    private mitmController: IMITMController;
    private progress: XProgress = emptyProgress();

    constructor(accountID: number, mitmController: IMITMController) {
        this.mitmController = mitmController;

        // Load the account
        this.account = getXAccount(accountID);
        if (!this.account) {
            console.error(`XAccountController: account ${accountID} not found`);
            return;
        }
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
        this.progress = emptyProgress();
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
        if (tweetLegacy["retweeted"]) {
            this.progress.retweetsIndexed++;
        } else {
            this.progress.tweetsIndexed++;
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
            this.progress.isRateLimited = true;
            this.progress.rateLimitReset = Number(responseData.headers['x-rate-limit-reset']);
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
                // console.log('XAccountController.indexParseTweetsResponseData: body', responseData.body);

                // Loop through instructions
                body.data.user.result.timeline_v2.timeline.instructions.forEach((instructions) => {
                    if (instructions["type"] != "TimelineAddEntries") {
                        return;
                    }

                    // Loop through the entries
                    instructions.entries?.forEach((entries) => {
                        if (entries.content.entryType == "TimelineTimelineModule") {
                            entries.content.items?.forEach((item) => {
                                const userLegacy = item.item.itemContent.tweet_results?.result.core.user_results.result?.legacy;
                                const tweetLegacy = item.item.itemContent.tweet_results?.result.legacy;
                                if (userLegacy && tweetLegacy && !this.indexTweet(iResponse, userLegacy, tweetLegacy, isFirstRun)) {
                                    shouldReturnFalse = true;
                                    return;
                                }
                            });
                        } else if (entries.content.entryType == "TimelineTimelineItem") {
                            const userLegacy = entries.content.itemContent?.tweet_results?.result.core.user_results.result?.legacy;
                            const tweetLegacy = entries.content.itemContent?.tweet_results?.result.legacy;
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

    async indexDMUser(user: XAPIUser) {
        console.log("XAccountController.indexDMUser", user);
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
        this.progress.dmUsersIndexed++;
    }

    // Returns false if the loop should stop
    indexDMConversation(conversation: XAPIConversation, isFirstRun: boolean): boolean {
        console.log("XAccountController.indexDMConversation", conversation);
        if (!this.db) {
            this.initDB();
        }

        // Have we seen this conversation before?
        const existing = exec(this.db, 'SELECT * FROM conversation WHERE conversationID = ?', [conversation.conversation_id], "all");
        if (
            existing.length > 0) {
            // Have we seen this exact conversation before?
            if (!isFirstRun && existing[0].minEntryID == conversation.min_entry_id && existing[0].maxEntryID == conversation.max_entry_id && existing[0].isTrusted == conversation.trusted) {
                this.mitmController.responseData[0].processed = true;
                this.progress.isIndexDMConversationsFinished = true;
                return false;
            }

            // Update the conversation
            exec(this.db, 'UPDATE conversation SET sortTimestamp = ?, type = ?, minEntryID = ?, maxEntryID = ?, isTrusted = ? WHERE conversationID = ?', [
                conversation.sort_timestamp,
                conversation.type,
                conversation.min_entry_id,
                conversation.max_entry_id,
                conversation.conversation_id,
                conversation.trusted ? 1 : 0,
            ]);
        } else {
            // Add the conversation
            exec(this.db, 'INSERT INTO conversation (conversationID, type, sortTimestamp, minEntryID, maxEntryID, isTrusted, addedToDatabaseAt, shouldIndexMessages, shouldArchive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                conversation.conversation_id,
                conversation.type,
                conversation.sort_timestamp,
                conversation.min_entry_id,
                conversation.max_entry_id,
                conversation.trusted ? 1 : 0,
                new Date(),
                1,
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
        this.progress.dmConversationsIndexed++;

        return true;
    }

    // Returns false if the loop should stop
    async indexParseDMConversationsResponseData(iResponse: number, isFirstRun: boolean): Promise<boolean> {
        let shouldReturnFalse = false;
        const responseData = this.mitmController.responseData[iResponse];

        // Already processed?
        if (responseData.processed) {
            return true;
        }

        // Rate limited?
        if (responseData.status == 429) {
            console.log('XAccountController.indexParseDMConversationsResponseData: RATE LIMITED');
            this.progress.isRateLimited = true;
            this.progress.rateLimitReset = Number(responseData.headers['x-rate-limit-reset']);
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
            let users: Record<string, XAPIUser>;
            let conversations: Record<string, XAPIConversation>;
            if (
                responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json") ||
                responseData.url.includes("/i/api/1.1/dm/user_updates.json")
            ) {
                const inbox_initial_state: XAPIInboxInitialState = JSON.parse(responseData.body);
                users = inbox_initial_state.inbox_initial_state.users;
                conversations = inbox_initial_state.inbox_initial_state.conversations;
            } else {
                const inbox_timeline: XAPIInboxTimeline = JSON.parse(responseData.body);
                users = inbox_timeline.inbox_timeline.users;
                conversations = inbox_timeline.inbox_timeline.conversations;
            }

            // Add the users
            console.log(`XAccountController.indexParseDMConversationsResponseData: adding ${Object.keys(users).length} users`);
            for (const userID in users) {
                const user = users[userID];
                await this.indexDMUser(user);
            }

            // Add the conversations
            console.log(`XAccountController.indexParseDMConversationsResponseData: adding ${Object.keys(conversations).length} conversations`);
            for (const conversationID in conversations) {
                const conversation = conversations[conversationID];
                if (!this.indexDMConversation(conversation, isFirstRun)) {
                    shouldReturnFalse = true;
                    break;
                }
            }

            this.mitmController.responseData[iResponse].processed = true;
            console.log('XAccountController.indexParseDMConversationsResponseData: processed', iResponse);

            if (shouldReturnFalse) {
                return false;
            }
        } else {
            // Skip response
            this.mitmController.responseData[iResponse].processed = true;
        }

        return true;
    }

    // Returns true if more data needs to be indexed
    // Returns false if we are caught up
    async indexParseDMConversations(isFirstRun: boolean): Promise<XProgress> {
        console.log(`XAccountController.indexParseDMConversations: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexDMs";
        this.progress.isIndexDMsFinished = false;

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            if (!await this.indexParseDMConversationsResponseData(i, isFirstRun)) {
                return this.progress;
            }
        }

        return this.progress;
    }

    // When you start indexing DMs, return a list of DM conversationIDs to index
    async indexDMsStart(isFirstRun: boolean): Promise<XIndexDMsStartResponse> {
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
    indexDMMessage(message: XAPIMessage, _isFirstRun: boolean): boolean {
        console.log("XAccountController.indexDMMessage", message);
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

        // Mark the conversation as needing to be archived
        exec(this.db, 'UPDATE conversation SET shouldArchive = ? WHERE conversationID = ?', [1, message.message.conversation_id]);

        // Update progress
        this.progress.dmMessagesIndexed++;

        return true;
    }

    // Returns false if the loop should stop
    async indexParseDMsResponseData(iResponse: number, isFirstRun: boolean): Promise<boolean> {
        let shouldReturnFalse = false;
        const responseData = this.mitmController.responseData[iResponse];

        // Already processed?
        if (responseData.processed) {
            return true;
        }

        // Rate limited?
        if (responseData.status == 429) {
            console.log('XAccountController.indexParseDMsResponseData: RATE LIMITED');
            this.progress.isRateLimited = true;
            this.progress.rateLimitReset = Number(responseData.headers['x-rate-limit-reset']);
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
            console.log("XAccountController.indexParseDMsResponseData", iResponse);
            let entries: XAPIMessage[];

            if (responseData.url.includes("/i/api/1.1/dm/conversation/")) {
                // XAPIConversationTimeline
                const conversationTimeline: XAPIConversationTimeline = JSON.parse(responseData.body);
                entries = conversationTimeline.conversation_timeline.entries;
            } else {
                // XAPIInboxInitialState
                const inbox_initial_state: XAPIInboxInitialState = JSON.parse(responseData.body);
                entries = inbox_initial_state.inbox_initial_state.entries;
            }

            // Add the messages
            console.log(`XAccountController.indexParseDMsResponseData: adding ${entries.length} messages`);
            for (let i = 0; i < entries.length; i++) {
                const message = entries[i];
                if (!this.indexDMMessage(message, isFirstRun)) {
                    shouldReturnFalse = true;
                    break;
                }
            }

            this.mitmController.responseData[iResponse].processed = true;
            console.log('XAccountController.indexParseDMsResponseData: processed', iResponse);

            if (shouldReturnFalse) {
                return false;
            }

        } else {
            // Skip response
            console.log('XAccountController.indexParseDMsResponseData: skipping response', responseData.url);
            this.mitmController.responseData[iResponse].processed = true;
        }

        return true;
    }

    // Returns true if more data needs to be indexed
    // Returns false if we are caught up
    async indexParseDMs(isFirstRun: boolean): Promise<XProgress> {
        console.log(`XAccountController.indexParseDMs: parsing ${this.mitmController.responseData.length} responses`);

        this.progress.currentJob = "indexDMs";
        this.progress.isIndexDMsFinished = false;

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            if (!await this.indexParseDMsResponseData(i, isFirstRun)) {
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

    async indexDMConversationsFinished(): Promise<XProgress> {
        console.log('XAccountController.indexDMConversationsFinished');
        this.progress.isIndexDMConversationsFinished = true;
        return this.progress;
    }

    async indexDMsFinished(): Promise<XProgress> {
        console.log('XAccountController.indexDMsFinished');
        this.progress.isIndexDMsFinished = true;
        return this.progress;
    }

    // Save the tconversation's shouldIndexMessages to false
    async indexDMConversationFinished(conversationID: string): Promise<boolean> {
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
    async archiveTweetsStart(): Promise<XArchiveStartResponse | null> {
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
        return null;
    }

    // Save the tweet's archivedAt timestamp
    async archiveTweet(tweetID: string): Promise<boolean> {
        if (!this.db) {
            this.initDB();
        }

        exec(this.db, 'UPDATE tweet SET archivedAt = ? WHERE tweetID = ?', [new Date(), tweetID]);
        return true;
    }

    async archiveBuild(): Promise<boolean> {
        if (!this.db) {
            this.initDB();
        }

        // TODO: build the archive, but for now just place an index.html file there
        if (this.account) {
            const indexPath = path.join(getAccountDataPath("X", this.account.username), "index.html");
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>X archive placeholder</title>
</head>
<body>
    <h1>X archive placeholder</h1>
</body>
</html>
`;

            // Write the HTML content to the file
            fs.writeFileSync(indexPath, htmlContent);
        }

        return true;
    }

    async openFolder(folderName: string) {
        if (this.account) {
            const folderPath = path.join(getAccountDataPath("X", this.account?.username), folderName);
            await shell.openPath(folderPath);
        }
    }

    async isRateLimited(webContentsID: number, url: string): Promise<XIsRateLimitedResponse> {
        const resp = {
            isRateLimited: false,
            rateLimitReset: 0
        }

        if (this.account) {
            // Start monitoring
            const ses = session.fromPartition(`persist:account-${this.account.id}`);
            await ses.clearCache();
            await this.mitmController.startMonitoring();
            await this.mitmController.startMITM(ses, ["x.com/i/api/graphql"]);

            // Load a URL that requires the API
            const wc = webContents.fromId(webContentsID);
            if (wc) {
                await wc.loadURL(url);

                // Wait for the URL to finish loading
                while (wc?.isLoading()) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // See if we got rate limited
            for (let i = 0; i < this.mitmController.responseData.length; i++) {
                if (this.mitmController.responseData[i].status == 429) {
                    resp.isRateLimited = true;
                    resp.rateLimitReset = Number(this.mitmController.responseData[i].headers['x-rate-limit-reset']);
                    break;
                }
            }

            // Stop monitoring
            await this.mitmController.stopMonitoring();
            await this.mitmController.stopMITM(ses);
        }

        return resp;
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

    ipcMain.handle('X:indexParseDMConversations', async (_, accountID: number, isFirstRun: boolean): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexParseDMConversations(isFirstRun);
    });

    ipcMain.handle('X:indexDMsStart', async (_, accountID: number, isFirstRun: boolean): Promise<XIndexDMsStartResponse> => {
        const controller = getXAccountController(accountID);
        return await controller.indexDMsStart(isFirstRun);
    });

    ipcMain.handle('X:indexParseDMs', async (_, accountID: number, isFirstRun: boolean): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexParseDMs(isFirstRun);
    });

    ipcMain.handle('X:indexDMConversationsFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexDMConversationsFinished();
    });

    ipcMain.handle('X:indexDMsFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexDMsFinished();
    });

    ipcMain.handle('X:indexDMConversationFinished', async (_, accountID: number, conversationID: string): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.indexDMConversationFinished(conversationID);
    });

    ipcMain.handle('X:indexLikesFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getXAccountController(accountID);
        return await controller.indexLikesFinished();
    });

    ipcMain.handle('X:archiveTweetsStart', async (_, accountID: number): Promise<XArchiveStartResponse | null> => {
        const controller = getXAccountController(accountID);
        return await controller.archiveTweetsStart();
    });

    ipcMain.handle('X:archiveTweet', async (_, accountID: number, tweetID: string): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.archiveTweet(tweetID);
    });

    ipcMain.handle('X:archiveBuild', async (_, accountID: number): Promise<boolean> => {
        const controller = getXAccountController(accountID);
        return await controller.archiveBuild();
    });

    ipcMain.handle('X:openFolder', async (_, accountID: number, folderName: string) => {
        const controller = getXAccountController(accountID);
        await controller.openFolder(folderName);
    });

    ipcMain.handle('X:isRateLimited', async (_, accountID: number, webContentsID: number, url: string): Promise<XIsRateLimitedResponse> => {
        const controller = getXAccountController(accountID);
        return await controller.isRateLimited(webContentsID, url);
    });
};