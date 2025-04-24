import path from 'path'
import fs from 'fs'

import fetch from 'node-fetch';
import { app, session } from 'electron'
import log from 'electron-log/main';
import Database from 'better-sqlite3'
import unzipper from 'unzipper';

import {
    getResourcesPath,
    getAccountDataPath,
} from '../util'
import {
    FacebookAccount,
    FacebookJob,
    FacebookProgress,
    emptyFacebookProgress,
    FacebookDatabaseStats,
    emptyFacebookDatabaseStats,
} from '../shared_types'
import {
    runMigrations,
    Sqlite3Count,
    getAccount,
    exec,
    getConfig,
    setConfig,
} from '../database'
import { IMITMController } from '../mitm';
import {
    FacebookJobRow,
    convertFacebookJobRowToFacebookJob,
    FacebookPostRow,
    FBAPIResponse,
    FBAPINode,
    FBAttachment,
    FBMedia,
} from './types'

// for building the static archive site
import { saveArchive } from './archive';

export class FacebookAccountController {
    private accountUUID: string = "";
    // Making this public so it can be accessed in tests
    public account: FacebookAccount | null = null;
    private accountID: number = 0;
    private accountDataPath: string = "";
    private thereIsMore: boolean = false;

    // Making this public so it can be accessed in tests
    public db: Database.Database | null = null;

    public mitmController: IMITMController;
    private progress: FacebookProgress = emptyFacebookProgress();

    private cookies: Record<string, string> = {};

