import path from "path"
import crypto from 'crypto';
import os from 'os';

import log from 'electron-log/main';
import Database from 'better-sqlite3'
import { app, ipcMain, session } from 'electron';

import { getSettingsPath, packageExceptionForReport } from "./util"
import { ErrorReport, Account, XAccount } from './shared_types'

export type Migration = {
    name: string;
    sql: string[];
};

let mainDatabase: Database.Database | null = null;

export const getMainDatabase = () => {
    if (mainDatabase) {
        return mainDatabase;
    }

    const dbPath = path.join(getSettingsPath(), 'db.sqlite');
    mainDatabase = new Database(dbPath, {});
    mainDatabase.pragma('journal_mode = WAL');
    return mainDatabase;
}

export const closeMainDatabase = () => {
    if (mainDatabase) {
        mainDatabase.close();
        mainDatabase = null;
    }
}

export const runMigrations = (db: Database.Database, migrations: Migration[]) => {
    // Create a migrations table if necessary
    const migrationsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get();
    if (!migrationsTable) {
        // Create the migrations table
        log.debug("Creating migrations table");
        db.prepare(`CREATE TABLE  migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT NOT NULL, 
    runAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`).run();
    }

    // Apply the migrations in order
    for (const migration of migrations) {
        const migrationRecord = db.prepare("SELECT * FROM migrations WHERE name = ?").get(migration.name);
        if (!migrationRecord) {
            log.info(`Running migration: ${migration.name}`);
            for (const sql of migration.sql) {
                db.exec(sql);
            }
            db.prepare("INSERT INTO migrations (name) VALUES (?)").run(migration.name);
        }
    }
}

