import fs from 'fs';
import path from 'path';

import { beforeEach, afterEach, test, expect, vi } from 'vitest';

// Mock the helpers module
vi.mock('./util', () => ({
    ...vi.importActual('./util'), // Import and spread the actual implementations
    getSettingsPath: vi.fn(() => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath-database');
        if (!fs.existsSync(settingsPath)) {
            fs.mkdirSync(settingsPath, { recursive: true });
        }
        return settingsPath
    }),
}));
import { getSettingsPath } from './util';

// Import the local modules after stuff has been mocked
// import { Account, XAccount } from './shared_types'
import * as database from './database';

beforeEach(() => {
    // Make sure we open the database
    database.getMainDatabase();
    database.runMainMigrations();
});

afterEach(() => {
    // Make sure we close the database and clean up
    database.closeMainDatabase();
    fs.readdirSync(getSettingsPath()).forEach(file => {
        fs.unlinkSync(path.join(getSettingsPath(), file));
    });
});

// database tests

test("config, account, and xAccount tables should be created", async () => {
    const db = database.getMainDatabase();
    const tables = await database.exec(
        db,
        "SELECT name FROM sqlite_master WHERE type='table';",
        [],
        "all"
    );
    expect(tables).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'config' }),
        expect.objectContaining({ name: 'account' }),
        expect.objectContaining({ name: 'xAccount' }),
    ]));
})

test("setConfig should insert a new config value", () => {
    const key = 'testKey';
    const value = 'testValue';

    database.setConfig(key, value);

    const db = database.getMainDatabase();
    const result = database.exec(db, 'SELECT value FROM config WHERE key = ?', [key], 'get');
    expect(result).toEqual({ value });
});

test("getConfig should retrieve the correct config value", () => {
    const key = 'testKey';
    const value = 'testValue';

    database.setConfig(key, value);
    const retrievedValue = database.getConfig(key);

    expect(retrievedValue).toBe(value);
});

test("getConfig should return null for a non-existent key", () => {
    const key = 'nonExistentKey';
    const retrievedValue = database.getConfig(key);

    expect(retrievedValue).toBeNull();
});

test("createXAccount should create a new XAccount", () => {
    const xAccount = database.createXAccount();
    expect(xAccount).toHaveProperty('id');
    expect(xAccount).toHaveProperty('createdAt');
    expect(xAccount).toHaveProperty('updatedAt');
    expect(xAccount).toHaveProperty('accessedAt');
    expect(xAccount).toHaveProperty('username');
    expect(xAccount).toHaveProperty('profileImageDataURI');
    expect(xAccount).toHaveProperty('archiveTweets');
    expect(xAccount).toHaveProperty('archiveDMs');
    expect(xAccount).toHaveProperty('deleteTweets');
    expect(xAccount).toHaveProperty('deleteTweetsDaysOld');
    expect(xAccount).toHaveProperty('deleteTweetsLikesThresholdEnabled');
    expect(xAccount).toHaveProperty('deleteTweetsLikesThreshold');
    expect(xAccount).toHaveProperty('deleteTweetsRetweetsThresholdEnabled');
    expect(xAccount).toHaveProperty('deleteTweetsRetweetsThreshold');
    expect(xAccount).toHaveProperty('deleteRetweets');
    expect(xAccount).toHaveProperty('deleteRetweetsDaysOld');
    expect(xAccount).toHaveProperty('deleteLikes');
    expect(xAccount).toHaveProperty('deleteLikesDaysOld');
    expect(xAccount).toHaveProperty('deleteDMs');
});

test("saveXAccount should update an existing XAccount", () => {
    const xAccount = database.createXAccount();
    xAccount.username = 'newUsername';
    database.saveXAccount(xAccount);

    const db = database.getMainDatabase();
    const result = database.exec(db, 'SELECT * FROM xAccount WHERE id = ?', [xAccount.id], 'get');
    expect(result).toEqual(expect.objectContaining({ username: 'newUsername' }));
});

