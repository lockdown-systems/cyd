import fs from 'fs';
import path from 'path';

import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { Proxy } from "http-mitm-proxy"

import {
    FacebookUserRow,
    FacebookStoryRow,
    FacebookAttachedStoryRow,
    FacebookMediaRow,
    FacebookShareRow,
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
    setTestdata(folder: string, requestFilename: string, responseFilename: string) {
        const requestBody = fs.readFileSync(path.join(__dirname, '..', 'testdata', 'facebook', folder, requestFilename), 'utf8');
        const responseBody = fs.readFileSync(path.join(__dirname, '..', 'testdata', 'facebook', folder, responseFilename), 'utf8');
        this.responseData = [
            {
                host: 'www.facebook.com',
                url: '/api/graphql/',
                status: 200,
                requestBody: requestBody,
                responseHeaders: {},
                responseBody: responseBody,
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

    // Mock downloadFile for tests
    controller.downloadFile = vi.fn().mockResolvedValue(true);
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

test('FacebookAccountController.parseAPIResponse() for http1', async () => {
    mitmController.setTestdata("managePosts", "http1-request.txt", "http1-response.json");
    await controller.parseAPIResponse(0);

    expect(mitmController.responseData[0].processed).toBe(true);
    
    // there should be 1 user
    const userRows: FacebookUserRow[] = database.exec(controller.db, "SELECT * FROM user", [], "all") as FacebookUserRow[];
    expect(userRows.length).toBe(1);
    expect(userRows[0].name).toBe("Chase Westbrook");

    // there should be 9 stories
    const storyRows: FacebookStoryRow[] = database.exec(controller.db, "SELECT * FROM story", [], "all") as FacebookStoryRow[];
    expect(storyRows.length).toBe(9);
    expect(storyRows[0].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjEyODIyOTYxODc1OTk0MDoxMjIxMjgyMjk2MTg3NTk5NDA=");
    expect(storyRows[0].attachedStoryID).toBe("UzpfSTEwMDA0NDE3Nzg3MjM0MzoxMjI0NTgyMzQ5MDI0MzQ5OjEyMjQ1ODIzNDkwMjQzNDk=");
    expect(storyRows[1].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMzg5NTU1ODc1OTk0MDoxMjIxMTM4OTU1NTg3NTk5NDA=");
    expect(storyRows[2].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMzg5NTE3NDc1OTk0MDoxMjIxMTM4OTUxNzQ3NTk5NDA=");
    expect(storyRows[3].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMzg5NDgzMjc1OTk0MDoxMjIxMTM4OTQ4MzI3NTk5NDA=");
    expect(storyRows[3].attachedStoryID).toBe("UzpfSTEwMDAxNTY0MDgzOTU5MjpWSzoxNjgyMTUwNTc2MDM0Nzkw");
    expect(storyRows[4].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMjgzNjY3Mjc1OTk0MDoxMjIxMTI4MzY2NzI3NTk5NDA=");
    expect(storyRows[5].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMjgzNjQzMjc1OTk0MDoxMjIxMTI4MzY0MzI3NTk5NDA=");
    expect(storyRows[6].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjEwNjMyOTM3Mjc1OTk0MDoxMjIxMDYzMjkzNzI3NTk5NDA=");
    expect(storyRows[7].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjEwNjMxOTk2NDc1OTk0MDoxMjIxMDYzMTk5NjQ3NTk5NDA=");
    expect(storyRows[8].storyID).toBe("UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjEwNjMxOTgyNjc1OTk0MDoxMjIxMDYzMTk4MjY3NTk5NDA=");

    // there should be 2 attached stories
    const attachedStoryRows: FacebookAttachedStoryRow[] = database.exec(controller.db, "SELECT * FROM attached_story", [], "all") as FacebookAttachedStoryRow[];
    expect(attachedStoryRows.length).toBe(2);
    expect(attachedStoryRows[0].storyID).toBe("UzpfSTEwMDA0NDE3Nzg3MjM0MzoxMjI0NTgyMzQ5MDI0MzQ5OjEyMjQ1ODIzNDkwMjQzNDk=");
    expect(attachedStoryRows[1].storyID).toBe("UzpfSTEwMDAxNTY0MDgzOTU5MjpWSzoxNjgyMTUwNTc2MDM0Nzkw");

    // count media for each story
    interface ExtendedFacebookMediaRow extends FacebookMediaRow {
        story_id: string;
    }
    const storySQL = "SELECT media.*, media_story.storyID AS storyID FROM media LEFT JOIN media_story ON media.mediaID = media_story.mediaID WHERE media_story.storyID = ?";
    const attachedStorySQL = "SELECT media.*, media_attached_story.storyID AS storyID FROM media LEFT JOIN media_attached_story ON media.mediaID = media_attached_story.mediaID WHERE media_attached_story.storyID = ?";

    // this story should have 3 media
    let storyID = "UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMzg5NTU1ODc1OTk0MDoxMjIxMTM4OTU1NTg3NTk5NDA=";
    let mediaRows: ExtendedFacebookMediaRow[] = database.exec(controller.db, storySQL, [storyID], "all") as ExtendedFacebookMediaRow[];
    expect(mediaRows.length).toBe(3);
    expect(mediaRows[0].mediaID).toBe("122113895354759940");
    expect(mediaRows[1].mediaID).toBe("122113895486759940");
    expect(mediaRows[2].mediaID).toBe("122113895450759940");

    // this story should have 1 media
    storyID = "UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMzg5NTE3NDc1OTk0MDoxMjIxMTM4OTUxNzQ3NTk5NDA=";
    mediaRows = database.exec(controller.db, storySQL, [storyID], "all") as ExtendedFacebookMediaRow[];
    expect(mediaRows.length).toBe(1);
    expect(mediaRows[0].mediaID).toBe("3300235805004000402");

    // this attached story should have 1 media
    storyID = "UzpfSTEwMDAxNTY0MDgzOTU5MjpWSzoxNjgyMTUwNTc2MDM0Nzkw";
    mediaRows = database.exec(controller.db, attachedStorySQL, [storyID], "all") as ExtendedFacebookMediaRow[];
    expect(mediaRows.length).toBe(1);
    expect(mediaRows[0].mediaID).toBe("1927569387774404");

    // this story should have 1 media (video)
    storyID = "UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMjgzNjY3Mjc1OTk0MDoxMjIxMTI4MzY2NzI3NTk5NDA=";
    mediaRows = database.exec(controller.db, storySQL, [storyID], "all") as ExtendedFacebookMediaRow[];
    expect(mediaRows.length).toBe(1);
    expect(mediaRows[0].mediaType).toBe("Video");
    expect(mediaRows[0].mediaID).toBe("971815314581705");

    // this story should have 1 media (a shared link)
    storyID = "UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjExMjgzNjQzMjc1OTk0MDoxMjIxMTI4MzY0MzI3NTk5NDA=";
    mediaRows = database.exec(controller.db, storySQL, [storyID], "all") as ExtendedFacebookMediaRow[];
    expect(mediaRows.length).toBe(1);
    expect(mediaRows[0].mediaID).toBe("122112836426759940");
    expect(mediaRows[0].title).toBe("JojaMart - Stardew Valley Wiki");

    // this attached story should have 1 media (a shared link)
    storyID = "UzpfSTYxNTcyNzk4MjI3MDE4OjEyMjEwNjMyOTM3Mjc1OTk0MDoxMjIxMDYzMjkzNzI3NTk5NDA=";
    mediaRows = database.exec(controller.db, storySQL, [storyID], "all") as ExtendedFacebookMediaRow[];
    expect(mediaRows.length).toBe(1);
    expect(mediaRows[0].mediaID).toBe("122106329366759940");

    // there should be 3 shares
    const shareRows: FacebookShareRow[] = database.exec(controller.db, "SELECT * FROM share", [], "all") as FacebookShareRow[];
    expect(shareRows.length).toBe(3);
    expect(shareRows[0].mediaID).toBe("3300235805004000402");
    expect(shareRows[0].url).toBe("https://www.facebook.com/reel/1381478619505412/");
    expect(shareRows[1].mediaID).toBe("122112836426759940");
    expect(shareRows[1].title).toBe("JojaMart - Stardew Valley Wiki");
    expect(shareRows[1].url).toBe("https://stardewvalleywiki.com/JojaMart");
    expect(shareRows[2].mediaID).toBe("122106329366759940");
    // TODO: share URLs are not extracted yet
    //expect(shareRows[2].url).toBe("https://www.themarysue.com/new-television-shows-streaming-february-2025/");
})
