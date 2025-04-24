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
        return settingsPath
    }),
    getAccountSettingsPath: vi.fn((accountID: number) => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath-account_facebook');
        const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
        if (!fs.existsSync(accountSettingsPath)) {
            fs.mkdirSync(accountSettingsPath, { recursive: true });
        }
        return accountSettingsPath
    }),
    getDataPath: vi.fn(() => {
        const dataPath = path.join(__dirname, '..', 'testdata', 'dataPath-account_facebook');
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true });
        }
        return dataPath
    }),
    getAccountDataPath: vi.fn((accountType: string, accountUsername: string) => {
        const dataPath = path.join(__dirname, '..', 'testdata', 'dataPath');
        const accountDataPath = path.join(dataPath, accountType, accountUsername);
        if (!fs.existsSync(accountDataPath)) {
            fs.mkdirSync(accountDataPath, { recursive: true });
        }
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
                requestBody: '',
                responseHeaders: {},
                responseBody: fs.readFileSync(path.join(__dirname, '..', 'testdata', filename), 'utf8'),
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

test('FacebookAccountController.getStructuredGraphQLData() handles multiple objects is list post response', async () => {
    mitmController.setTestdata("FBAPIManagePosts1.json")

    const resps = await controller.getStructuredGraphQLData(mitmController.responseData[0].responseBody);
    expect(resps.length).toBe(9);
    expect(resps[0].data?.node?.__typename).toBe("User");
    expect(resps[1].label).toBe("VideoPlayerRelay_video$defer$InstreamVideoAdBreaksPlayer_video");
    expect(resps[2].label).toBe("CometFeedStoryFBReelsAttachment_story$defer$FBReelsFeedbackBar_feedback");
    expect(resps[3].label).toBe("ProfileCometTimelineFeed_user$stream$ProfileCometTimelineFeed_user_timeline_list_feed_units");
    expect(resps[4].label).toBe("ProfileCometTimelineFeed_user$stream$ProfileCometTimelineFeed_user_timeline_list_feed_units");
    expect(resps[5].label).toBe("CometFeedStoryVideoAttachmentVideoPlayer_video$defer$VideoPlayerWithVideoCardsOverlay_video");
    expect(resps[6].label).toBe("CometFeedStoryVideoAttachmentVideoPlayer_video$defer$VideoPlayerWithLiveVideoEndscreenAndChaining_video");
    expect(resps[7].label).toBe("VideoPlayerRelay_video$defer$InstreamVideoAdBreaksPlayer_video");
    expect(resps[8].label).toBe("ProfileCometTimelineFeed_user$defer$ProfileCometTimelineFeed_user_timeline_list_feed_units$page_info");
})

test('FacebookAccountController.getStructuredGraphQLData() handles manage post objects', async () => {
    mitmController.setTestdata("FBAPIManagePosts4.json")

    const resps = await controller.getStructuredGraphQLData(mitmController.responseData[0].responseBody);
    expect(resps.length).toBe(5);
    expect(resps[0].data?.user?.timeline_manage_feed_units?.edges?.[0].node.__typename).toBe("Story");
    expect(resps[1].label).toBe("ProfileCometManagePostsTimelineFeed_user$stream$CometManagePostsFeed_user_timeline_manage_feed_units");
    expect(resps[2].label).toBe("ProfileCometManagePostsTimelineFeed_user$stream$CometManagePostsFeed_user_timeline_manage_feed_units");
    expect(resps[3].label).toBe("ProfileCometManagePostsTimelineFeed_user$stream$CometManagePostsFeed_user_timeline_manage_feed_units");
    expect(resps[4].label).toBe("ProfileCometManagePostsTimelineFeed_user$defer$CometManagePostsFeed_user_timeline_manage_feed_units$page_info");
})

test('FacebookAccountController.getStructuredGraphQLData() handles one object', async () => {
    mitmController.setTestdata("FBAPIManagePosts2.json")

    const resps = await controller.getStructuredGraphQLData(mitmController.responseData[0].responseBody);
    expect(resps.length).toBe(1);
    expect(resps[0].data?.node?.__typename).toBe("User");
})

test('FacebookAccountController.savePosts() test data 4', async () => {
    mitmController.setTestdata("FBAPIManagePosts4.json")

    // Save all posts in manage posts feed
    const progress = await controller.savePosts();
    expect(progress.postsSaved).toBe(4);
})


test('FacebookAccountController.savePosts() test data 1', async () => {
    mitmController.setTestdata("FBAPIManagePosts1.json")

    // Ignore list feed posts
    const progress = await controller.savePosts();
    expect(progress.postsSaved).toBe(0);
})