test("getXAccount should retrieve the correct XAccount", () => {
    const xAccount = database.createXAccount();
    database.saveXAccount(xAccount);

    const retrievedAccount = database.getXAccount(xAccount.id);
    expect(retrievedAccount).toEqual(xAccount);
});

test("getXAccounts should retrieve all XAccounts", () => {
    const xAccount1 = database.createXAccount();
    const xAccount2 = database.createXAccount();
    database.saveXAccount(xAccount1);
    database.saveXAccount(xAccount2);

    const accounts = database.getXAccounts();
    expect(accounts).toEqual(expect.arrayContaining([xAccount1, xAccount2]));
});

test("createAccount should create a new Account", () => {
    const account = database.createAccount();
    expect(account).toHaveProperty('id');
    expect(account).toHaveProperty('type');
    expect(account).toHaveProperty('sortOrder');
    expect(account).toHaveProperty('xAccount');
    expect(account).toHaveProperty('uuid');
});

test("selectAccountType should set the account type and create a new xAccount", () => {
    const account = database.createAccount();
    const updatedAccount = database.selectAccountType(account.id, 'X');
    expect(updatedAccount.type).toBe('X');
    expect(updatedAccount.xAccount).not.toBeNull();
});

test("saveAccount should update an existing Account", () => {
    const account = database.createAccount();
    account.type = 'X';
    database.saveAccount(account);

    const db = database.getMainDatabase();
    const result = database.exec(db, 'SELECT * FROM account WHERE id = ?', [account.id], 'get');
    expect(result).toEqual(expect.objectContaining({ type: 'X' }));
});

test("getAccount should retrieve the correct Account", () => {
    const account = database.createAccount();
    database.saveAccount(account);

    const retrievedAccount = database.getAccount(account.id);
    expect(retrievedAccount).toEqual(account);
});

test("getAccounts should retrieve all Accounts", () => {
    const account1 = database.createAccount();
    const account2 = database.createAccount();
    database.saveAccount(account1);
    database.saveAccount(account2);

    const accounts = database.getAccounts();
    expect(accounts).toEqual(expect.arrayContaining([account1, account2]));
});

test("deleteAccount should delete the specified Account", () => {
    const account = database.createAccount();
    database.saveAccount(account);
    database.deleteAccount(account.id);

    const db = database.getMainDatabase();
    const result = database.exec(db, 'SELECT * FROM account WHERE id = ?', [account.id], 'get');
    expect(result).toBeUndefined();
});

test("getAccountUsername should retrieve the correct username", async () => {
    let account = database.createAccount();
    account = database.selectAccountType(account.id, 'X');
    expect(account.xAccount).not.toBeNull();
    if (account.xAccount) {
        account.xAccount.username = 'testUsername';
    }
    database.saveAccount(account);

    const username = await database.getAccountUsername(account);
    expect(username).toBe('testUsername');
});

test("create, delete, and verify accounts", () => {
    // Step 1: Create 3 accounts and select X as the type for each of them
    let account1 = database.createAccount();
    account1 = database.selectAccountType(account1.id, 'X');
    let account2 = database.createAccount();
    account2 = database.selectAccountType(account2.id, 'X');
    let account3 = database.createAccount();
    account3 = database.selectAccountType(account3.id, 'X');

    // Step 2: Check that their database IDs are 1, 2, and 3
    expect(account1.id).toBe(1);
    expect(account2.id).toBe(2);
    expect(account3.id).toBe(3);

    // Step 3: Delete the account with ID 2
    database.deleteAccount(2);

    // Step 4: Ensure that the database only has accounts with IDs 1 and 3
    let accounts = database.getAccounts();
    let accountIds = accounts.map(account => account.id);
    expect(accountIds).toEqual(expect.arrayContaining([1, 3]));
    expect(accountIds).not.toContain(2);

    // Step 5: Create another account and select X type
    const account4 = database.createAccount();
    database.selectAccountType(account4.id, 'X');

    // Step 6: Ensure that the database has accounts with IDs 1, 3, and 4
    accounts = database.getAccounts();
    accountIds = accounts.map(account => account.id);
    expect(accountIds).toEqual(expect.arrayContaining([1, 3, 4]));
});
