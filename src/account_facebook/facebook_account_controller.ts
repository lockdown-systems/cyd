import path from 'path'
import fs from 'fs'
import os from 'os'

import fetch from 'node-fetch';
import { app, session } from 'electron'
import log from 'electron-log/main';
import Database from 'better-sqlite3'
import unzipper from 'unzipper';
import { glob } from 'glob';

import {
    getResourcesPath,
    getAccountDataPath,
} from '../util'
import {
    FacebookAccount,
    FacebookJob,
    FacebookProgress,
    emptyFacebookProgress,
    FacebookImportArchiveResponse,
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
    FacebookArchivePost,
    FacebookArchiveMedia,
    FacebookPostWithMedia,
    FacebookPostRow,
    FBAPIResponse,
    FBAPINode,
    FBAttachment,
    FBMedia,
} from './types'
import * as FacebookArchiveTypes from '../../archive-static-sites/facebook-archive/src/types';

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
        const resps = await this.getStructuredGraphQLData(responseData.body);

        for (const postResponse of resps) {
            log.debug("FacebookAccountController.parseGraphQLPostData: resp", JSON.stringify(postResponse))
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
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            return false;
        }

        log.info("FacebookAccountController.archiveBuild: building archive");
        // Posts with optional media
        const postsFromDb = exec(
            this.db,
            `SELECT
                p.*,
                CASE
                    WHEN pm.mediaId IS NOT NULL
                        THEN GROUP_CONCAT(
                            json_object(
                                'mediaId', pm.mediaId,
                                'postId', pm.postId,
                                'type', pm.type,
                                'uri', pm.uri,
                                'description', pm.description,
                                'createdAt', pm.createdAt,
                                'addedToDatabaseAt', pm.addedToDatabaseAt
                            )
                        )
                        ELSE NULL
                    END as media,
                CASE
                    WHEN pu.url IS NOT NULL
                        THEN GROUP_CONCAT(pu.url)
                        ELSE NULL
                    END as urls
                FROM post p
                LEFT JOIN post_media pm ON p.postID = pm.postId
                LEFT JOIN post_url pu ON p.postID = pu.postId
                GROUP BY p.postID
                ORDER BY p.createdAt DESC`,
            [],
            "all"
        );
        // Transform into FacebookPostWithMedia
        const posts: FacebookPostWithMedia[] = (postsFromDb as Array<FacebookPostRow & { media?: string, urls?: string[] }>).map((post) => ({
            ...post,
            media: post.media ? JSON.parse(`[${post.media}]`) : undefined,
        }));

        // Get the current account's userID
        // const accountUser = users.find((user) => user.screenName == this.account?.username);
        // const accountUserID = accountUser?.userID;

        const postRowToArchivePost = (post: FacebookPostRow): FacebookArchiveTypes.Post => {
            const decodeUnicode = (text: string): string => {
                if (!text) return '';  // Return empty string if text is null/undefined
                return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
                    String.fromCharCode(parseInt(hex, 16))
                );
            };

            const archivePost: FacebookArchiveTypes.Post = {
                postID: post.postID,
                createdAt: post.createdAt,
                text: decodeUnicode(post.text),
                title: post.title,
                isReposted: post.isReposted,
                archivedAt: post.archivedAt,
                media: (post as FacebookPostWithMedia).media?.map(m => ({
                    mediaId: m.mediaId,
                    type: m.type,
                    uri: m.uri,
                    description: m.description,
                    createdAt: m.createdAt
                })),
                urls: post.urls,
            };
            return archivePost;
        }

        // Build the archive object
        const formattedPosts: FacebookArchiveTypes.Post[] = posts.map((post) => {
            return postRowToArchivePost(post);
        });

        log.info(`FacebookAccountController.archiveBuild: archive has ${posts.length} posts`);

        // Save the archive object to a file using streaming
        const accountPath = path.join(getAccountDataPath("Facebook", `${this.account.accountID} ${this.account.name}`));
        const assetsPath = path.join(accountPath, "assets");
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
            streamWriter.write(`  "username": ${JSON.stringify(this.account.name)},\n`);
            streamWriter.write(`  "createdAt": ${JSON.stringify(new Date().toLocaleString())},\n`);

            // Write each array separately using a streaming approach in case the array(s) are large
            await this.writeJSONArray(streamWriter, formattedPosts, "posts");
            streamWriter.write(',\n');
            // Close the object
            streamWriter.write('};');

            await new Promise((resolve) => streamWriter.end(resolve));
        } catch (error) {
            streamWriter.end();
            throw error;
        }

        log.info(`FacebookAccountController.archiveBuild: archive saved to ${archivePath}`);

        // Unzip facebook-archive.zip to the account data folder using unzipper
        const archiveZipPath = path.join(getResourcesPath(), "facebook-archive.zip");
        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: accountPath });
    }

    async writeJSONArray<T>(streamWriter: fs.WriteStream, items: T[], propertyName: string) {
        streamWriter.write(`  "${propertyName}": [\n`);
        for (let i = 0; i < items.length; i++) {
            const suffix = i < items.length - 1 ? ',\n' : '\n';
            streamWriter.write('    ' + JSON.stringify(items[i]) + suffix);
        }
        streamWriter.write('  ]');
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

    // Unzip facebook archive to the account data folder using unzipper
    // Return null if error, else return the unzipped path
    async unzipFacebookArchive(archiveZipPath: string): Promise<string | null> {
        if (!this.account) {
            return null;
        }
        const unzippedPath = path.join(getAccountDataPath("Facebook", `${this.account.accountID} ${this.account.name}`), "tmp");

        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: unzippedPath });

        log.info(`FacebookAccountController.unzipFacebookArchive: unzipped to ${unzippedPath}`);

        return unzippedPath;
    }

    // Delete the unzipped facebook archive once the build is completed
    async deleteUnzippedFacebookArchive(archivePath: string): Promise<void> {
        fs.rm(archivePath, { recursive: true, force: true }, err => {
            if (err) {
                log.error(`FacebookAccountController.deleteUnzippedFacebookArchive: Error occured while deleting unzipped folder: ${err} `);
            }
        });
    }

    // Return null on success, and a string (error message) on error
    async verifyFacebookArchive(archivePath: string): Promise<string | null> {
        // If archivePath contains just one folder and no files, update archivePath to point to that inner folder
        const archiveContents = fs.readdirSync(archivePath);
        if (archiveContents.length === 1 && fs.lstatSync(path.join(archivePath, archiveContents[0])).isDirectory()) {
            archivePath = path.join(archivePath, archiveContents[0]);
        }

        const foldersToCheck = [
            archivePath,
            path.join(archivePath, "personal_information", "profile_information"),
        ];

        // Make sure folders exist
        for (let i = 0; i < foldersToCheck.length; i++) {
            if (!fs.existsSync(foldersToCheck[i])) {
                log.error(`XAccountController.verifyXArchive: folder does not exist: ${foldersToCheck[i]} `);
                return `The folder ${foldersToCheck[i]} doesn't exist.`;
            }
        }

        // Check if there's a profile_information.html file. This means the person downloaded the archive using HTML, not JSON.
        const profileHtmlInformationPath = path.join(archivePath, "personal_information/profile_information/profile_information.html");
        if (fs.existsSync(profileHtmlInformationPath)) {
            log.error(`FacebookAccountController.verifyFacebookArchive: file is in wrong format, expected JSON, not HTML: ${profileHtmlInformationPath}`);
            return `The file ${profileHtmlInformationPath} file is in the wrong format. Request a JSON archive.`;
        }

        // Make sure profile_information.json exists and is readable
        const profileInformationPath = path.join(archivePath, "personal_information/profile_information/profile_information.json");
        if (!fs.existsSync(profileInformationPath)) {
            log.error(`FacebookAccountController.verifyFacebookArchive: file does not exist: ${profileInformationPath}`);
            return `The file ${profileInformationPath} doesn't exist.`;
        }
        try {
            fs.accessSync(profileInformationPath, fs.constants.R_OK);
        } catch {
            log.error(`FacebookAccountController.verifyFacebookArchive: file is not readable: ${profileInformationPath}`);
            return `The file ${profileInformationPath} is not readable.`;
        }

        // Make sure the profile_information.json file belongs to the right account
        try {
            const profileData = JSON.parse(fs.readFileSync(profileInformationPath, 'utf-8'));

            if (!profileData.profile_v2?.profile_uri) {
                log.error("FacebookAccountController.verifyFacebookArchive: Could not find profile URI in archive");
                return "Could not find profile ID in archive";
            }

            const profileUrl = profileData.profile_v2.profile_uri;
            const profileId = profileUrl.split('id=')[1];

            if (!profileId) {
                log.error("FacebookAccountController.verifyFacebookArchive: Could not extract profile ID from URL");
                return "Could not extract profile ID from URL";
            }

            if (profileId !== this.account?.accountID) {
                log.error(`FacebookAccountController.verifyFacebookArchive: profile_information.json does not belong to the right account`);
                return `This archive is for @${profileId}, not @${this.account?.accountID}.`;
            }
        } catch {
            return "Error parsing JSON in profile_information.json";
        }

        return null;
    }

    // Return null on success, and a string (error message) on error
    async importFacebookArchive(archivePath: string, dataType: string): Promise<FacebookImportArchiveResponse> {
        if (!this.db) {
            this.initDB();
        }

        let importCount = 0;
        const skipCount = 0;

        // If archivePath contains just one folder and no files, update archivePath to point to that inner folder
        const archiveContents = fs.readdirSync(archivePath);
        if (archiveContents.length === 1 && fs.lstatSync(path.join(archivePath, archiveContents[0])).isDirectory()) {
            archivePath = path.join(archivePath, archiveContents[0]);
        }

        // Load the username
        let profileId: string;


        try {
            const profileInformationPath = path.join(archivePath, "personal_information/profile_information/profile_information.json");
            const profileData = JSON.parse(fs.readFileSync(profileInformationPath, 'utf-8'));

            if (!profileData.profile_v2?.profile_uri) {
                return {
                    status: "error",
                    errorMessage: "Could not find profile URI in archive",
                    importCount: importCount,
                    skipCount: skipCount,
                };
            }

            const profileUrl = profileData.profile_v2.profile_uri;
            profileId = profileUrl.split('id=')[1] || '';

            if (!profileId) {
                return {
                    status: "error",
                    errorMessage: "Could not extract profile ID from URL",
                    importCount: importCount,
                    skipCount: skipCount,
                };
            }
        } catch (e) {
            return {
                status: "error",
                errorMessage: "Error parsing profile information JSON",
                importCount: importCount,
                skipCount: skipCount,
            };
        }

        // Import posts
        if (dataType == "posts") {
            const postsFilenames = await glob(
                [
                    // TODO: for really big Facebook archives, are there more files here?
                    path.join(archivePath, "your_facebook_activity", "posts", "your_posts__check_ins__photos_and_videos_1.json"),
                ],
                {
                    windowsPathsNoEscape: os.platform() == 'win32'
                }
            );
            if (postsFilenames.length === 0) {
                return {
                    status: "error",
                    errorMessage: "No posts files found",
                    importCount: importCount,
                    skipCount: skipCount,
                };
            }

            // Go through each file and import the posts
            for (let i = 0; i < postsFilenames.length; i++) {
                const postsData: FacebookArchivePost[] = [];
                try {
                    const postsFile = fs.readFileSync(postsFilenames[i], 'utf8');
                    const posts = JSON.parse(postsFile);

                    for (const post of posts) {
                        // Check for Facebook "life events"
                        const lifeEvent =
                            post.data?.find((d: { life_event?: { title?: string } }) => d.life_event?.title) ||
                            post.attachments?.[0]?.data?.[0]?.life_event;
                        log.info("FacebookAccountController.importFacebookArchive: lifeEvent", lifeEvent);

                        let postText: string = '';
                        if (lifeEvent) {
                            postText = lifeEvent.title;
                            if (lifeEvent.start_date) {
                                const date = new Date(
                                    lifeEvent.start_date.year,
                                    lifeEvent.start_date.month - 1,
                                    lifeEvent.start_date.day
                                );
                                postText += ` (${date.toLocaleDateString()})`;
                            }
                        } else {
                            postText = post.data?.find((d: { post?: string }) => 'post' in d && typeof d.post === 'string')?.post;
                        }
                        log.info("FacebookAccountController.importFacebookArchive: postText", postText);

                        // Check if it's a shared post by looking for external_context.url being empty in attachments
                        const isSharedPost = (
                            (post.attachments?.[0]?.data?.[0]?.external_context?.url !== undefined &&
                                post.attachments?.[0]?.data?.[0]?.external_context?.url === '')
                        );
                        log.info("FacebookAccountController.importFacebookArchive: isSharedPost", isSharedPost);

                        // Check if it's a share of a group post
                        const isGroupPost = post.attachments?.[0]?.data?.[0]?.name !== undefined;
                        log.info("FacebookAccountController.importFacebookArchive: isGroupPost", isGroupPost);
                        const groupName = isGroupPost ? post.attachments[0].data[0].name : undefined;
                        log.info("FacebookAccountController.importFacebookArchive: groupName", groupName);

                        // For group posts, if there's no explicit post text, use the group name
                        const finalText = isGroupPost
                            ? (postText || `Shared the group: ${groupName}`)
                            : postText;

                        // Process media attachments
                        const media: FacebookArchiveMedia[] = [];
                        if (post.attachments) {
                            for (const attachment of post.attachments) {
                                for (const data of attachment.data) {
                                    if (data.media) {
                                        media.push({
                                            uri: data.media.uri,
                                            type: data.media.uri.endsWith('.mp4') ? 'video' : 'photo',
                                            description: data.media.description,
                                            creationTimestamp: data.media.creation_timestamp
                                        });
                                    }
                                }
                            }
                        }
                        log.info("FacebookAccountController.importFacebookArchive: media", media);

                        // Process URLs
                        const urls: string[] = [];

                        // Check attachments for URLs
                        for (const attachment of post.attachments ?? []) {
                            for (const data of attachment.data ?? []) {
                                if (data.external_context?.url) {
                                    urls.push(data.external_context.url);
                                }
                            }
                        }

                        // Check data array for URLs
                        for (const data of post.data ?? []) {
                            if (data.external_context?.url && data.external_context.url !== '') {
                                urls.push(data.external_context.url);
                            }
                        }

                        log.info("FacebookAccountController.importFacebookArchive: found URLs", {
                            postTimestamp: post.timestamp,
                            urlCount: urls.length,
                            urls
                        });

                        postsData.push({
                            id_str: post.timestamp.toString(),
                            title: post.title || '',
                            full_text: finalText,
                            created_at: new Date(post.timestamp * 1000).toISOString(),
                            isReposted: isSharedPost || isGroupPost, // Group shares are reposts too
                            media: media.length > 0 ? media : undefined,
                            urls: urls,
                        });
                    }
                } catch (e) {
                    return {
                        status: "error",
                        errorMessage: "Error parsing JSON in exported posts",
                        importCount: importCount,
                        skipCount: skipCount,
                    };
                }

                // Loop through the posts and add them to the database
                try {
                    postsData.forEach(async (post) => {
                        // Is this post already there?
                        const existingPost = exec(this.db, 'SELECT * FROM post WHERE postID = ?', [post.id_str], "get") as FacebookPostRow;
                        if (existingPost) {
                            // First delete related media and URLs
                            exec(this.db, 'DELETE FROM post_media WHERE postId = ?', [post.id_str]);
                            exec(this.db, 'DELETE FROM post_url WHERE postId = ?', [post.id_str]);

                            // Delete the existing post to re-import
                            exec(this.db, 'DELETE FROM post WHERE postID = ?', [post.id_str]);
                        }

                        // Import it
                        exec(this.db, 'INSERT INTO post (postID, createdAt, title, text, isReposted, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?)', [
                            post.id_str,
                            new Date(post.created_at),
                            post.title,
                            post.full_text,
                            post.isReposted ? 1 : 0,
                            new Date(),
                        ]);

                        if (post.media && post.media.length > 0) {
                            log.info("FacebookAccountController.importFacebookArchive: importing media for post", post.id_str);
                            await this.importFacebookArchiveMedia(post.id_str, post.media, archivePath);
                        }

                        if (post.urls && post.urls.length > 0) {
                            log.info("FacebookAccountController.importFacebookArchive: importing urls for post", post.id_str);
                            await this.importFacebookArchiveUrl(post.id_str, post.urls);
                        }

                        importCount++;
                    });
                } catch (e) {
                    log.error("FacebookAccountController.importFacebookArchive: error importing posts", e);
                    return {
                        status: "error",
                        errorMessage: "Error importing posts: " + e,
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

        return {
            status: "error",
            errorMessage: "Invalid data type.",
            importCount: importCount,
            skipCount: skipCount,
        };
    }

    async importFacebookArchiveMedia(postId: string, media: FacebookArchiveMedia[], archivePath: string): Promise<void> {
        for (const mediaItem of media) {
            const sourcePath = path.join(archivePath, mediaItem.uri);
            const mediaId = `${postId}_${path.basename(mediaItem.uri)}`;

            // Create destination directory if it doesn't exist
            const mediaDir = path.join(this.accountDataPath, 'media');
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
            }

            const destPath = path.join(mediaDir, path.basename(mediaItem.uri));
            try {
                await fs.promises.copyFile(sourcePath, destPath);

                exec(this.db,
                    'INSERT INTO post_media (mediaId, postId, type, uri, description, createdAt, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [
                        mediaId,
                        postId,
                        mediaItem.type,
                        path.basename(mediaItem.uri),
                        mediaItem.description || null,
                        mediaItem.creationTimestamp ? new Date(mediaItem.creationTimestamp * 1000) : null,
                        new Date()
                    ]
                );
            } catch (error) {
                log.error(`FacebookAccountController.importFacebookArchiveMedia: Error importing media: ${error}`);
            }
        }
    }

    async importFacebookArchiveUrl(postId: string, urls: string[]) {
        try {
            for (const url of urls) {
                exec(this.db, 'INSERT INTO post_url (postId, url, addedToDatabaseAt) VALUES (?, ?, ?)', [postId, url, new Date()]);
            }
        } catch (error) {
            log.error(`FacebookAccountController.importFacebookArchiveUrl: Error importing urls: ${error}`);
        }
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
