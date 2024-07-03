import path from "path"
import { app } from 'electron'
import Database from 'better-sqlite3'

import { Account, XAccount } from './shared_types'
import run from './migrations'

const dbPath = `${path.join(app.getPath('userData'), 'db.sqlite')}`;

export const db = new Database(dbPath, {});
db.pragma('journal_mode = WAL');

export const runMigrations = async () => {
    await run(db)
}

// Helpers

function exec(sql: string, params: Array<number | string | bigint | Buffer | null> = [], cmd: 'run' | 'all' | 'get' = 'run') {
    console.log("Executing SQL:", sql, "Params:", params);
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
        deleteTweets: !!row.deleteTweets,
        tweetsDaysThreshold: row.tweetsDaysThreshold,
        tweetsEnableRetweetThreshold: !!row.tweetsEnableRetweetThreshold,
        tweetsLikeThreshold: row.tweetsLikeThreshold,
        deleteLikes: !!row.deleteLikes,
        likesDaysThreshold: row.likesDaysThreshold,
        deleteDirectMessages: !!row.deleteDirectMessages,
        directMessageDaysThreshold: row.directMessageDaysThreshold,
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
            deleteTweets: !!row.deleteTweets,
            tweetsDaysThreshold: row.tweetsDaysThreshold,
            tweetsEnableRetweetThreshold: !!row.tweetsEnableRetweetThreshold,
            tweetsLikeThreshold: row.tweetsLikeThreshold,
            deleteLikes: !!row.deleteLikes,
            likesDaysThreshold: row.likesDaysThreshold,
            deleteDirectMessages: !!row.deleteDirectMessages,
            directMessageDaysThreshold: row.directMessageDaysThreshold,
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
            deleteTweets = ?,
            tweetsDaysThreshold = ?,
            tweetsEnableRetweetThreshold = ?,
            tweetsLikeThreshold = ?,
            deleteLikes = ?,
            likesDaysThreshold = ?,
            deleteDirectMessages = ?,
            directMessageDaysThreshold = ?
        WHERE id = ?
    `, [
        account.username,
        account.deleteTweets ? 1 : 0,
        account.tweetsDaysThreshold,
        account.tweetsEnableRetweetThreshold ? 1 : 0,
        account.tweetsLikeThreshold,
        account.deleteLikes ? 1 : 0,
        account.likesDaysThreshold,
        account.deleteDirectMessages ? 1 : 0,
        account.directMessageDaysThreshold,
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