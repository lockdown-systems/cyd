import path from 'path'

import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

import { getAccountDataPath } from './helpers'
import { XAccount, XJob, XProgress } from './shared_types'
import { runMigrations, getXAccount, exec } from './database'

import { IMITMController, mitmControllers } from './mitm_proxy';

interface XAPILegacyTweet {
    bookmark_count: number;
    bookmarked: boolean;
    created_at: string;
    conversation_id_str: string;
    display_text_range: number[];
    favorite_count: number;
    favorited: boolean;
    full_text: string;
    in_reply_to_screen_name: string;
    in_reply_to_status_id_str: string;
    in_reply_to_user_id_str: string;
    is_quote_status: boolean;
    lang: string;
    quote_count: number;
    reply_count: number;
    retweet_count: number;
    retweeted: boolean;
    user_id_str: string;
    id_str: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: any;
}

interface XAPILegacyUser {
    can_dm: boolean;
    can_media_tag: boolean;
    created_at: string;
    default_profile: boolean;
    default_profile_image: boolean;
    description: string;
    fast_followers_count: number;
    favourites_count: number;
    followers_count: number;
    friends_count: number;
    has_custom_timelines: boolean;
    is_translator: boolean;
    listed_count: number;
    location: string;
    media_count: number;
    name: string;
    needs_phone_verification: boolean;
    normal_followers_count: number;
    possibly_sensitive: boolean;
    profile_banner_url: string;
    profile_image_url_https: string;
    profile_interstitial_type: string;
    screen_name: string;
    statuses_count: number;
    translator_type: string;
    verified: boolean;
    want_retweets: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entities: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pinned_tweet_ids_str: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withheld_in_countries: any;
}

interface XAPITweetResults {
    result: {
        __typename?: string; // "Tweet"
        core: {
            user_results: {
                result?: {
                    __typename?: string;
                    has_graduated_access?: boolean;
                    id?: string;
                    is_blue_verified?: boolean;
                    legacy: XAPILegacyUser;
                    profile_image_shape?: string;
                    rest_id?: string;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tipjar_settings?: any;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    affiliates_highlighted_label?: any;
                }
            }
        };
        is_translatable?: boolean;
        legacy?: XAPILegacyTweet;
        rest_id?: string;
        source?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edit_control?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unmention_data?: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        views?: any;
    }
}

interface XAPIItemContent {
    __typename: string;
    itemType: string; // "TimelineTweet", "TimelineUser"
    tweetDisplayType?: string;
    tweet_results?: XAPITweetResults;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user_results?: any;
}

interface XAPIData {
    data: {
        user: {
            result: {
                __typename: string; // "User"
                timeline_v2: {
                    timeline: {
                        instructions: {
                            type: string; // "TimelineClearCache", "TimelineAddEntries"
                            entries?: {
                                content: {
                                    entryType: string; // "TimelineTimelineModule", "TimelineTimelineItem", "TimelineTimelineCursor"
                                    __typename: string;
                                    value?: string;
                                    cursorType?: string;
                                    displayType?: string;
                                    // items is there when entryType is "TimelineTimelineModule"
                                    items?: {
                                        entryId: string;
                                        item: {
                                            itemContent: XAPIItemContent;
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            clientEventInfo: any;
                                        };
                                    }[];
                                    // itemContent is there when entryType is "TimelineTimelineItem"
                                    itemContent?: XAPIItemContent;
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    clientEventInfo?: any;
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    metadata?: any;
                                };
                                entryId: string;
                                sortIndex: string;
                            }[];
                        }[];
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        metadata: any;
                    }
                }
            }
        }
    }
}

export class XAccountController {
    private account: XAccount | null;
    private accountDataPath: string;

    // Making this public so it can be accessed in tests
    public db: Database.Database;

    private mitmController: IMITMController;
    private progress: XProgress = {
        currentJob: "index",
        isIndexFinished: false,
        isArchiveFinished: false,
        isDeleteFinished: false,
        tweetsIndexed: 0,
        retweetsIndexed: 0,
        tweetsArchived: 0,
        directMessageConversationsArchived: 0,
        tweetsDeleted: 0,
        retweetsDeleted: 0,
        likesDeleted: 0,
        directMessagesDeleted: 0,
        isRateLimited: false,
        rateLimitReset: null,
    };