export const runMainMigrations = () => {
    runMigrations(getMainDatabase(), [
        // Create the tables
        {
            name: "initial",
            sql: [
                `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`, `CREATE TABLE account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'unknown',
    sortOrder INTEGER NOT NULL DEFAULT 0,
    xAccountId INTEGER DEFAULT NULL,
    uuid TEXT NOT NULL
);`, `CREATE TABLE xAccount (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    profileImageDataURI TEXT,
    saveMyData BOOLEAN DEFAULT 1,
    deleteMyData BOOLEAN DEFAULT 0,
    archiveTweets BOOLEAN DEFAULT 1,
    archiveTweetsHTML BOOLEAN DEFAULT 0,
    archiveLikes BOOLEAN DEFAULT 1,
    archiveDMs BOOLEAN DEFAULT 1,
    deleteTweets BOOLEAN DEFAULT 1,
    deleteTweetsDaysOld INTEGER DEFAULT 0,
    deleteTweetsLikesThresholdEnabled BOOLEAN DEFAULT 0,
    deleteTweetsLikesThreshold INTEGER DEFAULT 20,
    deleteTweetsRetweetsThresholdEnabled BOOLEAN DEFAULT 0,
    deleteTweetsRetweetsThreshold INTEGER DEFAULT 20,
    deleteRetweets BOOLEAN DEFAULT 1,
    deleteRetweetsDaysOld INTEGER DEFAULT 0,
    deleteLikes BOOLEAN DEFAULT 0,
    deleteLikesDaysOld INTEGER DEFAULT 0,
    deleteDMs BOOLEAN DEFAULT 0
);`,
            ]
        },
        // Add importFromArchive, followingCount, follwersCount, tweetsCount, likesCount to xAccount
        {
            name: "add importFromArchive, followingCount, follwersCount, tweetsCount, likesCount to xAccount",
            sql: [
                `ALTER TABLE xAccount ADD COLUMN importFromArchive BOOLEAN DEFAULT 1;`,
                `ALTER TABLE xAccount ADD COLUMN followingCount INTEGER DEFAULT 0;`,
                `ALTER TABLE xAccount ADD COLUMN followersCount INTEGER DEFAULT 0;`,
                `ALTER TABLE xAccount ADD COLUMN tweetsCount INTEGER DEFAULT -1;`,
                `ALTER TABLE xAccount ADD COLUMN likesCount INTEGER DEFAULT -1;`,
            ]
        },
        // Add unfollowEveryone to xAccount
        {
            name: "add unfollowEveryone to xAccount",
            sql: [
                `ALTER TABLE xAccount ADD COLUMN unfollowEveryone BOOLEAN DEFAULT 1;`,
            ]
        },
        // Add deleteTweetsDaysOldEnabled, deleteRetweetsDaysOldEnabled, deleteLikesDaysOldEnabled to xAccount
        {
            name: "add deleteTweetsDaysOldEnabled, deleteRetweetsDaysOldEnabled, deleteLikesDaysOldEnabled to xAccount",
            sql: [
                `ALTER TABLE xAccount ADD COLUMN deleteTweetsDaysOldEnabled BOOLEAN DEFAULT 0;`,
                `ALTER TABLE xAccount ADD COLUMN deleteRetweetsDaysOldEnabled BOOLEAN DEFAULT 0;`,
                `ALTER TABLE xAccount ADD COLUMN deleteLikesDaysOldEnabled BOOLEAN DEFAULT 0;`,
            ]
        },
        // Add errorReport table. Status can be "new", "submitted", and "dismissed"
        {
            name: "add errorReport table",
            sql: [
                `CREATE TABLE errorReport (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accountID INTEGER DEFAULT NULL,
    appVersion TEXT DEFAULT NULL,
    clientPlatform TEXT DEFAULT NULL,
    accountType TEXT DEFAULT NULL,
    errorReportType TEXT NOT NULL,
    errorReportData TEXT DEFAULT NULL,
    accountUsername TEXT DEFAULT NULL,
    screenshotDataURI TEXT DEFAULT NULL,
    sensitiveContextData TEXT DEFAULT NULL,
    status TEXT DEFAULT 'new'
);`,
            ]
        },
        // Add archiveMyData to xAccount
        {
            name: "add archiveMyData to xAccount",
            sql: [
                `ALTER TABLE xAccount ADD COLUMN archiveMyData BOOLEAN DEFAULT 0;`,
            ]
        },
        // Add archiveBookmarks, deleteBookmarks to xAccount
        {
            name: "add archiveBookmarks, deleteBookmarks to xAccount",
            sql: [
                `ALTER TABLE xAccount ADD COLUMN archiveBookmarks BOOLEAN DEFAULT 1;`,
                `ALTER TABLE xAccount ADD COLUMN deleteBookmarks BOOLEAN DEFAULT 0;`,
            ]
        },
        // Add Bluesky table
        {
            name: "add Bluesky table",
            sql: [
                `CREATE TABLE blueskyAccount (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    profileImageDataURI TEXT,
    saveMyData BOOLEAN DEFAULT 1,
    deleteMyData BOOLEAN DEFAULT 0,
    archivePosts BOOLEAN DEFAULT 1,
    archivePostsHTML BOOLEAN DEFAULT 0,
    archiveLikes BOOLEAN DEFAULT 1,
    archiveDMs BOOLEAN DEFAULT 1,
    deletePosts BOOLEAN DEFAULT 1,
    deletePostsDaysOld INTEGER DEFAULT 0,
    deletePostsLikesThresholdEnabled BOOLEAN DEFAULT 0,
    deletePostsLikesThreshold INTEGER DEFAULT 20,
    deletePostsRepostsThresholdEnabled BOOLEAN DEFAULT 0,
    deletePostsRepostsThreshold INTEGER DEFAULT 20,
    deleteReposts BOOLEAN DEFAULT 1,
    deleteRepostsDaysOld INTEGER DEFAULT 0,
    deleteLikes BOOLEAN DEFAULT 0,
    deleteLikesDaysOld INTEGER DEFAULT 0,
    deleteDMs BOOLEAN DEFAULT 0,
    unfollowEveryone BOOLEAN DEFAULT 1,
    followingCount INTEGER DEFAULT 0,
    followersCount INTEGER DEFAULT 0,
    postsCount INTEGER DEFAULT -1,
    likesCount INTEGER DEFAULT -1
);`,
            ]
        },
    ]);
}

