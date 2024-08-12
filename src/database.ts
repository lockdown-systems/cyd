import path from "path"
import { ipcMain, session } from 'electron'
import Database from 'better-sqlite3'

import { getSettingsPath } from "./helpers"
import { Account, XAccount } from './shared_types'

export type Migration = {
    name: string;
    sql: string[];
};

const dbPath = path.join(getSettingsPath(), 'db.sqlite');

export const db = new Database(dbPath, {});
db.pragma('journal_mode = WAL');

export const runMigrations = (db: Database.Database, migrations: Migration[]) => {
    // Create a migrations table if necessary
    const migrationsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get();
    if (!migrationsTable) {
        // Create the migrations table
        console.info("Creating migrations table");
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
                `CREATE TABLE config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL
);`, `CREATE TABLE account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'unknown',
    sortOrder INTEGER NOT NULL DEFAULT 0,
    xAccountId INTEGER DEFAULT NULL
);`, `CREATE TABLE xAccount (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    accessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
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

// Helpers

export const exec = (db: Database.Database, sql: string, params: Array<number | string | bigint | Buffer | Date | null> = [], cmd: 'run' | 'all' | 'get' = 'run') => {
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
    console.info("Executing SQL:", sql, "Params:", paramsConverted);
    const stmt = db.prepare(sql);
    return stmt[cmd](...paramsConverted);
}

// Config

export const getConfig = (key: string): string | null => {
    const row = exec(db, 'SELECT value FROM config WHERE key = ?', [key], 'get');
    return row ? row.value : null;
}

export const setConfig = (key: string, value: string) => {
    exec(db, 'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value]);
}

// X accounts

export const getXAccount = (id: number): XAccount | null => {
    const row = exec(db, 'SELECT * FROM xAccount WHERE id = ?', [id], 'get');
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
    const rows = exec(db, 'SELECT * FROM xAccount', [], 'all');

    const accounts: XAccount[] = [];
    for (const row of rows) {
        accounts.push({
            id: row.id,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
            accessedAt: new Date(row.accessedAt),
            username: row.username,
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
    const info = exec(db, 'INSERT INTO xAccount DEFAULT VALUES');
    const account = getXAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

export const saveXAccount = (account: XAccount) => {
    exec(db, `
        UPDATE xAccount
        SET
            updatedAt = CURRENT_TIMESTAMP,
            accessedAt = CURRENT_TIMESTAMP,
            username = ?,
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
    const row = exec(db, 'SELECT * FROM account WHERE id = ?', [id], 'get');
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

export async function getAccountUsername(account: Account): Promise<string | null> {
    if (account.type == "X" && account.xAccount) {
        return account.xAccount?.username;
    }

    return null;
}

export const getAccounts = (): Account[] => {
    const rows = exec(db, 'SELECT * FROM account', [], 'all');

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
    const row = exec(db, 'SELECT MAX(sortOrder) as maxSortOrder FROM account', [], 'get');
    const sortOrder = row.maxSortOrder ? row.maxSortOrder + 1 : 0;

    // Insert it
    const info = exec(db, 'INSERT INTO account (sortOrder) VALUES (?)', [sortOrder]);

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
    exec(db, `
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

    exec(db, `
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
                exec(db, 'DELETE FROM xAccount WHERE id = ?', [account.xAccount.id]);
            }
            break;
    }

    // Delete the account
    exec(db, 'DELETE FROM account WHERE id = ?', [accountID]);
}

export const defineIPCDatabase = () => {
    ipcMain.handle('database:getConfig', async (_, key) => {
        return getConfig(key);
    });

    ipcMain.handle('database:setConfig', async (_, key, value) => {
        setConfig(key, value);
    });

    ipcMain.handle('database:getAccounts', async (_) => {
        return getAccounts();
    });

    ipcMain.handle('database:createAccount', async (_) => {
        return createAccount();
    });

    ipcMain.handle('database:selectNewAccount', async (_, accountID, type) => {
        return selectNewAccount(accountID, type);
    });

    ipcMain.handle('database:saveAccount', async (_, accountJson) => {
        const account = JSON.parse(accountJson);
        return saveAccount(account);
    });

    ipcMain.handle('database:deleteAccount', async (_, accountID) => {
        const ses = session.fromPartition(`persist:account-${accountID}`);
        await ses.closeAllConnections();
        await ses.clearStorageData();
        deleteAccount(accountID);
    });
};