    constructor(accountID: number, mitmController: IMITMController) {
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
    archivedAt DATETIME
);`
                ]
            }
        ])
    }

    createJobs(jobTypes: string[]): XJob[] {
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

    getLastFinishedJob(jobType: string): Promise<XJob | null> {
        return exec(
            this.db,
            'SELECT * FROM job WHERE jobType = ? AND status = ? AND finishedAt IS NOT NULL ORDER BY finishedAt DESC LIMIT 1',
            [jobType, "finished"],
            "get"
        );
    }

    updateJob(job: XJob) {
        console.log(job);
        const startedAt = job.startedAt ? job.startedAt : null;
        const finishedAt = job.finishedAt ? job.finishedAt : null;
        exec(
            this.db,
            'UPDATE job SET status = ?, startedAt = ?, finishedAt = ?, progressJSON = ?, error = ? WHERE id = ?',
            [job.status, startedAt, finishedAt, job.progressJSON, job.error, job.id]
        );
    }

    async indexStartMonitoring() {
        await this.mitmController.startMonitoring();
    }

    async indexStopMonitoring() {
        await this.mitmController.stopMonitoring();
    }

    // Returns false if the loop should stop
    indexTweet(indexResponse: number, userLegacy: XAPILegacyUser, tweetLegacy: XAPILegacyTweet, isFirstRun: boolean): boolean {
        // Have we seen this tweet before?
        const existing = exec(this.db, 'SELECT * FROM tweet WHERE tweetID = ?', [tweetLegacy["id_str"]], "all");
        if (existing.length > 0) {
            if (isFirstRun) {
                // Delete it, so we can re-add it
                exec(this.db, 'DELETE FROM tweet WHERE tweetID = ?', [tweetLegacy["id_str"]]);
            } else {
                // We have seen this tweet, so return early
                this.mitmController.responseData[indexResponse].processed = true;
                this.progress.isIndexFinished = true;
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
    indexParseResponseData(indexResponse: number, isFirstRun: boolean): boolean {
        let shouldReturnFalse = false;
        const responseData = this.mitmController.responseData[indexResponse];

        // Already processed?
        if (responseData.processed) {
            return true;
        }

        // Rate limited?
        if (responseData.status == 429) {
            this.progress.isRateLimited = true;
            this.progress.rateLimitReset = Number(responseData.headers['x-rate-limit-reset']);
            this.mitmController.responseData[indexResponse].processed = true;
            return false;
        }

        // Process the next response
        if (
            responseData.url.includes("/UserTweetsAndReplies?") &&
            responseData.status == 200
        ) {
            const body: XAPIData = JSON.parse(responseData.body);
            console.log('XAccountController.indexParse: body', responseData.body);

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
                            if (userLegacy && tweetLegacy && !this.indexTweet(indexResponse, userLegacy, tweetLegacy, isFirstRun)) {
                                shouldReturnFalse = true;
                                return;
                            }
                        });
                    } else if (entries.content.entryType == "TimelineTimelineItem") {
                        const userLegacy = entries.content.itemContent?.tweet_results?.result.core.user_results.result?.legacy;
                        const tweetLegacy = entries.content.itemContent?.tweet_results?.result.legacy;
                        if (userLegacy && tweetLegacy && !this.indexTweet(indexResponse, userLegacy, tweetLegacy, isFirstRun)) {
                            shouldReturnFalse = true;
                            return;
                        }
                    }


                });

                if (shouldReturnFalse) {
                    return;
                }
            });

            this.mitmController.responseData[indexResponse].processed = true;
            console.log('XAccountController.indexParse: processed', this.progress);

            if (shouldReturnFalse) {
                return false;
            }
        } else {
            // Skip response
            this.mitmController.responseData[indexResponse].processed = true;
        }

        return true;
    }

    // Returns true if more data needs to be indexed
    // Returns false if we are caught up
    async indexParse(isFirstRun: boolean): Promise<XProgress> {
        console.log('XAccountController.indexParse: starting');

        this.progress.currentJob = "index";
        this.progress.isIndexFinished = false;

        this.mitmController.responseData.forEach((_response, indexResponse) => {
            if (this.indexParseResponseData(indexResponse, isFirstRun)) {
                return this.progress;
            }
        });

        return this.progress;
    }

    async indexFinished(): Promise<XProgress> {
        console.log('XAccountController.indexFinished');
        this.progress.isIndexFinished = true;
        return this.progress;
    }
}

const controllers: Record<number, XAccountController> = {};

const getController = (accountID: number): XAccountController => {
    if (!controllers[accountID]) {
        controllers[accountID] = new XAccountController(accountID, mitmControllers[accountID]);
    }
    return controllers[accountID];
}

export const defineIPCX = () => {
    ipcMain.handle('X:createJobs', async (_, accountID: number, jobTypes: string[]): Promise<XJob[]> => {
        const controller = getController(accountID);
        return controller.createJobs(jobTypes);
    });

    ipcMain.handle('X:getLastFinishedJob', async (_, accountID: number, jobType: string): Promise<XJob | null> => {
        const controller = getController(accountID);
        return controller.getLastFinishedJob(jobType);
    });

    ipcMain.handle('X:updateJob', async (_, accountID: number, jobJSON: string) => {
        const controller = getController(accountID);
        const job = JSON.parse(jobJSON) as XJob;
        controller.updateJob(job);
    });

    ipcMain.handle('X:indexStart', async (_, accountID: number) => {
        const controller = getController(accountID);
        await controller.indexStartMonitoring();

    });

    ipcMain.handle('X:indexStop', async (_, accountID: number) => {
        const controller = getController(accountID);
        await controller.indexStopMonitoring();
    });

    ipcMain.handle('X:indexParse', async (_, accountID: number, isFirstRun: boolean): Promise<XProgress> => {
        const controller = getController(accountID);
        return await controller.indexParse(isFirstRun);
    });

    ipcMain.handle('X:indexFinished', async (_, accountID: number): Promise<XProgress> => {
        const controller = getController(accountID);
        return await controller.indexFinished();
    });
};