export interface Sqlite3Info {
    lastInsertRowid: number;
    changes: number;
}

export interface Sqlite3Count {
    count: number;
}

interface ConfigRow {
    key: string;
    value: string;
}

interface AccountRow {
    id: number;
    type: string;
    sortOrder: number;
    xAccountId: number | null;
    uuid: string;
}

interface XAccountRow {
    id: number;
    createdAt: string;
    updatedAt: string;
    accessedAt: string;
    username: string;
    profileImageDataURI: string;
    importFromArchive: boolean;
    saveMyData: boolean;
    deleteMyData: boolean;
    archiveMyData: boolean;
    archiveTweets: boolean;
    archiveTweetsHTML: boolean;
    archiveLikes: boolean;
    archiveBookmarks: boolean;
    archiveDMs: boolean;
    deleteTweets: boolean;
    deleteTweetsDaysOldEnabled: boolean;
    deleteTweetsDaysOld: number;
    deleteTweetsLikesThresholdEnabled: boolean;
    deleteTweetsLikesThreshold: number;
    deleteTweetsRetweetsThresholdEnabled: boolean;
    deleteTweetsRetweetsThreshold: number;
    deleteRetweets: boolean;
    deleteRetweetsDaysOldEnabled: boolean;
    deleteRetweetsDaysOld: number;
    deleteLikes: boolean;
    deleteBookmarks: number;
    deleteDMs: boolean;
    unfollowEveryone: boolean;
    followingCount: number;
    followersCount: number;
    tweetsCount: number;
    likesCount: number;
}

export interface BlueskyAccountRow {
    id: number;
    createdAt: string;
    updatedAt: string;
    accessedAt: string;
    username: string;
    profileImageDataURI: string;
    saveMyData: boolean;
    deleteMyData: boolean;
    archivePosts: boolean;
    archivePostsHTML: boolean;
    archiveLikes: boolean;
    archiveDMs: boolean;
    deletePosts: boolean;
    deletePostsDaysOld: number;
    deletePostsLikesThresholdEnabled: boolean;
    deletePostsLikesThreshold: number;
    deletePostsRepostsThresholdEnabled: boolean;
    deletePostsRepostsThreshold: number;
    deleteReposts: boolean;
    deleteRepostsDaysOld: number;
    deleteLikes: boolean;
    deleteLikesDaysOld: number;
    deleteDMs: boolean;
    unfollowEveryone: boolean;
    followingCount: number;
    followersCount: number;
    postsCount: number;
    likesCount: number;
}

export interface ErrorReportRow {
    id: number;
    createdAt: string;
    accountID: number;
    appVersion: string;
    clientPlatform: string;
    accountType: string;
    errorReportType: string;
    errorReportData: string;
    accountUsername: string;
    screenshotDataURI: string;
    sensitiveContextData: string;
    status: string; // "new", "submitted", and "dismissed"
}

// Utils

export const exec = (db: Database.Database | null, sql: string, params: Array<number | string | bigint | Buffer | Date | null> = [], cmd: 'run' | 'all' | 'get' = 'run') => {
    if (!db) {
        throw new Error("Database not initialized");
    }

    // Convert Date objects to ISO strings
    const paramsConverted: Array<number | string | bigint | Buffer | null> = [];
    for (const param of params) {
        if (param instanceof Date) {
            paramsConverted.push(param.toISOString());
        } else {
            paramsConverted.push(param);
        }
    }

    // Execute the query
    log.debug("Executing SQL:", sql, "Params:", paramsConverted);
    try {
        const stmt = db.prepare(sql);
        const ret = stmt[cmd](...paramsConverted);
        return ret
    } catch (error) {
        const exception = JSON.parse(packageExceptionForReport(error as Error))
        throw new Error(JSON.stringify({
            exception: exception,
            sql: sql,
            params: paramsConverted
        }));
    }
}

// Config

export const getConfig = (key: string, db: Database.Database | null = null): string | null => {
    if (!db) {
        db = getMainDatabase();
    }
    const row: ConfigRow | undefined = exec(db, 'SELECT value FROM config WHERE key = ?', [key], 'get') as ConfigRow | undefined;
    return row ? row.value : null;
}

