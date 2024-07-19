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
        this.db = new Database(path.join(this.accountDataPath, 'data.sqlite3'), {});
        this.db.pragma('journal_mode = WAL');
        runMigrations(this.db, [
            {
                name: "initial",
                sql: [
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
    archivedAt DATETIME
);`,
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
        console.log('XAccountController.fetchParse: starting');

        for (let iResponse = 0; iResponse < this.mitmController.responseData.length; iResponse++) {
            const responseData = this.mitmController.responseData[iResponse];

            // Already processed?
            if (responseData.processed) {
                continue;
            }

            // Rate limited?
            if (responseData.status == 429) {
                this.progress.isRateLimited = true;
                this.progress.rateLimitReset = Number(responseData.headers['x-rate-limit-reset']);
                this.mitmController.responseData[iResponse].processed = true;
                return this.progress;
            }

            // Process the next response
            if (
                responseData.url.includes("/UserTweetsAndReplies?") &&
                responseData.status == 200
            ) {
                try {
                    const body = JSON.parse(responseData.body);

                    // Loop through instructions
                    for (let iInstructions = 0; iInstructions < body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"].length; iInstructions++) {
                        const instructions = body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][iInstructions];
                        if (instructions["type"] == "TimelineAddEntries") {
                            // Loop through the entries
                            for (let iEntries = 0; iEntries < instructions["entries"].length; iEntries++) {
                                const entries = instructions["entries"];

                                // Loop through the items
                                for (let iItems = 0; iItems < entries[iEntries]["content"]["items"].length; iItems++) {
                                    const item = entries[iEntries]["content"]["items"][iItems]["item"]["itemContent"];
                                    if (item["itemType"] != "TimelineTweet") {
                                        continue;
                                    }

                                    const username = item["tweet_results"]["result"]["core"]["user_results"]["result"]["legacy"]["screen_name"];
                                    const tweet = item["tweet_results"]["result"]["legacy"];

                                    // Have we seen this tweet before?
                                    const existing = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweet["id_str"]]);
                                    if (existing.length > 0) {
                                        // We have seen this tweet, so return early
                                        this.mitmController.responseData[iResponse].processed = true;

                                        this.progress.isFetchFinished = true;
                                        return this.progress;
                                    }

                                    // Add the tweet
                                    exec(this.db, 'INSERT INTO tweet (username, tweetID, conversationID, createdAt, likeCount, quoteCount, replyCount, retweetCount, isLiked, isRetweeted, text, path, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                                        username,
                                        tweet["id_str"],
                                        tweet["conversation_id_str"],
                                        new Date(tweet["created_at"]).toISOString(),
                                        tweet["favorite_count"],
                                        tweet["quote_count"],
                                        tweet["reply_count"],
                                        tweet["retweet_count"],
                                        tweet["favorited"] ? 1 : 0,
                                        tweet["retweeted"] ? 1 : 0,
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
                                }
                            }
                        }
                    }

                    this.mitmController.responseData[iResponse].processed = true;
                    console.log('XAccountController.fetchParse: processed', this.progress);

                } catch (error) {
                    // TODO: more granularly skip
                    console.error('XAccountController.fetchParse:', error);
                    this.mitmController.responseData[iResponse].processed = true;
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