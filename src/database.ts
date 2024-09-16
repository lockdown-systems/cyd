import path from "path"
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log/main';
import Database from 'better-sqlite3'

import { getSettingsPath } from "./util"
import { Account, XAccount } from './shared_types'

export type Migration = {
    name: string;
    sql: string[];
};

export const getMainDatabase = () => {
    const dbPath = path.join(getSettingsPath(), 'db.sqlite');
    const db = new Database(dbPath, {});
    db.pragma('journal_mode = WAL');
    return db;
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
    archiveTweets BOOLEAN DEFAULT 1,
    archiveDMs BOOLEAN DEFAULT 1,
    deleteTweets BOOLEAN DEFAULT 0,
    deleteTweetsDaysOld INTEGER DEFAULT 30,
    deleteTweetsLikesThresholdEnabled BOOLEAN DEFAULT 1,
    deleteTweetsLikesThreshold INTEGER DEFAULT 20,
    deleteTweetsRetweetsThresholdEnabled BOOLEAN DEFAULT 1,
    deleteTweetsRetweetsThreshold INTEGER DEFAULT 20,
    deleteRetweets BOOLEAN DEFAULT 0,
    deleteRetweetsDaysOld INTEGER DEFAULT 30,
    deleteLikes BOOLEAN DEFAULT 0,
    deleteLikesDaysOld INTEGER DEFAULT 60,
    deleteDMs BOOLEAN DEFAULT 0,
    deleteDMsDaysOld INTEGER DEFAULT 30
);`,
            ]
        }
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
    archiveTweets: number;
    archiveDMs: number;
    deleteTweets: number;
    deleteTweetsDaysOld: number;
    deleteTweetsLikesThresholdEnabled: number;
    deleteTweetsLikesThreshold: number;
    deleteTweetsRetweetsThresholdEnabled: number;
    deleteTweetsRetweetsThreshold: number;
    deleteRetweets: number;
    deleteRetweetsDaysOld: number;
    deleteLikes: number;
    deleteLikesDaysOld: number;
    deleteDMs: number;
    deleteDMsDaysOld: number;
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
    const stmt = db.prepare(sql);
    return stmt[cmd](...paramsConverted);
}

// Config

export const getConfig = (key: string): string | null => {
    const row: ConfigRow | undefined = exec(getMainDatabase(), 'SELECT value FROM config WHERE key = ?', [key], 'get') as ConfigRow | undefined;
    return row ? row.value : null;
}

export const setConfig = (key: string, value: string) => {
    exec(getMainDatabase(), 'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
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
        archiveTweets: !!row.archiveTweets,
        archiveDMs: !!row.archiveDMs,
        deleteTweets: !!row.deleteTweets,
        deleteTweetsDaysOld: row.deleteTweetsDaysOld,
        deleteTweetsRetweetsThresholdEnabled: !!row.deleteTweetsRetweetsThresholdEnabled,
        deleteTweetsLikesThreshold: row.deleteTweetsLikesThreshold,
        deleteTweetsLikesThresholdEnabled: !!row.deleteTweetsLikesThresholdEnabled,
        deleteTweetsRetweetsThreshold: row.deleteTweetsRetweetsThreshold,
        deleteRetweets: !!row.deleteRetweets,
        deleteRetweetsDaysOld: row.deleteRetweetsDaysOld,
        deleteLikes: !!row.deleteLikes,
        deleteLikesDaysOld: row.deleteLikesDaysOld,
        deleteDMs: !!row.deleteDMs,
        deleteDMsDaysOld: row.deleteDMsDaysOld,
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
            archiveTweets: !!row.archiveTweets,
            archiveDMs: !!row.archiveDMs,
            deleteTweets: !!row.deleteTweets,
            deleteTweetsDaysOld: row.deleteTweetsDaysOld,
            deleteTweetsLikesThresholdEnabled: !!row.deleteTweetsLikesThresholdEnabled,
            deleteTweetsLikesThreshold: row.deleteTweetsLikesThreshold,
            deleteTweetsRetweetsThresholdEnabled: !!row.deleteTweetsRetweetsThresholdEnabled,
            deleteTweetsRetweetsThreshold: row.deleteTweetsRetweetsThreshold,
            deleteRetweets: !!row.deleteRetweets,
            deleteRetweetsDaysOld: row.deleteRetweetsDaysOld,
            deleteLikes: !!row.deleteLikes,
            deleteLikesDaysOld: row.deleteLikesDaysOld,
            deleteDMs: !!row.deleteDMs,
            deleteDMsDaysOld: row.deleteDMsDaysOld,
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

export const saveXAccount = (account: XAccount) => {
    exec(getMainDatabase(), `
        UPDATE xAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            username = ?,
            profileImageDataURI = ?,
            archiveTweets = ?,
            archiveDMs = ?,
            deleteTweets = ?,
            deleteTweetsDaysOld = ?,
            deleteTweetsLikesThresholdEnabled = ?,
            deleteTweetsLikesThreshold = ?,
            deleteTweetsRetweetsThresholdEnabled = ?,
            deleteTweetsRetweetsThreshold = ?,
            deleteRetweets = ?,
            deleteRetweetsDaysOld = ?,
            deleteLikes = ?,
            deleteLikesDaysOld = ?,
            deleteDMs = ?,
            deleteDMsDaysOld = ?
        WHERE id = ?
    `, [
        account.username,
        account.profileImageDataURI,
        account.archiveTweets ? 1 : 0,
        account.archiveDMs ? 1 : 0,
        account.deleteTweets ? 1 : 0,
        account.deleteTweetsDaysOld,
        account.deleteTweetsLikesThresholdEnabled ? 1 : 0,
        account.deleteTweetsLikesThreshold,
        account.deleteTweetsRetweetsThresholdEnabled ? 1 : 0,
        account.deleteTweetsRetweetsThreshold,
        account.deleteRetweets ? 1 : 0,
        account.deleteRetweetsDaysOld,
        account.deleteLikes ? 1 : 0,
        account.deleteLikesDaysOld,
        account.deleteDMs ? 1 : 0,
        account.deleteDMsDaysOld,
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
    const accountUUID = uuidv4();
    const info: Sqlite3Info = exec(getMainDatabase(), 'INSERT INTO account (sortOrder, uuid) VALUES (?, ?)', [sortOrder, accountUUID]) as Sqlite3Info;

    // Return it
    const account = getAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

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
