import path from 'path'

import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

import { getAccountDataPath } from './helpers'
import { XAccount, XProgress } from './shared_types'
import { runMigrations, getXAccount, exec } from './database'

import { MITMController, mitmControllers } from './mitm_proxy';

class XAccountController {
    private account: XAccount | null;
    private accountDataPath: string;
    private db: Database.Database;

    private mitmController: MITMController;
    private progress: XProgress = {
        isFetchFinished: false,
        tweetsFetched: 0,
        retweetsFetched: 0,
        tweetsDeleted: 0,
        retweetsDeleted: 0,
        likesDeleted: 0,
        directMessagesDeleted: 0,
        isRateLimited: false,
        rateLimitReset: null,
    };

    constructor(accountID: number, mitmController: MITMController) {
        this.mitmController = mitmController;

        // Load the account
        this.account = getXAccount(accountID);
        if (!this.account) {
            console.error(`XAccountController: account ${accountID} not found`);
            return;
        }

        // Make sure the account data folder exists
        this.accountDataPath = getAccountDataPath('X', this.account.username);

        // Open the database
        this.db = new Database(path.join(this.accountDataPath, 'data.db'), {});
        this.db.pragma('journal_mode = WAL');
        runMigrations(this.db, [
            {
                name: "initial",
                sql: [
                    `
                    CREATE TABLE tweet (
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
                        archivedAt DATETIME
                    );
                    `,
                ]
            }
        ])
    }

    async fetchStartMonitoring() {
        await this.mitmController.startMonitoring();
    }

    async fetchStopMonitoring() {
        await this.mitmController.stopMonitoring();
    }

    // Returns false if more data needs to be fetched
    // Returns true if we are caught up
    async fetchParse(): Promise<XProgress> {
        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            const responseData = this.mitmController.responseData[i];

            // Already processed?
            if (responseData.processed) {
                continue;
            }

            // Rate limited?
            if (responseData.status == 429) {
                this.progress.isRateLimited = true;
                this.progress.rateLimitReset = Number(responseData.headers['x-rate-limit-reset']);
                this.mitmController.responseData[i].processed = true;
                return this.progress;
            }

            // Process the next response
            if (
                responseData.url.includes("/UserTweetsAndReplies?") &&
                responseData.status == 200
            ) {
                try {
                    const body = JSON.parse(responseData.body);

                    // Validate the response
                    if (!(
                        body["data"] &&
                        body["data"]["user"] &&
                        body["data"]["user"]["result"] &&
                        body["data"]["user"]["result"]["timeline_v2"] &&
                        body["data"]["user"]["result"]["timeline_v2"]["timeline"] &&
                        body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"] &&
                        body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"].length > 0 &&
                        body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0] &&
                        body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["type"] &&
                        body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["type"] == "TimelineAddEntries" &&
                        body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["entries"]
                    )) {
                        console.log('XAccountController.fetchParse: found invalid response, skipping', body)
                        this.mitmController.responseData[i].processed = true;
                        continue;
                    }

                    // Loop through the tweets
                    for (let j = 0; j < body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["entries"].length; j++) {
                        const entry = body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["entries"][j];

                        // Quietly skip because it's not a tweet?
                        if (
                            entry &&
                            entry["content"] &&
                            entry["content"]["entryType"] &&
                            (
                                entry["content"]["entryType"] == "TimelineTimelineItem" ||
                                entry["content"]["entryType"] == "TimelineTimelineModule" ||
                                entry["content"]["entryType"] == "TimelineTimelineCursor"
                            )
                        ) {
                            continue;
                        }

                        // Validate the tweet
                        if (!(
                            entry &&
                            entry["content"] &&
                            entry["content"]["items"] &&
                            entry["content"]["items"].length > 0 &&
                            entry["content"]["items"][0] &&
                            entry["content"]["items"][0]["item"] &&
                            entry["content"]["items"][0]["item"]["itemContent"] &&
                            entry["content"]["items"][0]["item"]["itemContent"]["itemType"] &&
                            entry["content"]["items"][0]["item"]["itemContent"]["itemType"] == "TimelineTweet" &&
                            entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"] &&
                            entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"]["result"] &&
                            entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"]["result"]["legacy"]
                        )) {
                            console.log('XAccountController.fetchParse: found invalid tweet, skipping', entry)
                            continue;
                        }
                        const tweet = entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"]["result"]["legacy"];

                        // Validate the username
                        if (!(
                            entry &&
                            entry["core"] &&
                            entry["core"]["user_results"] &&
                            entry["core"]["user_results"]["result"] &&
                            entry["core"]["user_results"]["result"]["legacy"] &&
                            entry["core"]["user_results"]["result"]["legacy"]["name"]
                        )) {
                            console.log('XAccountController.fetchParse: found invalid user, skipping', entry)
                            continue;
                        }
                        const username = entry["core"]["user_results"]["result"]["legacy"]["name"];

                        // Have we seen this tweet before?
                        const existing = exec('SELECT * FROM tweet WHERE tweetID = ?', [tweet["id_str"]]);
                        if (existing.length > 0) {
                            // We have seen this tweet, so return early
                            this.mitmController.responseData[i].processed = true;

                            this.progress.isFetchFinished = true;
                            return this.progress;
                        }

                        // Add the tweet
                        exec('INSERT INTO tweet (username, tweetID, conversationID, createdAt, likeCount, quoteCount, replyCount, retweetCount, isLiked, isRetweeted, text, path, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                            username,
                            tweet["id_str"],
                            tweet["conversation_id_str"],
                            new Date(tweet["created_at"]).toISOString(),
                            tweet["favorite_count"],
                            tweet["quote_count"],
                            tweet["reply_count"],
                            tweet["retweet_count"],
                            tweet["favorited"],
                            tweet["retweeted"],
                            tweet["full_text"],
                            `${username}/status/${tweet['id_str']}`,
                            new Date().toISOString(),
                        ]);

                        // Update progress
                        if (tweet["retweeted"]) {
                            this.progress.retweetsFetched++;
                        } else {
                            this.progress.tweetsFetched++;
                        }

                        this.mitmController.responseData[i].processed = true;
                    }

                } catch (error) {
                    console.error('XAccountController.fetchParse:', error);
                    this.mitmController.responseData[i].processed = true;
                }
            }
        }

        return this.progress;
    }
}

const controllers: Record<number, XAccountController> = {};

export const defineIPCX = () => {
    ipcMain.handle('X:fetchStart', async (_, accountID: number) => {
        // If no account info exists, create it
        if (!controllers[accountID]) {
            controllers[accountID] = new XAccountController(accountID, mitmControllers[accountID]);
            // TODO: handle error if account not found
        }

        // Start monitoring network requests
        await controllers[accountID].fetchStartMonitoring();

    });

    ipcMain.handle('X:fetchStop', async (_, accountID: number) => {
        await controllers[accountID].fetchStopMonitoring();
    });

    ipcMain.handle('X:fetchParse', async (_, accountID: number): Promise<XProgress> => {
        return await controllers[accountID].fetchParse();
    });
};