export const setConfig = (key: string, value: string, db: Database.Database | null = null) => {
    if (!db) {
        db = getMainDatabase();
    }
    exec(db, 'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
}

// Error reports

export const getErrorReport = (id: number): ErrorReport | null => {
    const row: ErrorReportRow | undefined = exec(getMainDatabase(), 'SELECT * FROM errorReport WHERE id = ?', [id], 'get') as ErrorReportRow | undefined;
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        createdAt: row.createdAt,
        accountID: row.accountID,
        appVersion: row.appVersion,
        clientPlatform: row.clientPlatform,
        accountType: row.accountType,
        errorReportType: row.errorReportType,
        errorReportData: row.errorReportData,
        accountUsername: row.accountUsername,
        screenshotDataURI: row.screenshotDataURI,
        sensitiveContextData: row.sensitiveContextData,
        status: row.status
    }
}

export const getNewErrorReports = (accountID: number): ErrorReport[] => {
    const rows: ErrorReportRow[] = exec(getMainDatabase(), 'SELECT * FROM errorReport WHERE accountID = ? AND status = ?', [accountID, 'new'], 'all') as ErrorReportRow[];
    const errorReports: ErrorReport[] = [];
    for (const row of rows) {
        errorReports.push({
            id: row.id,
            createdAt: row.createdAt,
            accountID: row.accountID,
            appVersion: row.appVersion,
            clientPlatform: row.clientPlatform,
            accountType: row.accountType,
            errorReportType: row.errorReportType,
            errorReportData: row.errorReportData,
            accountUsername: row.accountUsername,
            screenshotDataURI: row.screenshotDataURI,
            sensitiveContextData: row.sensitiveContextData,
            status: row.status
        });
    }
    return errorReports;
}

