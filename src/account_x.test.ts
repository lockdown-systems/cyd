import fs from 'fs';
import path from 'path';

import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { Proxy } from "http-mitm-proxy"

// Mock the helpers module
vi.mock('./helpers', () => ({
    ...vi.importActual('./helpers'), // Import and spread the actual implementations
    getSettingsPath: vi.fn(() => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath');
        if (!fs.existsSync(settingsPath)) {
            fs.mkdirSync(settingsPath, { recursive: true });
        }
        return settingsPath
    }),
    getAccountSettingsPath: vi.fn((accountID: number) => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath');
        const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
        if (!fs.existsSync(accountSettingsPath)) {
            fs.mkdirSync(accountSettingsPath, { recursive: true });
        }
        return accountSettingsPath
    }),
    getDataPath: vi.fn(() => {
        const dataPath = path.join(__dirname, '..', 'testdata', 'dataPath');
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
import { getSettingsPath, getAccountDataPath } from './helpers';

// Import the local modules after helpers has been mocked
import { Account, ResponseData } from './shared_types'
import { XAccountController } from './account_x'
import { IMITMController } from './mitm_proxy'
import { runMainMigrations, createAccount, selectNewAccount, saveAccount } from './database';

// Mock a MITMController
class MockMITMController implements IMITMController {
    private account: Account | null;
    private proxy: Proxy | null;
    private proxyPort: number;
    private proxySSLCADir: string;
    private proxyFilter: string[];
    private isMonitoring: boolean;
    public responseData: ResponseData[];
    constructor() {
        // Load test data
        this.responseData = [
            {
                host: 'x.com',
                url: '/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?variables=%7B%22userId%22%3A%221769426369526771712%22%2C%22count%22%3A20%2C%22cursor%22%3A%22DAABCgABGS0y9T___-0KAAIYtaJOPpth7ggAAwAAAAIAAA%22%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D',
                status: 200,
                headers: {},
                body: fs.readFileSync(path.join(__dirname, '..', 'testdata', 'XAPIUserTweetsAndReplies1.json'), 'utf8'),
                processed: false
            }
        ];
    }
    async startMITM(_ses: Electron.Session, _proxyFilter: string[]) { }
    async stopMITM(_ses: Electron.Session) { }
    async startMonitoring() { }
    async stopMonitoring() { }
}

beforeEach(() => {
    runMainMigrations();

    // Create an X account, which should have an id of 1
    let account = createAccount()
    account = selectNewAccount(account.id, "X");
    if (account.xAccount) {
        account.xAccount.username = "test";
    }
    saveAccount(account);
});

afterEach(() => {
    fs.readdirSync(getSettingsPath()).forEach(file => {
        fs.unlinkSync(path.join(getSettingsPath(), file));
    });
    fs.readdirSync(getAccountDataPath("X", "test")).forEach(file => {
        fs.unlinkSync(path.join(getAccountDataPath("X", "test"), file));
    });
});

// XAccountController tests

test('XAccountController.constructor() creates a database for the user', async () => {
    const mitmController = new MockMITMController();
    const _controller = new XAccountController(1, mitmController);

    // There should be a file called data.sqlite3 in the account data directory
    const files = fs.readdirSync(getAccountDataPath("X", "test"));
    expect(files).toContain('data.sqlite3');
})
