import path from "path"
import { app } from 'electron'
import Database from 'better-sqlite3'

import { Account, XAccount } from './shared_types'

export type Migration = {
    name: string;
    sql: string[];
};

const dbPath = `${path.join(app.getPath('userData'), 'db.sqlite')}`;

export const db = new Database(dbPath, {});
db.pragma('journal_mode = WAL');

export const runMigrations = (db: Database, migrations: Migration[]) => {
    // Create a migrations table if necessary
    const migrationsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get();
    if (!migrationsTable) {
        // Create the migrations table
        console.info("Creating migrations table");
        db.prepare(`
            CREATE TABLE  migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                name TEXT NOT NULL, 
                runAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
    }

    // Apply the migrations in order
    for (const migration of migrations) {
        const migrationRecord = db.prepare("SELECT * FROM migrations WHERE name = ?").get(migration.name);
        if (!migrationRecord) {
            console.info(`Running migration: ${migration.name}`);
            for (const sql of migration.sql) {
                db.exec(sql);
            }
            db.prepare("INSERT INTO migrations (name) VALUES (?)").run(migration.name);
        }
    }
}

export const runMainMigrations = () => {
    runMigrations(db, [
        {
            name: "initial",
            sql: [
                `
                CREATE TABLE config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL
                );
                `, `
                CREATE TABLE account (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL DEFAULT 'unknown',
                    sortOrder INTEGER NOT NULL DEFAULT 0,
                    xAccountId INTEGER DEFAULT NULL
                );
                `, `
                CREATE TABLE xAccount (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    username TEXT,
                    archiveTweets BOOLEAN DEFAULT 1,
                    archiveDirectMessages BOOLEAN DEFAULT 1,
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
                    deleteDirectMessages BOOLEAN DEFAULT 0,
                    deleteDirectMessagesDaysOld INTEGER DEFAULT 30
                );
                `,
            ]
        }
    ]);
}

// Helpers

export const exec = (sql: string, params: Array<number | string | bigint | Buffer | null> = [], cmd: 'run' | 'all' | 'get' = 'run') => {
    console.info("Executing SQL:", sql, "Params:", params);
    const stmt = db.prepare(sql);
    return stmt[cmd](...params);
}

// Config

export const getConfig = (key: string): string | null => {
    const row = exec('SELECT value FROM config WHERE key = ?', [key], 'get');
    return row ? row.value : null;
}

export const setConfig = (key: string, value: string) => {
    exec('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
}

// X accounts

export const getXAccount = (id: number): XAccount | null => {
    const row = exec('SELECT * FROM xAccount WHERE id = ?', [id], 'get');
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        accessedAt: new Date(row.accessedAt),
        username: row.username,
        archiveTweets: !!row.archiveTweets,
        archiveDirectMessages: !!row.archiveDirectMessages,
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
        deleteDirectMessages: !!row.deleteDirectMessages,
        deleteDirectMessagesDaysOld: row.deleteDirectMessagesDaysOld,
    };
}

export const getXAccounts = (): XAccount[] => {
    const rows = exec('SELECT * FROM xAccount', [], 'all');

    const accounts: XAccount[] = [];
    for (const row of rows) {
        accounts.push({
            id: row.id,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
            accessedAt: new Date(row.accessedAt),
            username: row.username,
            archiveTweets: !!row.archiveTweets,
            archiveDirectMessages: !!row.archiveDirectMessages,
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
            deleteDirectMessages: !!row.deleteDirectMessages,
            deleteDirectMessagesDaysOld: row.deleteDirectMessagesDaysOld,
        });
    }
    return accounts;
}

export const createXAccount = (): XAccount => {
    const info = exec('INSERT INTO xAccount DEFAULT VALUES');
    const account = getXAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

export const saveXAccount = (account: XAccount) => {
    exec(`
        UPDATE xAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            username = ?,
            archiveTweets = ?,
            archiveDirectMessages = ?,
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
            deleteDirectMessages = ?,
            deleteDirectMessagesDaysOld = ?
        WHERE id = ?
    `, [
        account.username,
        account.archiveTweets ? 1 : 0,
        account.archiveDirectMessages ? 1 : 0,
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
        account.deleteDirectMessages ? 1 : 0,
        account.deleteDirectMessagesDaysOld,
        account.id
    ]);
}

// Accounts, which contain all others

export const getAccount = (id: number): Account | null => {
    const row = exec('SELECT * FROM account WHERE id = ?', [id], 'get');
    if (!row) {
        return null;
    }

    let xAccount: XAccount | null = null;
    switch (row.type) {
        case "X":
            xAccount = getXAccount(row.xAccountId);
            break;
    }

    return {
        id: row.id,
        type: row.type,
        sortOrder: row.sortOrder,
        xAccount: xAccount
    };
}

export const getAccounts = (): Account[] => {
    const rows = exec('SELECT * FROM account', [], 'all');

    const accounts: Account[] = [];
    for (const row of rows) {
        let xAccount: XAccount | null = null;
        switch (row.type) {
            case "X":
                xAccount = getXAccount(row.xAccountId);
                break;
        }

        accounts.push({
            id: row.id,
            type: row.type,
            sortOrder: row.sortOrder,
            xAccount: xAccount,
        });
    }
    return accounts;
}

export const createAccount = (): Account => {
    // Figure out the sortOrder for the new account
    const row = exec('SELECT MAX(sortOrder) as maxSortOrder FROM account', [], 'get');
    const sortOrder = row.maxSortOrder ? row.maxSortOrder + 1 : 0;

    // Insert it
    const info = exec('INSERT INTO account (sortOrder) VALUES (?)', [sortOrder]);

    // Return it
    const account = getAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

export const selectNewAccount = (accountID: number, type: string): Account => {
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
    exec(`
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

    exec(`
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
                exec('DELETE FROM xAccount WHERE id = ?', [account.xAccount.id]);
            }
            break;
    }

    // Delete the account
    exec('DELETE FROM account WHERE id = ?', [accountID]);
}