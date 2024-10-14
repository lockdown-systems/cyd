import fs from 'fs';
import path from 'path';

import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import { Proxy } from "http-mitm-proxy"

import { XAPILegacyUser, XAPILegacyTweet, XAPIConversation, XAPIUser } from './account_x_types';
import { XTweetRow, XUserRow, XConversationRow, XConversationParticipantRow, XMessageRow } from './account_x';

// Mock the util module
vi.mock('./util', () => ({
    ...vi.importActual('./util'), // Import and spread the actual implementations
    getSettingsPath: vi.fn(() => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath-account_x');
        if (!fs.existsSync(settingsPath)) {
            fs.mkdirSync(settingsPath, { recursive: true });
        }
        return settingsPath
    }),
    getAccountSettingsPath: vi.fn((accountID: number) => {
        const settingsPath = path.join(__dirname, '..', 'testdata', 'settingsPath-account_x');
        const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
        if (!fs.existsSync(accountSettingsPath)) {
            fs.mkdirSync(accountSettingsPath, { recursive: true });
        }
        return accountSettingsPath
    }),
    getDataPath: vi.fn(() => {
        const dataPath = path.join(__dirname, '..', 'testdata', 'dataPath-account_x');
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

// Mock the session object from Electron
vi.mock('electron', () => ({
    session: {
        fromPartition: vi.fn().mockReturnValue({
            webRequest: {
                onCompleted: vi.fn()
            }
        })
    }
}));

// Import the local modules after stuff has been mocked
import { Account, ResponseData, XProgress } from './shared_types'
import { XAccountController } from './account_x'
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
    constructor(testdata: string | undefined) {
        if (testdata == "indexTweets") {
            this.responseData = [
                {
                    host: 'x.com',
                    url: '/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?variables=%7B%22userId%22%3A%221769426369526771712%22%2C%22count%22%3A20%2C%22cursor%22%3A%22DAABCgABGS0y9T___-0KAAIYtaJOPpth7ggAAwAAAAIAAA%22%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D',
                    status: 200,
                    headers: {},
                    body: fs.readFileSync(path.join(__dirname, '..', 'testdata', 'XAPIUserTweetsAndReplies1.json'), 'utf8'),
                    processed: false
                },
                {
                    host: 'x.com',
                    url: '/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?variables=%7B%22userId%22%3A%221769426369526771712%22%2C%22count%22%3A20%2C%22cursor%22%3A%22DAABCgABGS0y9T___-0KAAIYtaJOPpth7ggAAwAAAAIAAA%22%2C%22includePromotedContent%22%3Atrue%2C%22withCommunity%22%3Atrue%2C%22withVoice%22%3Atrue%2C%22withV2Timeline%22%3Atrue%7D&features=%7B%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22communities_web_enable_tweet_community_results_fetch%22%3Atrue%2C%22c9s_tweet_anatomy_moderator_badge_enabled%22%3Atrue%2C%22articles_preview_enabled%22%3Atrue%2C%22tweetypie_unmention_optimization_enabled%22%3Atrue%2C%22responsive_web_edit_tweet_api_enabled%22%3Atrue%2C%22graphql_is_translatable_rweb_tweet_is_translatable_enabled%22%3Atrue%2C%22view_counts_everywhere_api_enabled%22%3Atrue%2C%22longform_notetweets_consumption_enabled%22%3Atrue%2C%22responsive_web_twitter_article_tweet_consumption_enabled%22%3Atrue%2C%22tweet_awards_web_tipping_enabled%22%3Afalse%2C%22creator_subscriptions_quote_tweet_preview_enabled%22%3Afalse%2C%22freedom_of_speech_not_reach_fetch_enabled%22%3Atrue%2C%22standardized_nudges_misinfo%22%3Atrue%2C%22tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled%22%3Atrue%2C%22rweb_video_timestamps_enabled%22%3Atrue%2C%22longform_notetweets_rich_text_read_enabled%22%3Atrue%2C%22longform_notetweets_inline_media_enabled%22%3Atrue%2C%22responsive_web_enhance_cards_enabled%22%3Afalse%7D&fieldToggles=%7B%22withArticlePlainText%22%3Afalse%7D',
                    status: 200,
                    headers: {},
                    body: fs.readFileSync(path.join(__dirname, '..', 'testdata', 'XAPIUserTweetsAndReplies2.json'), 'utf8'),
                    processed: false
                }
            ];
        }

        if (testdata == "indexDMs") {
            this.responseData = [
                {
                    host: 'x.com',
                    url: '/i/api/1.1/dm/inbox_timeline/trusted.json?filter_low_quality=false&include_quality=all&max_id=1737890608109486086&nsfw_filtering_enabled=false&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_ext_edit_control=true&ext=mediaColor%2CaltText%2CbusinessAffiliationsLabel%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle',
                    status: 200,
                    headers: {},
                    body: fs.readFileSync(path.join(__dirname, '..', 'testdata', 'XAPIDMInboxTimeline1.json'), 'utf8'),
                    processed: false
                },
                {
                    host: 'x.com',
                    url: '/i/api/1.1/dm/inbox_initial_state.json?nsfw_filtering_enabled=false&filter_low_quality=false&include_quality=all&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=true&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_ext_edit_control=true&include_ext_business_affiliations_label=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle',
                    status: 200,
                    headers: {},
                    body: fs.readFileSync(path.join(__dirname, '..', 'testdata', 'XAPIDMInitialInboxState.json'), 'utf8'),
                    processed: false
                },
                {
                    host: 'x.com',
                    url: '/i/api/1.1/dm/conversation/96752784-1209344563589992448.json?context=FETCH_DM_CONVERSATION&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_conversation_info=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle',
                    status: 200,
                    headers: {},
                    body: fs.readFileSync(path.join(__dirname, '..', 'testdata', 'XAPIDMConversation1.json'), 'utf8'),
                    processed: false
                },
                {
                    host: 'x.com',
                    url: '/i/api/1.1/dm/conversation/96752784-1209344563589992448.json?context=FETCH_DM_CONVERSATION&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_conversation_info=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle',
                    status: 200,
                    headers: {},
                    body: fs.readFileSync(path.join(__dirname, '..', 'testdata', 'XAPIDMConversation2.json'), 'utf8'),
                    processed: false
                },
            ];
        }
    }
    async startMITM(_ses: Electron.Session, _proxyFilter: string[]) { }
    async stopMITM(_ses: Electron.Session) { }
    async startMonitoring() { }
    async stopMonitoring() { }
    async clearProcessed(): Promise<void> { }
}

const createController = (testdata: string | undefined): XAccountController => {
    const mitmController = new MockMITMController(testdata);
    const controller = new XAccountController(1, mitmController);
    controller.initDB()
    return controller;
}


beforeEach(() => {
    database.runMainMigrations();

    // Create an X account, which should have an id of 1
    let account = database.createAccount()
    account = database.selectAccountType(account.id, "X");
    if (account.xAccount) {
        account.xAccount.username = "test";
    }
    database.saveAccount(account);
});

afterEach(() => {
    fs.readdirSync(getSettingsPath()).forEach(file => {
        fs.unlinkSync(path.join(getSettingsPath(), file));
    });
    fs.readdirSync(getAccountDataPath("X", "test")).forEach(file => {
        fs.unlinkSync(path.join(getAccountDataPath("X", "test"), file));
    });
});

// Fixtures

const userLegacy: XAPILegacyUser = {
    "can_dm": true,
    "can_media_tag": true,
    "created_at": "Sun Mar 17 18:12:01 +0000 2024",
    "default_profile": true,
    "default_profile_image": false,
    "description": "shaping the future of intellect, blending advanced cognition with seamless digital integration for transformative insights",
    "entities": {
        "description": {
            "urls": []
        }
    },
    "fast_followers_count": 0,
    "favourites_count": 231,
    "followers_count": 43,
    "friends_count": 10,
    "has_custom_timelines": false,
    "is_translator": false,
    "listed_count": 0,
    "location": "",
    "media_count": 0,
    "name": "nexamind",
    "needs_phone_verification": false,
    "normal_followers_count": 43,
    "pinned_tweet_ids_str": [],
    "possibly_sensitive": false,
    "profile_banner_url": "https://pbs.twimg.com/profile_banners/1769426369526771712/1710699161",
    "profile_image_url_https": "https://pbs.twimg.com/profile_images/1769426514288971776/IiR3Z_q__normal.jpg",
    "profile_interstitial_type": "",
    "screen_name": "nexamind91325",
    "statuses_count": 788,
    "translator_type": "none",
    "verified": false,
    "want_retweets": false,
    "withheld_in_countries": []
};
const tweetLegacy: XAPILegacyTweet = {
    "bookmark_count": 0,
    "bookmarked": false,
    "created_at": "Wed Apr 17 17:36:00 +0000 2024",
    "conversation_id_str": "1780630805603385729",
    "display_text_range": [
        14,
        54
    ],
    "entities": {
        "hashtags": [],
        "symbols": [],
        "timestamps": [],
        "urls": [],
        "user_mentions": [
            {
                "id_str": "1769419140908150784",
                "name": "echopulse",
                "screen_name": "echo_pulse__",
                "indices": [
                    0,
                    13
                ]
            }
        ]
    },
    "favorite_count": 0,
    "favorited": false,
    "full_text": "@echo_pulse__ Pioneering the intellect of the next era",
    "in_reply_to_screen_name": "echo_pulse__",
    "in_reply_to_status_id_str": "1780630805603385729",
    "in_reply_to_user_id_str": "1769419140908150784",
    "is_quote_status": false,
    "lang": "en",
    "quote_count": 0,
    "reply_count": 0,
    "retweet_count": 0,
    "retweeted": false,
    "user_id_str": "1769426369526771712",
    "id_str": "1780651436629750204"
};
const dmUser1: XAPIUser = {
    "id": 1209344563589992448,
    "id_str": "1209344563589992448",
    "name": "Semiphemeral",
    "screen_name": "semiphemeral",
    "location": null,
    "description": "Claw back your data from Big Tech",
    "url": "https://t.co/j0oVFIXVVe",
    "entities": {
        "url": {
            "urls": [
                {
                    "url": "https://t.co/j0oVFIXVVe",
                    "expanded_url": "https://semiphemeral.com",
                    "display_url": "semiphemeral.com",
                    "indices": [
                        0,
                        23
                    ]
                }
            ]
        },
        "description": {
            "urls": []
        }
    },
    "protected": false,
    "followers_count": 30615,
    "friends_count": 1,
    "listed_count": 62,
    "created_at": "Tue Dec 24 05:26:49 +0000 2019",
    "favourites_count": 14,
    "utc_offset": null,
    "time_zone": null,
    "geo_enabled": false,
    "verified": false,
    "statuses_count": 5,
    "lang": null,
    "contributors_enabled": false,
    "is_translator": false,
    "is_translation_enabled": false,
    "profile_background_color": "F5F8FA",
    "profile_background_image_url": null,
    "profile_background_image_url_https": null,
    "profile_background_tile": false,
    "profile_image_url": "http://pbs.twimg.com/profile_images/1221505863631769601/cfFGJZzY_normal.jpg",
    "profile_image_url_https": "https://pbs.twimg.com/profile_images/1221505863631769601/cfFGJZzY_normal.jpg",
    "profile_banner_url": "https://pbs.twimg.com/profile_banners/1209344563589992448/1690903715",
    "profile_link_color": "1DA1F2",
    "profile_sidebar_border_color": "C0DEED",
    "profile_sidebar_fill_color": "DDEEF6",
    "profile_text_color": "333333",
    "profile_use_background_image": true,
    "default_profile": true,
    "default_profile_image": false,
    "can_dm": null,
    "can_secret_dm": null,
    "can_media_tag": false,
    "following": false,
    "follow_request_sent": false,
    "notifications": false,
    "blocking": false,
    "subscribed_by": false,
    "blocked_by": false,
    "want_retweets": false,
    "business_profile_state": "none",
    "translator_type": "none",
    "withheld_in_countries": [],
    "followed_by": false
};
const dmUser2: XAPIUser = {
    "id": 1700151216,
    "id_str": "1700151216",
    "name": "yakhoda",
    "screen_name": "yakhoda498",
    "location": null,
    "description": null,
    "url": null,
    "entities": {
        "description": {
            "urls": []
        }
    },
    "protected": false,
    "followers_count": 136,
    "friends_count": 171,
    "listed_count": 0,
    "created_at": "Sun Aug 25 21:11:52 +0000 2013",
    "favourites_count": 2657,
    "utc_offset": null,
    "time_zone": null,
    "geo_enabled": true,
    "verified": false,
    "statuses_count": 2935,
    "lang": null,
    "contributors_enabled": false,
    "is_translator": false,
    "is_translation_enabled": false,
    "profile_background_color": "C0DEED",
    "profile_background_image_url": "http://abs.twimg.com/images/themes/theme1/bg.png",
    "profile_background_image_url_https": "https://abs.twimg.com/images/themes/theme1/bg.png",
    "profile_background_tile": false,
    "profile_image_url": "http://pbs.twimg.com/profile_images/1801186042315194368/exOSSVRx_normal.jpg",
    "profile_image_url_https": "https://pbs.twimg.com/profile_images/1801186042315194368/exOSSVRx_normal.jpg",
    "profile_banner_url": "https://pbs.twimg.com/profile_banners/1700151216/1718270871",
    "profile_link_color": "1DA1F2",
    "profile_sidebar_border_color": "C0DEED",
    "profile_sidebar_fill_color": "DDEEF6",
    "profile_text_color": "333333",
    "profile_use_background_image": true,
    "default_profile": true,
    "default_profile_image": false,
    "can_dm": null,
    "can_secret_dm": null,
    "can_media_tag": true,
    "following": false,
    "follow_request_sent": false,
    "notifications": false,
    "blocking": false,
    "subscribed_by": false,
    "blocked_by": false,
    "want_retweets": false,
    "business_profile_state": "none",
    "translator_type": "regular",
    "withheld_in_countries": [],
    "followed_by": false
};
const dmConversation: XAPIConversation = {
    "conversation_id": "1700151216-1209344563589992448",
    "type": "ONE_TO_ONE",
    "sort_event_id": "1700911936349602141",
    "sort_timestamp": "1694363981698",
    "participants": [
        {
            "user_id": "1700151216",
            "last_read_event_id": "1700911936349602141"
        },
        {
            "user_id": "1209344563589992448",
            "last_read_event_id": "1540971592154497032"
        }
    ],
    "nsfw": false,
    "notifications_disabled": false,
    "mention_notifications_disabled": false,
    "last_read_event_id": "1540971592154497032",
    "read_only": false,
    "trusted": true,
    "muted": false,
    "status": "AT_END",
    "min_entry_id": "1540971592154497032",
    "max_entry_id": "1700911936349602141"
};

// XAccountController tests

test('XAccountController.constructor() creates a database for the user', async () => {
    createController("indexTweets")

    // There should be a file called data.sqlite3 in the account data directory
    const files = fs.readdirSync(getAccountDataPath("X", "test"));
    expect(files).toContain('data.sqlite3');
})

test('XAccountController.indexTweet() should add a tweet', async () => {
    const controller = createController("indexTweets");

    controller.indexTweet(0, userLegacy, tweetLegacy, false)
    const rows: XTweetRow[] = database.exec(controller.db, "SELECT * FROM tweet", [], "all") as XTweetRow[];
    expect(rows.length).toBe(1);
    expect(rows[0].text).toBe(tweetLegacy.full_text);
})

test("XAccountController.indexTweet() should not add a tweet if it's already there", async () => {
    const controller = createController("indexTweets");

    let ret = controller.indexTweet(0, userLegacy, tweetLegacy, false)
    expect(ret).toBe(true);
    const rows: XTweetRow[] = database.exec(controller.db, "SELECT * FROM tweet", [], "all") as XTweetRow[];
    expect(rows.length).toBe(1);

    ret = controller.indexTweet(0, userLegacy, tweetLegacy, false)
    expect(ret).toBe(false);
    const rows2: XTweetRow[] = database.exec(controller.db, "SELECT * FROM tweet", [], "all") as XTweetRow[];
    expect(rows2.length).toBe(1);
})

test("XAccountController.indexParsedTweets() should add all the test tweets", async () => {
    const controller = createController("indexTweets");
    if (controller.account && controller.account) {
        controller.account.username = 'nexamind91325';
    }

    const progress: XProgress = await controller.indexParseTweets(false)
    expect(progress.likesIndexed).toBe(2);
    expect(progress.tweetsIndexed).toBe(22);
    expect(progress.retweetsIndexed).toBe(5);

    const rows: XTweetRow[] = database.exec(controller.db, "SELECT * FROM tweet", [], "all") as XTweetRow[];
    expect(rows.length).toBe(44);
})

test('XAccountController.indexUser() should add a user', async () => {
    const controller = createController("indexDMs");

    await controller.indexUser(dmUser1)
    const rows: XUserRow[] = database.exec(controller.db, "SELECT * FROM user", [], "all") as XUserRow[];
    expect(rows.length).toBe(1);
    expect(rows[0].userID).toBe(dmUser1.id_str);
    expect(rows[0].screenName).toBe(dmUser1.screen_name);
})

test('XAccountController.indexUser() should update a user if its already there', async () => {
    const controller = createController("indexDMs");

    await controller.indexUser(dmUser1)
    let rows: XUserRow[] = database.exec(controller.db, "SELECT * FROM user", [], "all") as XUserRow[];
    expect(rows.length).toBe(1);
    expect(rows[0].userID).toBe(dmUser1.id_str);
    expect(rows[0].name).toBe(dmUser1.name);

    const modifiedDMUser1 = dmUser1;
    modifiedDMUser1.name = 'changed name';

    await controller.indexUser(modifiedDMUser1)
    rows = database.exec(controller.db, "SELECT * FROM user", [], "all") as XUserRow[];
    expect(rows.length).toBe(1);
    expect(rows[0].userID).toBe(dmUser1.id_str);
    expect(rows[0].name).toBe('changed name');
})

test('XAccountController.indexUser() with different users should add different users', async () => {
    const controller = createController("indexDMs");

    await controller.indexUser(dmUser1)
    await controller.indexUser(dmUser2)
    const rows: XUserRow[] = database.exec(controller.db, "SELECT * FROM user", [], "all") as XUserRow[];
    expect(rows.length).toBe(2);
})

test('XAccountController.indexConversation() should add a conversation and participants', async () => {
    const controller = createController("indexDMs");

    await controller.indexConversation(dmConversation, true)
    const rows: XConversationRow[] = database.exec(controller.db, "SELECT * FROM conversation", [], "all") as XConversationRow[];
    expect(rows.length).toBe(1);
    expect(rows[0].conversationID).toBe(dmConversation.conversation_id);

    const participantRows: XConversationParticipantRow[] = database.exec(controller.db, "SELECT * FROM conversation_participant", [], "all") as XConversationParticipantRow[];
    expect(participantRows.length).toBe(2);

})

test(
    "XAccountController.indexParseConversations() should add all the conversations and users",
    { timeout: 10000 },
    async () => {
        const controller = createController("indexDMs");

        const progress: XProgress = await controller.indexParseConversations(true);
        expect(progress.usersIndexed).toBe(78);
        expect(progress.conversationsIndexed).toBe(44);

        const userRows = database.exec(controller.db, "SELECT * FROM user", [], "all") as XUserRow[];
        expect(userRows.length).toBe(78);

        const conversationRows = database.exec(controller.db, "SELECT * FROM conversation", [], "all") as XConversationRow[];
        expect(conversationRows.length).toBe(44);

        const participantRows = database.exec(controller.db, "SELECT * FROM conversation_participant", [], "all") as XConversationParticipantRow[];
        expect(participantRows.length).toBe(126);
    })

test(
    "XAccountController.indexParseConversations() should not crash with empty response data",
    { timeout: 10000 },
    async () => {
        const controller = createController("indexDMs");
        // https://dev-admin.semiphemeral.com/#/error/4
        controller.mitmController.responseData = [{
            "host": "x.com",
            "url": "/i/api/1.1/dm/user_updates.json?nsfw_filtering_enabled=false&cursor=GRwmgIC96Za7148zFoCAvemWu9ePMyUAAAA&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&supports_edit=true&include_ext_edit_control=true&include_ext_business_affiliations_label=true&ext=mediaColor%2CaltText%2CbusinessAffiliationsLabel%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
            "status": 200,
            "headers": {
                "date": "Fri, 04 Oct 2024 22:48:40 GMT",
                "perf": "7402827104",
                "pragma": "no-cache",
                "server": "tsa_p",
                "status": "200 OK",
                "expires": "Tue, 31 Mar 1981 05:00:00 GMT",
                "content-type": "application/json;charset=utf-8",
                "cache-control": "no-cache, no-store, must-revalidate, pre-check=0, post-check=0",
                "last-modified": "Fri, 04 Oct 2024 22:48:40 GMT",
                "x-transaction": "ee80ad0ceaefe304",
                "x-access-level": "read-write-directmessages",
                "x-frame-options": "SAMEORIGIN",
                "content-encoding": "gzip",
                "x-transaction-id": "ee80ad0ceaefe304",
                "x-xss-protection": "0",
                "x-rate-limit-limit": "450",
                "x-rate-limit-reset": "1728083012",
                "content-disposition": "attachment; filename=json.json",
                "x-client-event-enabled": "true",
                "x-content-type-options": "nosniff",
                "x-rate-limit-remaining": "448",
                "x-twitter-response-tags": "BouncerCompliant",
                "strict-transport-security": "max-age=631138519",
                "x-response-time": "18",
                "x-connection-hash": "0de2c8598c4078c96f84213b3d9deb7d78ae88a1c6c09d87acf21d17fc8f7d84",
                "transfer-encoding": "chunked",
                "connection": "close"
            },
            "body": "{\"user_events\":{\"cursor\":\"GRwmgIC96Za7148zFoCAvemWu9ePMyUAAAA\",\"last_seen_event_id\":\"1813903699145637988\",\"trusted_last_seen_event_id\":\"1813903699145637988\",\"untrusted_last_seen_event_id\":\"1653160237711384581\"}}",
            "processed": false
        }];

        const progress: XProgress = await controller.indexParseConversations(true);
        expect(progress.usersIndexed).toBe(0);
        expect(progress.conversationsIndexed).toBe(0);

        const userRows = database.exec(controller.db, "SELECT * FROM user", [], "all") as XUserRow[];
        expect(userRows.length).toBe(0);

        const conversationRows = database.exec(controller.db, "SELECT * FROM conversation", [], "all") as XConversationRow[];
        expect(conversationRows.length).toBe(0);

        const participantRows = database.exec(controller.db, "SELECT * FROM conversation_participant", [], "all") as XConversationParticipantRow[];
        expect(participantRows.length).toBe(0);
    })

test("XAccountController.indexParseMessages() should add all the messages on first run", async () => {
    const controller = createController("indexDMs");

    const progress: XProgress = await controller.indexParseMessages(true);
    expect(progress.messagesIndexed).toBe(116);

    const rows: XMessageRow[] = database.exec(controller.db, "SELECT * FROM message", [], "all") as XMessageRow[];
    expect(rows.length).toBe(116);
})

test("XAccountController.indexParseMessages() should add all the messages, on re-index", async () => {
    // Index messages the first time
    let controller = createController("indexDMs");
    controller.indexMessagesStart(true);
    let progress: XProgress = await controller.indexParseMessages(true);
    expect(progress.messagesIndexed).toBe(116);

    // Re-index them
    controller = createController("indexDMs");
    controller.indexMessagesStart(false);
    progress = await controller.indexParseMessages(false);
    expect(progress.messagesIndexed).toBe(0);

    // Re-index, but this time set isFirstRun to true
    controller = createController("indexDMs");
    controller.indexMessagesStart(true);
    progress = await controller.indexParseMessages(true);
    expect(progress.messagesIndexed).toBe(116);

    const rows: XMessageRow[] = database.exec(controller.db, "SELECT * FROM message", [], "all") as XMessageRow[];
    expect(rows.length).toBe(116);
})

test("XAccountController.indexParseMessages() should succeed with automation error dev-54", async () => {
    // https://dev-admin.semiphemeral.com/#/error/54
    const testData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'testdata', 'automation-errors', 'dev-54.json'), 'utf8'));
    const responseData = testData.latestResponseData;

    const controller = createController("");
    controller.mitmController.responseData = [responseData];

    const progress: XProgress = await controller.indexParseTweets(false)
    expect(progress.likesIndexed).toBe(0)
})
