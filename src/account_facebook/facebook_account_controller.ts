import path from 'path'
import fs from 'fs'

import fetch from 'node-fetch';
import { session } from 'electron'
import log from 'electron-log/main';
import Database from 'better-sqlite3'
import unzipper from 'unzipper';
import { JSDOM } from 'jsdom';

import {
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
} from './types'

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
        this.accountDataPath = getAccountDataPath('X', this.account.name);
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
);`
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

        // TODO: implement
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
            return `data:${response.headers.get('content-type')};base64,${buffer.toString('base64')}`;
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
        const unzippedPath = path.join(getAccountDataPath("Facebook", this.account.accountID), "tmp");

        const archiveZip = await unzipper.Open.file(archiveZipPath);
        await archiveZip.extract({ path: unzippedPath });

        log.info(`FacebookAccountController.unzipFacebookArchive: unzipped to ${unzippedPath}`);

        return unzippedPath;
    }

    // Delete the unzipped facebook archive once the build is completed
    async deleteUnzippedFacebookArchive(archivePath: string): Promise<void> {
        fs.rm(archivePath, { recursive: true, force: true }, err => {
            if (err) {
                log.error(`FacebookAccountController.deleteUnzippedFacebookArchive: Error occured while deleting unzipped folder: ${err}`);
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
            path.join(archivePath, "personal_information/profile_information"),
        ];

        // Make sure folders exist
        for (let i = 0; i < foldersToCheck.length; i++) {
            if (!fs.existsSync(foldersToCheck[i])) {
                log.error(`XAccountController.verifyXArchive: folder does not exist: ${foldersToCheck[i]}`);
                return `The folder ${foldersToCheck[i]} doesn't exist.`;
            }
        }

        // Make sure profile_information.html exists and is readable
        const profileInformationPath = path.join(archivePath, "personal_information/profile_information/profile_information.html");
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

        // Make sure the profile_information.html file belongs to the right account
        try {
            const html = fs.readFileSync(profileInformationPath, 'utf-8');
            const dom = new JSDOM(html);

            // Find the profile URL in the table
            const profileCell = Array.from(dom.window.document.querySelectorAll('td')).find(
                td => td.textContent?.includes('facebook.com/profile.php?id=')
            );

            if (!profileCell) {
                log.error("FacebookAccountController.verifyFacebookArchive: Could not find profile ID in archive");
                return "Could not find profile ID in archive";
            }

            const profileUrl = profileCell.querySelector('a')?.href;
            const profileId = profileUrl?.split('id=')[1];

            if (!profileId) {
                log.error("FacebookAccountController.verifyFacebookArchive: Could not extract profile ID from URL");
                return "Could not extract profile ID from URL";
            }

            if (profileId !== this.account?.accountID) {
                log.error(`FacebookAccountController.verifyFacebookArchive: profile_information.html does not belong to the right account`);
                return `This archive is for @${profileId}, not @${this.account?.accountID}.`;
            }
        } catch {
            return "Error parsing JSON in profile_information.html";
        }

        return null;
    }

    async importFacebookArchive(archivePath: string, dataType: string): Promise<FacebookImportArchiveResponse> {
        log.info("FacebookAccountController.importFacebookArchive: importing ", archivePath);
        log.info("FacebookAccountController.importFacebookArchive: dataType ", dataType);

        // TODO: implement
        return {
            status: 'error',
            errorMessage: 'Not implemented',
            importCount: 0,
            skipCount: 0,
        };
    }
}