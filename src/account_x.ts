import path from 'path'

import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

import { getAccountDataPath } from './helpers'
import { ResponseData, XAccount } from './shared_types'
import { runMigrations, getXAccount } from './database'

import { MITMController, mitmControllers } from './mitm_proxy';

class XAccountController {
    private account: XAccount | null;
    private accountDataPath: string;
    private db: Database.Database;

    private mitmController: MITMController;
    private responseData: ResponseData[];

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
        this.mitmController.startMonitoring();
    }

    async fetchStopMonitoring() {
        this.responseData = await this.mitmController.stopMonitoring();
    }

    // Returns false if more data needs to be fetched
    // Returns true if we are caught up
    async fetchParse(): Promise<boolean> {
        for (let i = 0; i < this.responseData.length; i++) {
            console.log('XAccountController.fetchParse:', this.responseData[i]);

            // try {
            //     const body = JSON.parse(this.responseData[i].body);

            //     // Validate the response
            //     if (!(
            //         body["data"] &&
            //         body["data"]["user"] &&
            //         body["data"]["user"]["result"] &&
            //         body["data"]["user"]["result"]["timeline_v2"] &&
            //         body["data"]["user"]["result"]["timeline_v2"]["timeline"] &&
            //         body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"] &&
            //         body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"].length > 0 &&
            //         body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0] &&
            //         body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["type"] &&
            //         body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["type"] == "TimelineAddEntries" &&
            //         body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["entries"]
            //     )) {
            //         console.log('XAccountController.fetchParse: found invalid response, skipping', body)
            //         continue;
            //     }

            //     // Loop through the tweets
            //     for (let j = 0; j < body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["entries"].length; j++) {
            //         const entry = body["data"]["user"]["result"]["timeline_v2"]["timeline"]["instructions"][0]["entries"][j];
            //         if (!(
            //             entry &&
            //             entry["content"] &&
            //             entry["content"]["items"] &&
            //             entry["content"]["items"].length > 0 &&
            //             entry["content"]["items"][0] &&
            //             entry["content"]["items"][0]["item"] &&
            //             entry["content"]["items"][0]["item"]["itemContent"] &&
            //             entry["content"]["items"][0]["item"]["itemContent"]["itemType"] &&
            //             entry["content"]["items"][0]["item"]["itemContent"]["itemType"] == "TimelineTweet" &&
            //             entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"] &&
            //             entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"]["result"] &&
            //             entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"]["result"]["legacy"]
            //         )) {
            //             console.log('XAccountController.fetchParse: found invalid tweet, skipping', entry)
            //             continue;
            //         }
            //         const tweet = entry["content"]["items"][0]["item"]["itemContent"]["tweet_results"]["result"]["legacy"];

            //         if (!(
            //             entry &&
            //             entry["core"] &&
            //             entry["core"]["user_results"] &&
            //             entry["core"]["user_results"]["result"] &&
            //             entry["core"]["user_results"]["result"]["legacy"] &&
            //             entry["core"]["user_results"]["result"]["legacy"]["name"]
            //         )) {
            //             console.log('XAccountController.fetchParse: found invalid user, skipping', entry)
            //             continue;
            //         }
            //         const username = entry["core"]["user_results"]["result"]["legacy"]["name"];

            //         // Have we seen this tweet before?
            //         const existing = exec('SELECT * FROM tweet WHERE tweetID = ?', [tweet["id_str"]]);
            //         if (existing.length > 0) {
            //             // We have seen this tweet, so return early
            //             return true;
            //         }

            //         // Add the tweet
            //         exec('INSERT INTO tweet (username, tweetID, conversationID, createdAt, likeCount, quoteCount, replyCount, retweetCount, isLiked, isRetweeted, text, path, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            //             username,
            //             tweet["id_str"],
            //             tweet["conversation_id_str"],
            //             new Date(tweet["created_at"]).toISOString(),
            //             tweet["favorite_count"],
            //             tweet["quote_count"],
            //             tweet["reply_count"],
            //             tweet["retweet_count"],
            //             tweet["favorited"],
            //             tweet["retweeted"],
            //             tweet["full_text"],
            //             `${username}/status/${tweet['id_str']}`,
            //             new Date().toISOString(),
            //         ]);
            //         this.fetchCount++;
            //     }

            // } catch (error) {
            //     console.error('XAccountController.fetchParse:', error);
            // }
        }

        return true;
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

    ipcMain.handle('X:fetchParse', async (_, accountID: number): Promise<boolean> => {
        return await controllers[accountID].fetchParse();
    });
};