export const createErrorReport = (accountID: number, accountType: string, errorReportType: string, errorReportData: string, accountUsername: string | null, screenshotDataURI: string | null, sensitiveContextData: string | null) => {
    const info: Sqlite3Info = exec(getMainDatabase(), `
        INSERT INTO errorReport (
            accountID, 
            appVersion, 
            clientPlatform, 
            accountType, 
            errorReportType, 
            errorReportData, 
            accountUsername, 
            screenshotDataURI, 
            sensitiveContextData
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        accountID,
        app.getVersion(),
        os.platform(),
        accountType,
        errorReportType,
        errorReportData,
        accountUsername,
        screenshotDataURI,
        sensitiveContextData
    ]) as Sqlite3Info;
    const report = getErrorReport(info.lastInsertRowid);
    if (!report) {
        throw new Error("Failed to create error report");
    }
}

export const updateErrorReportSubmitted = (id: number) => {
    exec(getMainDatabase(), 'DELETE FROM errorReport WHERE id = ?', [id]);
}

export const dismissNewErrorReports = (accountID: number) => {
    exec(getMainDatabase(), 'DELETE FROM errorReport WHERE accountID = ? AND status = ?', [accountID, 'new']);
}

export const dismissAllNewErrorReports = () => {
    exec(getMainDatabase(), 'DELETE FROM errorReport WHERE status = ?', ['new']);
}

// X accounts

export const getXAccount = (id: number): XAccount | null => {
    const row: XAccountRow | undefined = exec(getMainDatabase(), 'SELECT * FROM xAccount WHERE id = ?', [id], 'get') as XAccountRow | undefined;
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        accessedAt: new Date(row.accessedAt),
        username: row.username,
        profileImageDataURI: row.profileImageDataURI,
        importFromArchive: !!row.importFromArchive,
        saveMyData: !!row.saveMyData,
        deleteMyData: !!row.deleteMyData,
        archiveMyData: !!row.archiveMyData,
        archiveTweets: !!row.archiveTweets,
        archiveTweetsHTML: !!row.archiveTweetsHTML,
        archiveLikes: !!row.archiveLikes,
        archiveBookmarks: !!row.archiveBookmarks,
        archiveDMs: !!row.archiveDMs,
        deleteTweets: !!row.deleteTweets,
        deleteTweetsDaysOldEnabled: !!row.deleteTweetsDaysOldEnabled,
        deleteTweetsDaysOld: row.deleteTweetsDaysOld,
        deleteTweetsLikesThresholdEnabled: !!row.deleteTweetsLikesThresholdEnabled,
        deleteTweetsLikesThreshold: row.deleteTweetsLikesThreshold,
        deleteTweetsRetweetsThresholdEnabled: !!row.deleteTweetsRetweetsThresholdEnabled,
        deleteTweetsRetweetsThreshold: row.deleteTweetsRetweetsThreshold,
        deleteRetweets: !!row.deleteRetweets,
        deleteRetweetsDaysOldEnabled: !!row.deleteRetweetsDaysOldEnabled,
        deleteRetweetsDaysOld: row.deleteRetweetsDaysOld,
        deleteLikes: !!row.deleteLikes,
        deleteBookmarks: !!row.deleteBookmarks,
        deleteDMs: !!row.deleteDMs,
        unfollowEveryone: !!row.unfollowEveryone,
        followingCount: row.followingCount,
        followersCount: row.followersCount,
        tweetsCount: row.tweetsCount,
        likesCount: row.likesCount
    };
}

export const getXAccounts = (): XAccount[] => {
    const rows: XAccountRow[] = exec(getMainDatabase(), 'SELECT * FROM xAccount', [], 'all') as XAccountRow[];

    const accounts: XAccount[] = [];
    for (const row of rows) {
        accounts.push({
            id: row.id,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
            accessedAt: new Date(row.accessedAt),
            username: row.username,
            profileImageDataURI: row.profileImageDataURI,
            importFromArchive: !!row.importFromArchive,
            saveMyData: !!row.saveMyData,
            deleteMyData: !!row.deleteMyData,
            archiveMyData: !!row.archiveMyData,
            archiveTweets: !!row.archiveTweets,
            archiveTweetsHTML: !!row.archiveTweetsHTML,
            archiveLikes: !!row.archiveLikes,
            archiveBookmarks: !!row.archiveBookmarks,
            archiveDMs: !!row.archiveDMs,
            deleteTweets: !!row.deleteTweets,
            deleteTweetsDaysOldEnabled: !!row.deleteTweetsDaysOldEnabled,
            deleteTweetsDaysOld: row.deleteTweetsDaysOld,
            deleteTweetsLikesThresholdEnabled: !!row.deleteTweetsLikesThresholdEnabled,
            deleteTweetsLikesThreshold: row.deleteTweetsLikesThreshold,
            deleteTweetsRetweetsThresholdEnabled: !!row.deleteTweetsRetweetsThresholdEnabled,
            deleteTweetsRetweetsThreshold: row.deleteTweetsRetweetsThreshold,
            deleteRetweets: !!row.deleteRetweets,
            deleteRetweetsDaysOldEnabled: !!row.deleteRetweetsDaysOldEnabled,
            deleteRetweetsDaysOld: row.deleteRetweetsDaysOld,
            deleteLikes: !!row.deleteLikes,
            deleteBookmarks: !!row.deleteBookmarks,
            deleteDMs: !!row.deleteDMs,
            unfollowEveryone: !!row.unfollowEveryone,
            followingCount: row.followingCount,
            followersCount: row.followersCount,
            tweetsCount: row.tweetsCount,
            likesCount: row.likesCount
        });
    }
    return accounts;
}

export const createXAccount = (): XAccount => {
    const info: Sqlite3Info = exec(getMainDatabase(), 'INSERT INTO xAccount DEFAULT VALUES') as Sqlite3Info;
    const account = getXAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

// Update the account based on account.id
export const saveXAccount = (account: XAccount) => {
    exec(getMainDatabase(), `
        UPDATE xAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            username = ?,
            profileImageDataURI = ?,
            importFromArchive = ?,
            saveMyData = ?,
            deleteMyData = ?,
            archiveMyData = ?,
            archiveTweets = ?,
            archiveTweetsHTML = ?,
            archiveLikes = ?,
            archiveBookmarks = ?,
            archiveDMs = ?,
            deleteTweets = ?,
            deleteTweetsDaysOld = ?,
            deleteTweetsDaysOldEnabled = ?,
            deleteTweetsLikesThresholdEnabled = ?,
            deleteTweetsLikesThreshold = ?,
            deleteTweetsRetweetsThresholdEnabled = ?,
            deleteTweetsRetweetsThreshold = ?,
            deleteRetweets = ?,
            deleteRetweetsDaysOldEnabled = ?,
            deleteRetweetsDaysOld = ?,
            deleteLikes = ?,
            deleteBookmarks = ?,
            deleteDMs = ?,
            unfollowEveryone = ?,
            followingCount = ?,
            followersCount = ?,
            tweetsCount = ?,
            likesCount = ?
        WHERE id = ?
    `, [
        account.username,
        account.profileImageDataURI,
        account.importFromArchive ? 1 : 0,
        account.saveMyData ? 1 : 0,
        account.deleteMyData ? 1 : 0,
        account.archiveMyData ? 1 : 0,
        account.archiveTweets ? 1 : 0,
        account.archiveTweetsHTML ? 1 : 0,
        account.archiveLikes ? 1 : 0,
        account.archiveBookmarks ? 1 : 0,
        account.archiveDMs ? 1 : 0,
        account.deleteTweets ? 1 : 0,
        account.deleteTweetsDaysOld,
        account.deleteTweetsDaysOldEnabled ? 1 : 0,
        account.deleteTweetsLikesThresholdEnabled ? 1 : 0,
        account.deleteTweetsLikesThreshold,
        account.deleteTweetsRetweetsThresholdEnabled ? 1 : 0,
        account.deleteTweetsRetweetsThreshold,
        account.deleteRetweets ? 1 : 0,
        account.deleteRetweetsDaysOldEnabled ? 1 : 0,
        account.deleteRetweetsDaysOld,
        account.deleteLikes ? 1 : 0,
        account.deleteBookmarks ? 1 : 0,
        account.deleteDMs ? 1 : 0,
        account.unfollowEveryone ? 1 : 0,
        account.followingCount,
        account.followersCount,
        account.tweetsCount,
        account.likesCount,
        account.id
    ]);
}

// Accounts, which contain all others

export const getAccount = (id: number): Account | null => {
    const row: AccountRow | undefined = exec(getMainDatabase(), 'SELECT * FROM account WHERE id = ?', [id], 'get') as AccountRow | undefined;
    if (!row) {
        return null;
    }

    let xAccount: XAccount | null = null;
    switch (row.type) {
        case "X":
            if (row.xAccountId) {
                xAccount = getXAccount(row.xAccountId);
            }
            break;
    }

    return {
        id: row.id,
        type: row.type,
        sortOrder: row.sortOrder,
        xAccount: xAccount,
        uuid: row.uuid
    };
}

export async function getAccountUsername(account: Account): Promise<string | null> {
    if (account.type == "X" && account.xAccount) {
        return account.xAccount?.username;
    }

    return null;
}

export const getAccounts = (): Account[] => {
    const rows: AccountRow[] = exec(getMainDatabase(), 'SELECT * FROM account', [], 'all') as AccountRow[];

    const accounts: Account[] = [];
    for (const row of rows) {
        let xAccount: XAccount | null = null;
        switch (row.type) {
            case "X":
                if (row.xAccountId) {
                    xAccount = getXAccount(row.xAccountId);
                }
                break;
        }

        accounts.push({
            id: row.id,
            type: row.type,
            sortOrder: row.sortOrder,
            xAccount: xAccount,
            uuid: row.uuid
        });
    }
    return accounts;
}

export const createAccount = (): Account => {
    // Figure out the sortOrder for the new account
    const row: { maxSortOrder: number } = exec(getMainDatabase(), 'SELECT MAX(sortOrder) as maxSortOrder FROM account', [], 'get') as { maxSortOrder: number };
    const sortOrder = row.maxSortOrder ? row.maxSortOrder + 1 : 0;

    // Insert it
    const accountUUID = crypto.randomUUID();
    const info: Sqlite3Info = exec(getMainDatabase(), 'INSERT INTO account (sortOrder, uuid) VALUES (?, ?)', [sortOrder, accountUUID]) as Sqlite3Info;

    // Return it
    const account = getAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

// Set account.type to type, create a new account of that type (right now, just xAccount), and return the account
export const selectAccountType = (accountID: number, type: string): Account => {
    // Get the account
    const account = getAccount(accountID);
    if (!account) {
        throw new Error("Account not found");
    }
    if (account.type != "unknown") {
        throw new Error("Account already has a type");
    }

    // Create the new account type
    switch (type) {
        case "X":
            account.xAccount = createXAccount();
            break;
        default:
            throw new Error("Unknown account type");
    }

    // Update the account
    exec(getMainDatabase(), `
        UPDATE account
        SET
            type = ?,
            xAccountId = ?
        WHERE id = ?
    `, [
        type,
        account.xAccount.id,
        account.id
    ]);

    account.type = type;
    return account;
}

// Update the account based on account.id
export const saveAccount = (account: Account) => {
    if (account.xAccount) {
        saveXAccount(account.xAccount);
    }

    exec(getMainDatabase(), `
        UPDATE account
        SET
            type = ?,
            sortOrder = ?
        WHERE id = ?
    `, [
        account.type,
        account.sortOrder,
        account.id
    ]);
}

export const deleteAccount = (accountID: number) => {
    // Get the account
    const account = getAccount(accountID);
    if (!account) {
        throw new Error("Account not found");
    }

    // Delete the account type
    switch (account.type) {
        case "X":
            if (account.xAccount) {
                exec(getMainDatabase(), 'DELETE FROM xAccount WHERE id = ?', [account.xAccount.id]);
            }
            break;
    }

    // Delete the account
    exec(getMainDatabase(), 'DELETE FROM account WHERE id = ?', [accountID]);
}

export const defineIPCDatabase = () => {
    ipcMain.handle('database:getConfig', async (_, key) => {
        try {
            return getConfig(key);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:setConfig', async (_, key, value) => {
        try {
            setConfig(key, value);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:getErrorReport', async (_, id): Promise<ErrorReport | null> => {
        try {
            return getErrorReport(id);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:getNewErrorReports', async (_, accountID: number): Promise<ErrorReport[]> => {
        try {
            return getNewErrorReports(accountID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:createErrorReport', async (_, accountID: number, accountType: string, errorReportType: string, errorReportData: string, accountUsername: string | null, screenshotDataURI: string | null, sensitiveContextData: string | null): Promise<void> => {
        try {
            createErrorReport(accountID, accountType, errorReportType, errorReportData, accountUsername, screenshotDataURI, sensitiveContextData);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:updateErrorReportSubmitted', async (_, id): Promise<void> => {
        try {
            updateErrorReportSubmitted(id);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:dismissNewErrorReports', async (_, accountID: number): Promise<void> => {
        try {
            dismissNewErrorReports(accountID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:getAccount', async (_, accountID): Promise<Account | null> => {
        try {
            return getAccount(accountID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:getAccounts', async (_): Promise<Account[]> => {
        try {
            return getAccounts();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:createAccount', async (_) => {
        try {
            return createAccount();
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:selectAccountType', async (_, accountID, type) => {
        try {
            return selectAccountType(accountID, type);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:saveAccount', async (_, accountJson) => {
        try {
            const account = JSON.parse(accountJson);
            return saveAccount(account);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });

    ipcMain.handle('database:deleteAccount', async (_, accountID) => {
        try {
            const ses = session.fromPartition(`persist:account-${accountID}`);
            await ses.closeAllConnections();
            await ses.clearStorageData();
            deleteAccount(accountID);
        } catch (error) {
            throw new Error(packageExceptionForReport(error as Error));
        }
    });
}