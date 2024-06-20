import path from "path"
import { app } from 'electron'
import Database from 'better-sqlite3'

import run from './migrations'

const dbPath = `${path.join(app.getPath('userData'), 'db.sqlite')}`;

export const db = new Database(dbPath, {});
db.pragma('journal_mode = WAL');

export const runMigrations = () => {
    run(db)
}

export const getConfig = (key: string): string | null => {
    const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
    const row = stmt.get(key);
    return row ? row.value : null;
}

export const setConfig = (key: string, value: string) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    stmt.run(key, value);
}

export const getXAccount = (id: number): XAccount | null => {
    const stmt = db.prepare('SELECT * FROM xAccount WHERE id = ?');
    const row = stmt.get(id);
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
    const stmt = db.prepare('SELECT * FROM xAccount');
    const rows = stmt.all();

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
    const stmt = db.prepare('INSERT INTO xAccount DEFAULT VALUES');
    const info = stmt.run();
    const account = getXAccount(info.lastInsertRowid);
    if (!account) {
        throw new Error("Failed to create account");
    }
    return account;
}

export const saveXAccount = (account: XAccount) => {
    const stmt = db.prepare(`
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
    `);
    stmt.run(
        account.username,
        account.deleteTweets,
        account.tweetsDaysThreshold,
        account.tweetsEnableRetweetThreshold,
        account.tweetsLikeThreshold,
        account.deleteLikes,
        account.likesDaysThreshold,
        account.deleteDirectMessages,
        account.directMessageDaysThreshold,
        account.id
    );
}