    constructor(accountID: number, mitmController: IMITMController) {
        this.mitmController = mitmController;

        this.accountID = accountID;
        this.refreshAccount();

        // Monitor web request metadata
        const ses = session.fromPartition(`persist:account-${this.accountID}`);
        ses.webRequest.onCompleted((_details) => {
            // TODO: Monitor for rate limits
        });

        ses.webRequest.onSendHeaders((details) => {
            // Keep track of cookies
            if (details.url.startsWith("https://www.facebook.com/") && details.requestHeaders) {
                this.cookies = {};

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
            log.error(`FacebookAccountController.refreshAccount: account ${this.accountID} not found`);
            return;
        }

        // Make sure it's a Facebook account
        if (account.type != "Facebook") {
            log.error(`FacebookAccountController.refreshAccount: account ${this.accountID} is not a Facebook account`);
            return;
        }

        // Get the account UUID
        this.accountUUID = account.uuid;
        log.debug(`FacebookAccountController.refreshAccount: accountUUID=${this.accountUUID}`);

        // Load the Facebook account
        this.account = account.facebookAccount;
        if (!this.account) {
            log.error(`FacebookAccountController.refreshAccount: xAccount ${this.accountID} not found`);
            return;
        }
    }

    initDB() {
        if (!this.account || !this.account.accountID) {
            log.error("FacebookAccountController: cannot initialize the database because the account is not found, or the account Facebook ID is not found", this.account, this.account?.accountID);
            return;
        }

        // Make sure the account data folder exists
        this.accountDataPath = getAccountDataPath("Facebook", `${this.account.accountID} ${this.account.name}`);
        log.info(`FacebookAccountController.initDB: accountDataPath=${this.accountDataPath}`);

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
);`,
                    `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`]
            },
            {
                name: "20250220_add_post_table",
                sql: [
                    `CREATE TABLE post (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    postID TEXT NOT NULL UNIQUE,
    createdAt DATETIME NOT NULL,
    title TEXT,
    text TEXT,
    addedToDatabaseAt DATETIME NOT NULL
                    );`
                ]
            },
            {
                name: "20250220_add_isReposted_to_post",
                sql: [
                    `CREATE TABLE post_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        postID TEXT NOT NULL UNIQUE,
                        createdAt DATETIME NOT NULL,
                        title TEXT,
                        text TEXT,
                        isReposted BOOLEAN NOT NULL DEFAULT 0,
                        addedToDatabaseAt DATETIME NOT NULL
                    );`,
                    `INSERT INTO post_new (id, postID, createdAt, title, text, addedToDatabaseAt)
                     SELECT id, postID, createdAt, title, text, addedToDatabaseAt FROM post;`,
                    `DROP TABLE post;`,
                    `ALTER TABLE post_new RENAME TO post;`
                ]
            },
            {
                name: "20250302_add_media_table",
                sql: [
                    `CREATE TABLE post_media (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mediaId TEXT NOT NULL UNIQUE,
                        postId TEXT NOT NULL,
                        type TEXT NOT NULL,
                        uri TEXT NOT NULL,
                        description TEXT,
                        createdAt DATETIME,
                        addedToDatabaseAt DATETIME NOT NULL,
                        FOREIGN KEY(postId) REFERENCES post(postID)
                    );`
                ]
            },
            {
                name: "20250312_add_urls_to_posts",
                sql: [
                    `CREATE TABLE post_url (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        postId TEXT NOT NULL,
                        url TEXT NOT NULL,
                        addedToDatabaseAt DATETIME NOT NULL,
                        FOREIGN KEY(postId) REFERENCES post(postID)
                    );`
                ]
            },
            {
                name: "20250327_add_path_repostID_to_post",
                sql: [
                    `ALTER TABLE post ADD COLUMN path TEXT;`,
                    `ALTER TABLE post ADD COLUMN hasMedia BOOLEAN;`,
                    `ALTER TABLE post ADD COLUMN repostID TEXT;`,
                    `UPDATE post SET hasMedia = 0;`
                ]
            }
        ])
        log.info("FacebookAccountController.initDB: database initialized");
    }

    resetProgress(): FacebookProgress {
        log.debug("FacebookAccountController.resetProgress");
        this.progress = emptyFacebookProgress();
        return this.progress;
    }

    createJobs(jobTypes: string[]): FacebookJob[] {
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
        const jobs: FacebookJobRow[] = exec(this.db, "SELECT * FROM job WHERE status = ? ORDER BY id", ["pending"], "all") as FacebookJobRow[];
        return jobs.map(convertFacebookJobRowToFacebookJob);
    }

    updateJob(job: FacebookJob) {
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
        log.info(ses);
        await this.mitmController.startMITM(ses, ["www.facebook.com/api/graphql/"]);
        this.thereIsMore = true;
    }

    async indexStop() {
        await this.mitmController.stopMonitoring();
        const ses = session.fromPartition(`persist:account-${this.accountID}`);
        await this.mitmController.stopMITM(ses);
    }

    async parseNode(postData: FBAPINode) {
        log.debug("FacebookAccountController.parseNode: parsing node");

        if (postData.__typename !== 'Story') {
            log.info("FacebookAccountController.parseNode: not a story, skipping");
            return;
        }

        // TODO: parse users too

        // Is this post already there?
        const existingPost = exec(this.db, 'SELECT * FROM post WHERE postID = ?', [postData.id], "get") as FacebookPostRow;
        if (existingPost) {
            // First delete related media and URLs
            exec(this.db, 'DELETE FROM post_media WHERE postId = ?', [postData.id]);
            exec(this.db, 'DELETE FROM post_url WHERE postId = ?', [postData.id]);

            // Delete the existing post to re-import
            exec(this.db, 'DELETE FROM post WHERE postID = ?', [postData.id]);
        }

        // Save post
        const sql = 'INSERT INTO post (postID, createdAt, title, text, path, isReposted, repostID, hasMedia, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const params = [
            postData.id,
            new Date(postData.creation_time * 1000),
            postData.title,
            postData.message?.text,
            postData.url,
            postData.attached_story !== null ? 1 : 0,
            postData.attached_story?.id,
            postData.attachments && postData.attachments.length > 0 ? 1 : 0,
            new Date(),
        ];
        log.debug("FacebookAccountController.parseNode: executing", sql, params);
        exec(this.db, sql, params);

        if (postData.attachments && postData.attachments.length > 0) {
            log.info("FacebookAccountController.parseNode: importing media for post", postData.id);
            await this.parseAttachment(postData.id, postData.attachments);
        }

        // Update progress
        this.progress.postsSaved++;
    }

    async parseAttachment(postId: string, postMedia: FBAttachment[]) {
        console.log("\n\n=============\n\n")
        console.log(postMedia)
        for (const mediaItem of postMedia) {

            console.log(mediaItem.style_type_renderer.attachment)
            let sourceURI: string;
            let mediaData: FBMedia;

            if (mediaItem.style_type_renderer.attachment.all_subattachments) {
                // TODO: Implement multiple attachment/images
                log.info("FacebookAccountController.parseAttachment: multiple attachments, not implemented yet");
                return;
            } else if (mediaItem.style_type_renderer.attachment.media) {
                mediaData = mediaItem.style_type_renderer.attachment.media;

                if (!mediaData.image?.uri) {
                    // TODO: Implement attachments like Video, ExternalShareAttachment, FBShortsShareAttachment, etc.
                    log.info("FacebookAccountController.parseAttachment: multiple attachments, not implemented yet");
                    return;
                }

                if (mediaData.__typename === 'GenericAttachmentMedia') {
                    const searchParams = new URL(mediaData.image.uri).searchParams
                    sourceURI = searchParams.get('url') || '';
                } else {
                    sourceURI = mediaData.image.uri;
                }
            } else {
                log.info("FacebookAccountController.parseAttachment: not a known attachment structure, skipping");
                return;
            }

            const filename = path.basename(sourceURI.substring(0, sourceURI.indexOf('?')));
            const mediaId = `${postId}_${path.basename(filename)}`;

            // Create destination directory if it doesn't exist
            const mediaDir = path.join(this.accountDataPath, 'media');
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
            }

            const destPath = path.join(mediaDir, filename);
            try {
                const isMediaSaved = await this.savePostMedia(sourceURI, destPath);
                if (isMediaSaved) {
                    exec(this.db,
                        'INSERT INTO post_media (mediaId, postId, type, uri, description, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?)',
                        [
                            mediaId,
                            postId,
                            mediaData.__typename,
                            sourceURI,
                            mediaData.accessibility_caption || null,
                            new Date()
                        ]
                    );
                } else {
                    log.error('FacebookAccountController.parseAttachment: Media could not be saved.')
                }
            } catch (error) {
                log.error(`FacebookAccountController.parseAttachment: Error saving media: ${error}`);
            }
        }
    }

    async savePostMedia(sourceURI: string, destPath: string) {
        if (!this.account) {
            throw new Error("Account not found");
        }

        // Download and save media from the mediaPath
        try {
            const response = await fetch(sourceURI, {});
            if (!response.ok) {
                return false;
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            fs.createWriteStream(destPath).write(buffer);
            return true;
        } catch (error) {
            log.error(`FacebookAccountController.savePostMedia: Error downloading media: ${error}`)
            return false;
        }
    }

    async getStructuredGraphQLData(responseDataBody: string): Promise<FBAPIResponse[]> {
        log.info("FacebookAccountController.getStructuredGraphQLData: converting string to structured JSON");

        const postArray = responseDataBody.split('\n');
        const resps = [];
        for (const post of postArray) {
            // Handle an empty newline at the end of the file
            if (post.trim() === "") {
                continue;
            }

            // Skip individual JSON errors
            try {
                const resp = JSON.parse(post) as FBAPIResponse;
                resps.push(resp);
            } catch (e) {
                log.error("FacebookAccountController.getStructuredGraphQLData: error parsing JSON", e, post)
            }
        }

        return resps;
    }

    async parseGraphQLPostData(responseIndex: number) {
        const responseData = this.mitmController.responseData[responseIndex];

        // Already processed?
        if (responseData.processed) {
            return true;
        }

        // Note: I'm commenting this out because we should wait until we receive actual rate limits from FB
        // and then we can decide how to deal with them, instead of assuming how they work

        // // Is it rate limited?
        // if (responseData.status == 429) {
        //     log.warn('FacebookAccountController.parseGraphQLPostData: RATE LIMITED');
        //     this.mitmController.responseData[responseIndex].processed = true;
        //     return false;
        // }

        if (responseData.status !== 200) {
            log.warn("FacebookAccountController.parseGraphQLPostData: response data status code", responseData.status)
            return;
        }

        // Get structured data from the stringified object
        const resps = await this.getStructuredGraphQLData(responseData.responseBody);

        for (const postResponse of resps) {
            // log.debug("FacebookAccountController.parseGraphQLPostData: resp", JSON.stringify(postResponse))
            // Only parse manage feed posts, and not list feed
            if (postResponse?.data?.node && postResponse.path?.includes("timeline_manage_feed_units")) {
                log.debug("FacebookAccountController.parseGraphQLPostData: parsing postResponse?.data?.node from manage posts")
                this.parseNode(postResponse?.data?.node);
            } else if (postResponse?.data?.user?.timeline_manage_feed_units?.edges) {
                for (let i = 0; i < postResponse?.data?.user?.timeline_manage_feed_units?.edges.length; i++) {
                    log.debug(`FacebookAccountController.parseGraphQLPostData: parsing postResponse?.data?.user?.timeline_manage_feed_units?.edges[${i}].node`)
                    this.parseNode(postResponse?.data?.user?.timeline_manage_feed_units?.edges[i].node);
                }
            } else {
                log.debug("FacebookAccountController.parseGraphQLPostData: no nodes found, so skipping")
            }
        }
    }

    async savePosts(): Promise<FacebookProgress> {
        await this.mitmController.clearProcessed();
        log.info(`FacebookAccountController.savePosts: parsing ${this.mitmController.responseData.length} responses`);

        for (let i = 0; i < this.mitmController.responseData.length; i++) {
            this.parseGraphQLPostData(i);
        }

        return this.progress;
    }

    async archiveBuild() {
        if (!this.account) {
            console.error("FacebookAccountController.archiveBuild: account not found");
            return false;
        }

        if (!this.db) {
            this.initDB();
            if (!this.db) {
                console.error("FacebookAccountController.archiveBuild: database not initialized");
                return;
            }
        }

        log.info("FacebookAccountController.archiveBuild: building archive");

        // Build the archive
        const accountPath = path.join(getAccountDataPath("Facebook", `${this.account.accountID} ${this.account.name}`));
        const assetsPath = path.join(accountPath, "assets");
        if (!fs.existsSync(assetsPath)) {
            fs.mkdirSync(assetsPath);
        }
        const archivePath = path.join(assetsPath, "archive.js");
        saveArchive(this.db, app.getVersion(), this.account.name, archivePath);

        // Unzip facebook-archive.zip to the account data folder using unzipper
        const archiveZipPath = path.join(getResourcesPath(), "facebook-archive.zip");
        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: accountPath });
    }

    async syncProgress(progressJSON: string) {
        this.progress = JSON.parse(progressJSON);
    }

    async getProgress(): Promise<FacebookProgress> {
        return this.progress;
    }

    async getCookie(name: string): Promise<string | null> {
        return this.cookies[name] || null;
    }

    async getProfileImageDataURI(profilePictureURI: string): Promise<string> {
        log.info("FacebookAccountController.getProfileImageDataURI: profilePictureURI", profilePictureURI);
        try {
            const response = await fetch(profilePictureURI, {});
            if (!response.ok) {
                return "";
            }
            const buffer = await response.buffer();
            log.info("FacebookAccountController.getProfileImageDataURI: buffer", buffer);
            return `data: ${response.headers.get('content-type')}; base64, ${buffer.toString('base64')}`;
        } catch (e) {
            log.error("FacebookAccountController.getProfileImageDataURI: error", e);
            return "";
        }
    }

    async getConfig(key: string): Promise<string | null> {
        return getConfig(key, this.db);
    }

    async setConfig(key: string, value: string) {
        return setConfig(key, value, this.db);
    }

    async getDatabaseStats(): Promise<FacebookDatabaseStats> {
        const databaseStats = emptyFacebookDatabaseStats();
        if (!this.account?.accountID) {
            log.info('FacebookAccountController.getDatabaseStats: no account');
            return databaseStats;
        }

        if (!this.db) {
            this.initDB();
        }

        // Count total posts
        const postsSaved: Sqlite3Count = exec(this.db, "SELECT COUNT(*) AS count FROM post", [], "get") as Sqlite3Count;
        log.info('FacebookAccountController.getDatabaseStats: posts count:', postsSaved);

        // Count shared posts (reposts)
        const repostsSaved: Sqlite3Count = exec(this.db,
            "SELECT COUNT(*) AS count FROM post WHERE isReposted = 1",
            [],
            "get"
        ) as Sqlite3Count;
        log.info('FacebookAccountController.getDatabaseStats: reposts count:', repostsSaved);

        databaseStats.postsSaved = postsSaved.count;
        databaseStats.repostsSaved = repostsSaved.count;
        return databaseStats;
    }

}
