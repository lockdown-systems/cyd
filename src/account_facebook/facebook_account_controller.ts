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
} from '../shared_types'
import {
    runMigrations,
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
    FacebookPostRow
} from './types'
import * as FacebookArchiveTypes from '../../archive-static-sites/facebook-archive/src/types';

export class FacebookAccountController {
    private accountUUID: string = "";
    // Making this public so it can be accessed in tests
    public account: FacebookAccount | null = null;
    private accountID: number = 0;
    private accountDataPath: string = "";

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

    async archiveBuild() {
        if (!this.db) {
            this.initDB();
        }

        if (!this.account) {
            return false;
        }

        log.info("FacebookAccountController.archiveBuild: building archive");

        // Posts
        const posts: FacebookPostRow[] = exec(
            this.db,
            "SELECT * FROM post ORDER BY createdAt DESC",
            [],
            "all"
        ) as FacebookPostRow[];

        // Get the current account's userID
        // const accountUser = users.find((user) => user.screenName == this.account?.username);
        // const accountUserID = accountUser?.userID;

        const postRowToArchivePost = (post: FacebookPostRow): FacebookArchiveTypes.Post => {
            const archivePost: FacebookArchiveTypes.Post = {
                postID: post.postID,
                createdAt: post.createdAt,
                text: post.text,
                title: post.title,
                isReposted: post.isReposted,
                archivedAt: post.archivedAt,
            };
            return archivePost
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
                        // Skip if no post text
                        const postText = post.data?.find((d: { post?: string }) => 'post' in d && typeof d.post === 'string')?.post;
                        if (!postText) {
                            log.info("FacebookAccountController.importFacebookArchive: skipping post with no text");
                            continue;
                        }

                        // Check if it's a shared post by looking for external_context in attachments
                        const isSharedPost = post.attachments?.[0]?.data?.[0]?.external_context !== undefined;

                        // Skip if it's a group post, shares a group, etc. We will extend the import logic
                        // to include other data types in the future.
                        if (post.attachments) {
                            log.info("FacebookAccountController.importFacebookArchive: skipping unknown post type");
                            continue;
                        }

                        postsData.push({
                            id_str: post.timestamp.toString(),
                            title: post.title || '',
                            full_text: postText,
                            created_at: new Date(post.timestamp * 1000).toISOString(),
                            isReposted: isSharedPost,
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
                    postsData.forEach((post) => {
                        // Is this post already there?
                        const existingPost = exec(this.db, 'SELECT * FROM post WHERE postID = ?', [post.id_str], "get") as FacebookPostRow;
                        if (existingPost) {
                            // Delete the existing post to re-import
                            exec(this.db, 'DELETE FROM post WHERE postID = ?', [post.id_str]);
                        }

                        // TODO: implement media import for facebook
                        // TODO: implement urls import for facebook

                        // Import it
                        exec(this.db, 'INSERT INTO post (postID, createdAt, title, text, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?)', [
                            post.id_str,
                            new Date(post.created_at),
                            post.title,
                            post.full_text,
                            new Date(),
                        ]);
                        importCount++;
                    });
                } catch (e) {
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
}

const getPostType = (element: Element): 'status' | 'shared_post' | 'shared_group' | 'other' => {
    const pinDivs = element.querySelectorAll('._2pin');

    if (pinDivs.length === 1) {
        return 'status';
    }

    if (pinDivs.length === 2) {
        // Check for group name structure
        const firstPinContent = pinDivs[0].textContent?.trim();
        if (firstPinContent && !firstPinContent.includes('div')) {
            return 'shared_group';
        }
        // Shared posts have empty nested divs
        const emptyDivs = pinDivs[0].querySelectorAll('div div div div');
        if (emptyDivs.length > 0) {
            return 'shared_post';
        }
    }

    return 'other';
};