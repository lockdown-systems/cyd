import fs from 'fs';
import path from 'path';

import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { Proxy } from "http-mitm-proxy"

import {
} from './account_facebook';

// Mock the util module
vi.mock('./util', () => ({
    ...vi.importActual('./util'), // Import and spread the actual implementations
    getSettingsPath: vi.fn(() => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath-account_facebook');
        if (!fs.existsSync(settingsPath)) {
            fs.mkdirSync(settingsPath, { recursive: true });
        }
        console.log('getSettingsPath', settingsPath)
        return settingsPath
    }),
    getAccountSettingsPath: vi.fn((accountID: number) => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath-account_facebook');
        const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
        if (!fs.existsSync(accountSettingsPath)) {
            fs.mkdirSync(accountSettingsPath, { recursive: true });
        }
        console.log('getAccountSettingsPath', accountSettingsPath)
        return accountSettingsPath
    }),
    getDataPath: vi.fn(() => {
        const dataPath = path.join(__dirname, '..', 'testdata', 'dataPath-account_facebook');
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true });
        }
        console.log('getDataPath', dataPath)
        return dataPath
    }),
    getAccountDataPath: vi.fn((accountType: string, accountUsername: string) => {
        const dataPath = path.join(__dirname, '..', 'testdata', 'dataPath');
        const accountDataPath = path.join(dataPath, accountType, accountUsername);
        if (!fs.existsSync(accountDataPath)) {
            fs.mkdirSync(accountDataPath, { recursive: true });
        }
        console.log('getAccountDataPath', accountDataPath)
        return accountDataPath
    }),
}));
import { getSettingsPath, getAccountDataPath } from './util';

// Mock Electron
vi.mock('electron', () => ({
    session: {
        fromPartition: vi.fn().mockReturnValue({
            webRequest: {
                onCompleted: vi.fn(),
                onSendHeaders: vi.fn(),
            }
        })
    },
    app: {
        getPath: vi.fn().mockReturnValue(path.join(__dirname, '..', 'testdata', 'tmp'))
    }
}));

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Import the local modules after stuff has been mocked
import { Account, ResponseData } from './shared_types'
import { FacebookAccountController } from './account_facebook'
import { IMITMController } from './mitm'
import * as database from './database';

// Mock a MITMController
class MockMITMController implements IMITMController {
    public account: Account | null = null;
    private proxy: Proxy | null = null;
    private proxyPort: number = 0;
    private proxySSLCADir: string = "";
    private proxyFilter: string[] = [];
    private isMonitoring: boolean = false;
    public responseData: ResponseData[] = [];
    constructor() { }
    async startMITM(_ses: Electron.Session, _proxyFilter: string[]): Promise<boolean> { return true; }
    async stopMITM(_ses: Electron.Session) { }
    async startMonitoring() { }
    async stopMonitoring() { }
    async clearProcessed(): Promise<void> { }

    // Just used in the tests
    setTestdata(filename: string) {
        this.responseData = [
            {
                host: 'www.facebook.com',
                url: '/api/graphql/',
                status: 200,
                headers: {},
                body: fs.readFileSync(path.join(__dirname, '..', 'testdata', filename), 'utf8'),
                processed: false
            }
        ];
    }
}

let mitmController: MockMITMController;
let controller: FacebookAccountController;

beforeEach(() => {
    database.runMainMigrations();

    // Create an X account, which should have an id of 1
    let account = database.createAccount()
    account = database.selectAccountType(account.id, "Facebook");
    if (account.facebookAccount) {
        account.facebookAccount.accountID = "123456";
        account.facebookAccount.name = "Test Account";
    }
    database.saveAccount(account);

    // Create an FacebookAccountController
    mitmController = new MockMITMController();
    controller = new FacebookAccountController(account.id, mitmController);
    controller.initDB();
});

afterEach(() => {
    // Close the main database
    database.closeMainDatabase();

    // Close the account database
    if (controller) {
        controller.cleanup();
    }

    // Delete data from disk
    const settingsPath = getSettingsPath();
    const accountDataPath = getAccountDataPath("Facebook", "123456 Test Account");

    if (fs.existsSync(settingsPath)) {
        fs.rmSync(settingsPath, { recursive: true, force: true });
    }

    if (fs.existsSync(accountDataPath)) {
        fs.rmSync(accountDataPath, { recursive: true, force: true });
    }
});

// Fixtures


// FacebookAccountController tests

test('FacebookAccountController.constructor() creates a database for the user', async () => {
    mitmController.responseData = [];

    // There should be a file called data.sqlite3 in the account data directory
    const files = fs.readdirSync(getAccountDataPath("Facebook", "123456 Test Account"));
    expect(files).toContain('data.sqlite3');
})
