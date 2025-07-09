import fs from "fs";
import path from "path";

import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { Proxy } from "http-mitm-proxy";

import {
  XAPILegacyTweet,
  XAPIUserCore,
  XAPIConversation,
  XAPIUser,
  XTweetRow,
  XTweetMediaRow,
  XTweetURLRow,
  XUserRow,
  XConversationRow,
  XConversationParticipantRow,
  XMessageRow,
  isXAPIError,
  isXAPIBookmarksData,
  isXAPIData,
  isXAPIData_v2,
} from "./account_x";

// Mock the util module
vi.mock("./util", () => ({
  ...vi.importActual("./util"), // Import and spread the actual implementations
  getSettingsPath: vi.fn(() => {
    const settingsPath = path.join(
      __dirname,
      "..",
      "testdata",
      "settingsPath-account_x",
    );
    if (!fs.existsSync(settingsPath)) {
      fs.mkdirSync(settingsPath, { recursive: true });
    }
    return settingsPath;
  }),
  getAccountSettingsPath: vi.fn((accountID: number) => {
    const settingsPath = path.join(
      __dirname,
      "..",
      "testdata",
      "settingsPath-account_x",
    );
    const accountSettingsPath = path.join(settingsPath, `account-${accountID}`);
    if (!fs.existsSync(accountSettingsPath)) {
      fs.mkdirSync(accountSettingsPath, { recursive: true });
    }
    return accountSettingsPath;
  }),
  getDataPath: vi.fn(() => {
    const dataPath = path.join(
      __dirname,
      "..",
      "testdata",
      "dataPath-account_x",
    );
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
    }
    return dataPath;
  }),
  getAccountDataPath: vi.fn((accountType: string, accountUsername: string) => {
    const dataPath = path.join(__dirname, "..", "testdata", "dataPath");
    const accountDataPath = path.join(dataPath, accountType, accountUsername);
    if (!fs.existsSync(accountDataPath)) {
      fs.mkdirSync(accountDataPath, { recursive: true });
    }
    return accountDataPath;
  }),
}));
import { getSettingsPath, getAccountDataPath } from "./util";

// Mock Electron
vi.mock("electron", () => ({
  session: {
    fromPartition: vi.fn().mockReturnValue({
      webRequest: {
        onCompleted: vi.fn(),
        onSendHeaders: vi.fn(),
      },
    }),
  },
  app: {
    getPath: vi
      .fn()
      .mockReturnValue(path.join(__dirname, "..", "testdata", "tmp")),
  },
}));

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Import the local modules after stuff has been mocked
import { Account, ResponseData, XProgress } from "./shared_types";
import { XAccountController } from "./account_x";
import { IMITMController } from "./mitm";
import * as database from "./database";

// Mock a MITMController
class MockMITMController implements IMITMController {
  public account: Account | null = null;
  private proxy: Proxy | null = null;
  private proxyPort: number = 0;
  private proxySSLCADir: string = "";
  private proxyFilter: string[] = [];
  private isMonitoring: boolean = false;
  public responseData: ResponseData[] = [];
  constructor() {}
  async startMITM(
    _ses: Electron.Session,
    _proxyFilter: string[],
  ): Promise<boolean> {
    return true;
  }
  async stopMITM(_ses: Electron.Session) {}
  async startMonitoring() {}
  async stopMonitoring() {}
  async clearProcessed(): Promise<void> {}

  // Just used in the tests
  setTestdata(testdata: string | undefined) {
    if (testdata == "indexTweets") {
      this.responseData = [
        {
          host: "x.com",
          url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XUserTweetsAndReplies1.json",
            ),
            "utf8",
          ),
          processed: false,
        },
        {
          host: "x.com",
          url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XUserTweetsAndReplies2.json",
            ),
            "utf8",
          ),
          processed: false,
        },
        {
          host: "x.com",
          url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XUserTweetsAndReplies3.json",
            ),
            "utf8",
          ),
          processed: false,
        },
        {
          host: "x.com",
          url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XUserTweetsAndReplies18.json",
            ),
            "utf8",
          ),
          processed: false,
        },
      ];
    }
    if (testdata == "indexTweetsMedia") {
      this.responseData = [
        {
          host: "x.com",
          url: "/i/api/graphql/xNb3huAac5mdP9GOm4VI1g/UserTweetsAndReplies?",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XUserTweetsAndRepliesMedia.json",
            ),
            "utf8",
          ),
          processed: false,
        },
      ];
    }
    if (testdata == "indexDMs") {
      this.responseData = [
        {
          host: "x.com",
          url: "/i/api/1.1/dm/inbox_timeline/trusted.json?filter_low_quality=false&include_quality=all&max_id=1737890608109486086&nsfw_filtering_enabled=false&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_ext_edit_control=true&ext=mediaColor%2CaltText%2CbusinessAffiliationsLabel%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XAPIDMInboxTimeline1.json",
            ),
            "utf8",
          ),
          processed: false,
        },
        {
          host: "x.com",
          url: "/i/api/1.1/dm/inbox_initial_state.json?nsfw_filtering_enabled=false&filter_low_quality=false&include_quality=all&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=true&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_ext_edit_control=true&include_ext_business_affiliations_label=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XAPIDMInitialInboxState.json",
            ),
            "utf8",
          ),
          processed: false,
        },
        {
          host: "x.com",
          url: "/i/api/1.1/dm/conversation/96752784-1209344563589992448.json?context=FETCH_DM_CONVERSATION&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_conversation_info=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XAPIDMConversation1.json",
            ),
            "utf8",
          ),
          processed: false,
        },
        {
          host: "x.com",
          url: "/i/api/1.1/dm/conversation/96752784-1209344563589992448.json?context=FETCH_DM_CONVERSATION&include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1&include_ext_profile_image_shape=1&skip_status=1&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&include_conversation_info=true&ext=mediaColor%2CaltText%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(
              __dirname,
              "..",
              "testdata",
              "x",
              "XAPIDMConversation2.json",
            ),
            "utf8",
          ),
          processed: false,
        },
      ];
    }
    if (testdata == "indexBookmarks") {
      this.responseData = [
        {
          host: "x.com",
          url: "/i/api/graphql/Ds7FCVYEIivOKHsGcE84xQ/Bookmarks?",
          status: 200,
          requestBody: "",
          responseHeaders: {},
          responseBody: fs.readFileSync(
            path.join(__dirname, "..", "testdata", "x", "XBookmarks.json"),
            "utf8",
          ),
          processed: false,
        },
      ];
    }
  }
  setTestdataFromFile(filename: string, url: string) {
    this.responseData = [
      {
        host: "x.com",
        url: url,
        status: 200,
        requestBody: "",
        responseHeaders: {},
        responseBody: fs.readFileSync(
          path.join(__dirname, "..", "testdata", "x", filename),
          "utf8",
        ),
        processed: false,
      },
    ];
  }
  setAutomationErrorReportTestdata(filename: string) {
    const testData = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "testdata", "automation-errors", filename),
        "utf8",
      ),
    );
    this.responseData = [testData.latestResponseData];
  }
}

let mitmController: MockMITMController;
let controller: XAccountController;

beforeEach(() => {
  database.runMainMigrations();

  // Create an X account, which should have an id of 1
  let account = database.createAccount();
  account = database.selectAccountType(account.id, "X");
  if (account.xAccount) {
    account.xAccount.username = "test";
  }
  database.saveAccount(account);

  // Create an XAccountController
  mitmController = new MockMITMController();
  controller = new XAccountController(account.id, mitmController);

  // Stub controller.saveTweetMedia, to avoid saving tweet media during the tests
  controller.saveTweetMedia = vi.fn();

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
  const accountDataPath = getAccountDataPath("X", "test");

  if (fs.existsSync(settingsPath)) {
    fs.rmSync(settingsPath, { recursive: true, force: true });
  }

  if (fs.existsSync(accountDataPath)) {
    fs.rmSync(accountDataPath, { recursive: true, force: true });
  }
});

// Fixtures

const userCore: XAPIUserCore = {
  created_at: "Sun Mar 17 18:07:40 +0000 2024",
  name: "aurorabyte",
  screen_name: "aurorabyte79324",
};
const tweetLegacy: XAPILegacyTweet = {
  bookmark_count: 0,
  bookmarked: false,
  created_at: "Wed Feb 12 21:30:13 +0000 2025",
  conversation_id_str: "1889789128130125848",
  display_text_range: [0, 42],
  entities: {
    hashtags: [],
    symbols: [],
    timestamps: [],
    urls: [],
    user_mentions: [],
  },
  favorite_count: 0,
  favorited: false,
  full_text: "Pixels at play, creating visual symphonies",
  is_quote_status: false,
  lang: "en",
  quote_count: 0,
  reply_count: 0,
  retweet_count: 0,
  retweeted: false,
  user_id_str: "1769424777998180352",
  id_str: "1889789128130125848",
};
const dmUser1: XAPIUser = {
  id: 1209344563589992448,
  id_str: "1209344563589992448",
  name: "Semiphemeral",
  screen_name: "semiphemeral",
  location: null,
  description: "Claw back your data from Big Tech",
  url: "https://t.co/j0oVFIXVVe",
  entities: {
    url: {
      urls: [
        {
          url: "https://t.co/j0oVFIXVVe",
          expanded_url: "https://semiphemeral.com",
          display_url: "semiphemeral.com",
          indices: [0, 23],
        },
      ],
    },
    description: {
      urls: [],
    },
  },
  protected: false,
  followers_count: 30615,
  friends_count: 1,
  listed_count: 62,
  created_at: "Tue Dec 24 05:26:49 +0000 2019",
  favourites_count: 14,
  utc_offset: null,
  time_zone: null,
  geo_enabled: false,
  verified: false,
  statuses_count: 5,
  lang: null,
  contributors_enabled: false,
  is_translator: false,
  is_translation_enabled: false,
  profile_background_color: "F5F8FA",
  profile_background_image_url: null,
  profile_background_image_url_https: null,
  profile_background_tile: false,
  profile_image_url:
    "http://pbs.twimg.com/profile_images/1221505863631769601/cfFGJZzY_normal.jpg",
  profile_image_url_https:
    "https://pbs.twimg.com/profile_images/1221505863631769601/cfFGJZzY_normal.jpg",
  profile_banner_url:
    "https://pbs.twimg.com/profile_banners/1209344563589992448/1690903715",
  profile_link_color: "1DA1F2",
  profile_sidebar_border_color: "C0DEED",
  profile_sidebar_fill_color: "DDEEF6",
  profile_text_color: "333333",
  profile_use_background_image: true,
  default_profile: true,
  default_profile_image: false,
  can_dm: null,
  can_secret_dm: null,
  can_media_tag: false,
  following: false,
  follow_request_sent: false,
  notifications: false,
  blocking: false,
  subscribed_by: false,
  blocked_by: false,
  want_retweets: false,
  business_profile_state: "none",
  translator_type: "none",
  withheld_in_countries: [],
  followed_by: false,
};
const dmUser2: XAPIUser = {
  id: 1700151216,
  id_str: "1700151216",
  name: "yakhoda",
  screen_name: "yakhoda498",
  location: null,
  description: null,
  url: null,
  entities: {
    description: {
      urls: [],
    },
  },
  protected: false,
  followers_count: 136,
  friends_count: 171,
  listed_count: 0,
  created_at: "Sun Aug 25 21:11:52 +0000 2013",
  favourites_count: 2657,
  utc_offset: null,
  time_zone: null,
  geo_enabled: true,
  verified: false,
  statuses_count: 2935,
  lang: null,
  contributors_enabled: false,
  is_translator: false,
  is_translation_enabled: false,
  profile_background_color: "C0DEED",
  profile_background_image_url:
    "http://abs.twimg.com/images/themes/theme1/bg.png",
  profile_background_image_url_https:
    "https://abs.twimg.com/images/themes/theme1/bg.png",
  profile_background_tile: false,
  profile_image_url:
    "http://pbs.twimg.com/profile_images/1801186042315194368/exOSSVRx_normal.jpg",
  profile_image_url_https:
    "https://pbs.twimg.com/profile_images/1801186042315194368/exOSSVRx_normal.jpg",
  profile_banner_url:
    "https://pbs.twimg.com/profile_banners/1700151216/1718270871",
  profile_link_color: "1DA1F2",
  profile_sidebar_border_color: "C0DEED",
  profile_sidebar_fill_color: "DDEEF6",
  profile_text_color: "333333",
  profile_use_background_image: true,
  default_profile: true,
  default_profile_image: false,
  can_dm: null,
  can_secret_dm: null,
  can_media_tag: true,
  following: false,
  follow_request_sent: false,
  notifications: false,
  blocking: false,
  subscribed_by: false,
  blocked_by: false,
  want_retweets: false,
  business_profile_state: "none",
  translator_type: "regular",
  withheld_in_countries: [],
  followed_by: false,
};
const dmConversation: XAPIConversation = {
  conversation_id: "1700151216-1209344563589992448",
  type: "ONE_TO_ONE",
  sort_event_id: "1700911936349602141",
  sort_timestamp: "1694363981698",
  participants: [
    {
      user_id: "1700151216",
      last_read_event_id: "1700911936349602141",
    },
    {
      user_id: "1209344563589992448",
      last_read_event_id: "1540971592154497032",
    },
  ],
  nsfw: false,
  notifications_disabled: false,
  mention_notifications_disabled: false,
  last_read_event_id: "1540971592154497032",
  read_only: false,
  trusted: true,
  muted: false,
  status: "AT_END",
  min_entry_id: "1540971592154497032",
  max_entry_id: "1700911936349602141",
};

// XAccountController tests

test("XAccountController.constructor() creates a database for the user", async () => {
  mitmController.setTestdata("indexTweets");

  // There should be a file called data.sqlite3 in the account data directory
  const files = fs.readdirSync(getAccountDataPath("X", "test"));
  expect(files).toContain("data.sqlite3");
});

test("XAccountController.indexTweet() should add a tweet", async () => {
  mitmController.setTestdata("indexTweets");

  controller.indexTweet(0, userCore, tweetLegacy);
  const rows: XTweetRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet",
    [],
    "all",
  ) as XTweetRow[];
  expect(rows.length).toBe(1);
  expect(rows[0].text).toBe(tweetLegacy.full_text);
});

test("XAccountController.indexTweet() should not add a tweet if it's already there", async () => {
  mitmController.setTestdata("indexTweets");

  controller.indexTweet(0, userCore, tweetLegacy);
  const rows: XTweetRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet",
    [],
    "all",
  ) as XTweetRow[];
  expect(rows.length).toBe(1);

  controller.indexTweet(0, userCore, tweetLegacy);
  const rows2: XTweetRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet",
    [],
    "all",
  ) as XTweetRow[];
  expect(rows2.length).toBe(1);
});

test("XAccountController.indexParsedTweets() should add all the test tweets", async () => {
  mitmController.setTestdata("indexTweets");
  if (controller.account) {
    controller.account.username = "aurorabyte79324";
  }

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(0);
  expect(progress.retweetsIndexed).toBe(19);
  expect(progress.tweetsIndexed).toBe(41);
  expect(progress.unknownIndexed).toBe(0);

  const rows: XTweetRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet",
    [],
    "all",
  ) as XTweetRow[];
  expect(rows.length).toBe(60);
});

test("XAccountController.indexUser() should add a user", async () => {
  mitmController.setTestdata("indexDMs");

  await controller.indexUser(dmUser1);
  const rows: XUserRow[] = database.exec(
    controller.db,
    "SELECT * FROM user",
    [],
    "all",
  ) as XUserRow[];
  expect(rows.length).toBe(1);
  expect(rows[0].userID).toBe(dmUser1.id_str);
  expect(rows[0].screenName).toBe(dmUser1.screen_name);
});

test("XAccountController.indexUser() should update a user if its already there", async () => {
  mitmController.setTestdata("indexDMs");

  await controller.indexUser(dmUser1);
  let rows: XUserRow[] = database.exec(
    controller.db,
    "SELECT * FROM user",
    [],
    "all",
  ) as XUserRow[];
  expect(rows.length).toBe(1);
  expect(rows[0].userID).toBe(dmUser1.id_str);
  expect(rows[0].name).toBe(dmUser1.name);

  const modifiedDMUser1 = dmUser1;
  modifiedDMUser1.name = "changed name";

  await controller.indexUser(modifiedDMUser1);
  rows = database.exec(
    controller.db,
    "SELECT * FROM user",
    [],
    "all",
  ) as XUserRow[];
  expect(rows.length).toBe(1);
  expect(rows[0].userID).toBe(dmUser1.id_str);
  expect(rows[0].name).toBe("changed name");
});

test("XAccountController.indexUser() with different users should add different users", async () => {
  mitmController.setTestdata("indexDMs");

  await controller.indexUser(dmUser1);
  await controller.indexUser(dmUser2);
  const rows: XUserRow[] = database.exec(
    controller.db,
    "SELECT * FROM user",
    [],
    "all",
  ) as XUserRow[];
  expect(rows.length).toBe(2);
});

test("XAccountController.indexConversation() should add a conversation and participants", async () => {
  mitmController.setTestdata("indexDMs");

  await controller.indexConversation(dmConversation);
  const rows: XConversationRow[] = database.exec(
    controller.db,
    "SELECT * FROM conversation",
    [],
    "all",
  ) as XConversationRow[];
  expect(rows.length).toBe(1);
  expect(rows[0].conversationID).toBe(dmConversation.conversation_id);

  const participantRows: XConversationParticipantRow[] = database.exec(
    controller.db,
    "SELECT * FROM conversation_participant",
    [],
    "all",
  ) as XConversationParticipantRow[];
  expect(participantRows.length).toBe(2);
});

test(
  "XAccountController.indexParseConversations() should add all the conversations and users",
  { timeout: 20000 },
  async () => {
    mitmController.setTestdata("indexDMs");

    const progress: XProgress = await controller.indexParseConversations();
    expect(progress.usersIndexed).toBe(78);
    expect(progress.conversationsIndexed).toBe(44);

    const userRows = database.exec(
      controller.db,
      "SELECT * FROM user",
      [],
      "all",
    ) as XUserRow[];
    expect(userRows.length).toBe(78);

    const conversationRows = database.exec(
      controller.db,
      "SELECT * FROM conversation",
      [],
      "all",
    ) as XConversationRow[];
    expect(conversationRows.length).toBe(44);

    const participantRows = database.exec(
      controller.db,
      "SELECT * FROM conversation_participant",
      [],
      "all",
    ) as XConversationParticipantRow[];
    expect(participantRows.length).toBe(126);
  },
);

test(
  "XAccountController.indexParseConversations() should not crash with empty response data",
  { timeout: 20000 },
  async () => {
    mitmController.setTestdata("indexDMs");
    // https://dev-admin.cyd.social/#/error/4
    controller.mitmController.responseData = [
      {
        host: "x.com",
        url: "/i/api/1.1/dm/user_updates.json?nsfw_filtering_enabled=false&cursor=GRwmgIC96Za7148zFoCAvemWu9ePMyUAAAA&dm_secret_conversations_enabled=false&krs_registration_enabled=true&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true&include_ext_limited_action_results=true&include_quote_count=true&include_reply_count=1&tweet_mode=extended&include_ext_views=true&dm_users=false&include_groups=true&include_inbox_timelines=true&include_ext_media_color=true&supports_reactions=true&supports_edit=true&include_ext_edit_control=true&include_ext_business_affiliations_label=true&ext=mediaColor%2CaltText%2CbusinessAffiliationsLabel%2CmediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot%2CsuperFollowMetadata%2CunmentionInfo%2CeditControl%2Carticle",
        status: 200,
        requestBody: "",
        responseHeaders: {
          date: "Fri, 04 Oct 2024 22:48:40 GMT",
          perf: "7402827104",
          pragma: "no-cache",
          server: "tsa_p",
          status: "200 OK",
          expires: "Tue, 31 Mar 1981 05:00:00 GMT",
          "content-type": "application/json;charset=utf-8",
          "cache-control":
            "no-cache, no-store, must-revalidate, pre-check=0, post-check=0",
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
          "x-connection-hash":
            "0de2c8598c4078c96f84213b3d9deb7d78ae88a1c6c09d87acf21d17fc8f7d84",
          "transfer-encoding": "chunked",
          connection: "close",
        },
        responseBody:
          '{"user_events":{"cursor":"GRwmgIC96Za7148zFoCAvemWu9ePMyUAAAA","last_seen_event_id":"1813903699145637988","trusted_last_seen_event_id":"1813903699145637988","untrusted_last_seen_event_id":"1653160237711384581"}}',
        processed: false,
      },
    ];

    const progress: XProgress = await controller.indexParseConversations();
    expect(progress.usersIndexed).toBe(0);
    expect(progress.conversationsIndexed).toBe(0);

    const userRows = database.exec(
      controller.db,
      "SELECT * FROM user",
      [],
      "all",
    ) as XUserRow[];
    expect(userRows.length).toBe(0);

    const conversationRows = database.exec(
      controller.db,
      "SELECT * FROM conversation",
      [],
      "all",
    ) as XConversationRow[];
    expect(conversationRows.length).toBe(0);

    const participantRows = database.exec(
      controller.db,
      "SELECT * FROM conversation_participant",
      [],
      "all",
    ) as XConversationParticipantRow[];
    expect(participantRows.length).toBe(0);
  },
);

test("XAccountController.indexParseMessages() should add all the messages", async () => {
  mitmController.setTestdata("indexDMs");

  const progress: XProgress = await controller.indexParseMessages();
  expect(progress.messagesIndexed).toBe(116);

  const rows: XMessageRow[] = database.exec(
    controller.db,
    "SELECT * FROM message",
    [],
    "all",
  ) as XMessageRow[];
  expect(rows.length).toBe(116);
});

test("XAccountController.indexParseMessages() should add all the messages, on re-index", async () => {
  // Index messages the first time
  mitmController.setTestdata("indexDMs");
  controller.indexMessagesStart();
  let progress: XProgress = await controller.indexParseMessages();
  expect(progress.messagesIndexed).toBe(116);

  // Index them again, the progress should still be the same
  controller.resetProgress();
  mitmController.setTestdata("indexDMs");
  controller.indexMessagesStart();
  progress = await controller.indexParseMessages();
  expect(progress.messagesIndexed).toBe(116);

  const rows: XMessageRow[] = database.exec(
    controller.db,
    "SELECT * FROM message",
    [],
    "all",
  ) as XMessageRow[];
  expect(rows.length).toBe(116);
});

test("XAccountController.indexParseTweets() should succeed with automation error dev-4", async () => {
  // https://dev-admin.cyd.social/#/error/4
  mitmController.setAutomationErrorReportTestdata("dev-4.json");
  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(0);
  controller.cleanup();
});

test("XAccountController.indexParseTweets() should succeed with automation error dev-10", async () => {
  // https://dev-admin.cyd.social/#/error/10
  mitmController.setAutomationErrorReportTestdata("dev-10.json");
  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(0);
  controller.cleanup();
});

test("XAccountController.indexParseTweets() should succeed with automation error dev-25", async () => {
  // https://dev-admin.cyd.social/#/error/25
  mitmController.setAutomationErrorReportTestdata("dev-25.json");
  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(0);
  controller.cleanup();
});

test("XAccountController.indexParseTweets() should succeed with automation error dev-34", async () => {
  // https://dev-admin.cyd.social/#/error/34
  mitmController.setAutomationErrorReportTestdata("dev-34.json");
  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(0);
  controller.cleanup();
});

test("XAccountController.indexParseTweets() should succeed with automation error dev-51", async () => {
  // https://dev-admin.cyd.social/#/error/51
  mitmController.setAutomationErrorReportTestdata("dev-51.json");
  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(0);
  controller.cleanup();
});

test("XAccountController.indexParseTweets() should succeed with automation error dev-54", async () => {
  // https://dev-admin.cyd.social/#/error/54
  mitmController.setAutomationErrorReportTestdata("dev-54.json");
  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(0);
  controller.cleanup();
});

test("XAccountController.indexParsedTweets() should index bookmarks", async () => {
  mitmController.setTestdata("indexBookmarks");
  if (controller.account) {
    controller.account.username = "aurorabyte79324";
  }

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.bookmarksIndexed).toBe(5);

  const rows: XTweetRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet WHERE isBookmarked=1",
    [],
    "all",
  ) as XTweetRow[];
  expect(rows.length).toBe(5);
});

test("XAccountController.indexParsedTweets() should index and download media", async () => {
  mitmController.setTestdata("indexTweetsMedia");
  if (controller.account) {
    controller.account.username = "nexamind91326";
  }

  await controller.indexParseTweets();

  // Verify the video tweet
  let tweetRows: XTweetRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet WHERE tweetID=?",
    ["1927508185377546524"],
    "all",
  ) as XTweetRow[];
  expect(tweetRows.length).toBe(1);
  expect(tweetRows[0].tweetID).toBe("1927508185377546524");
  expect(tweetRows[0].text).toBe(
    "video of crunching some data https://t.co/lug3fnodCw",
  );

  let mediaRows: XTweetMediaRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet_media WHERE tweetID=?",
    ["1927508185377546524"],
    "all",
  ) as XTweetMediaRow[];
  expect(mediaRows.length).toBe(1);
  expect(mediaRows[0].mediaType).toBe("video");
  expect(mediaRows[0].filename).toBe("13_1927508143073820673.mp4");
  expect(mediaRows[0].startIndex).toBe(29);
  expect(mediaRows[0].endIndex).toBe(52);

  // Verify the GIF tweet
  tweetRows = database.exec(
    controller.db,
    "SELECT * FROM tweet WHERE tweetID=?",
    ["1927508627398746291"],
    "all",
  ) as XTweetRow[];
  expect(tweetRows.length).toBe(1);
  expect(tweetRows[0].tweetID).toBe("1927508627398746291");
  expect(tweetRows[0].text).toBe(
    "do you miss the 1900s? https://t.co/xSBWvvEIc5",
  );

  mediaRows = database.exec(
    controller.db,
    "SELECT * FROM tweet_media WHERE tweetID=?",
    ["1927508627398746291"],
    "all",
  ) as XTweetMediaRow[];
  expect(mediaRows.length).toBe(1);
  expect(mediaRows[0].mediaType).toBe("animated_gif");
  expect(mediaRows[0].filename).toBe("16_1927508602601836544.mp4");
  expect(mediaRows[0].startIndex).toBe(23);
  expect(mediaRows[0].endIndex).toBe(46);

  // Verify the image tweet
  tweetRows = database.exec(
    controller.db,
    "SELECT * FROM tweet WHERE tweetID=?",
    ["1927508367775318207"],
    "all",
  ) as XTweetRow[];
  expect(tweetRows.length).toBe(1);
  expect(tweetRows[0].tweetID).toBe("1927508367775318207");
  expect(tweetRows[0].text).toBe("a true explorer https://t.co/lAJ1gfmsXC");

  mediaRows = database.exec(
    controller.db,
    "SELECT * FROM tweet_media WHERE tweetID=? ORDER BY id",
    ["1927508367775318207"],
    "all",
  ) as XTweetMediaRow[];
  expect(mediaRows.length).toBe(2);
  expect(mediaRows[0].mediaType).toBe("photo");
  expect(mediaRows[0].filename).toBe("3_1927508352059281410.jpg");
  expect(mediaRows[0].startIndex).toBe(16);
  expect(mediaRows[0].endIndex).toBe(39);
  expect(mediaRows[1].mediaType).toBe("photo");
  expect(mediaRows[1].filename).toBe("3_1927508352730296320.png");
  expect(mediaRows[1].startIndex).toBe(16);
  expect(mediaRows[1].endIndex).toBe(39);

  // Verify the link tweet
  const linkRows: XTweetURLRow[] = database.exec(
    controller.db,
    "SELECT * FROM tweet_url WHERE tweetID=? ORDER BY id",
    ["1927508892461973515"],
    "all",
  ) as XTweetURLRow[];
  expect(linkRows.length).toBe(2);
  expect(linkRows[0].expandedURL).toBe("https://en.wikipedia.org/wiki/Moon");
  expect(linkRows[1].expandedURL).toBe("https://en.wikipedia.org/wiki/Sun");
});

test("types.isXAPIBookmarksData() should recognize bookmarks data", async () => {
  const body = fs.readFileSync(
    path.join(__dirname, "..", "testdata", "x", "XBookmarks.json"),
    "utf8",
  );
  const data = JSON.parse(body);
  expect(isXAPIBookmarksData(data)).toBe(true);
  expect(isXAPIError(data)).toBe(false);
  expect(isXAPIData(data)).toBe(false);
});

test("types.isXAPIError() should recognize errors", async () => {
  const body = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "testdata",
      "x",
      "XUserTweetsAndRepliesError.json",
    ),
    "utf8",
  );
  const data = JSON.parse(body);
  expect(isXAPIError(data)).toBe(true);
  expect(isXAPIBookmarksData(data)).toBe(false);
  expect(isXAPIData(data)).toBe(false);
});

test("types.isXAPIData() should recognize data", async () => {
  const body = fs.readFileSync(
    path.join(__dirname, "..", "testdata", "x", "XUserTweetsAndReplies1.json"),
    "utf8",
  );
  const data = JSON.parse(body);
  expect(isXAPIData_v2(data)).toBe(false);
  expect(isXAPIData(data)).toBe(true);
  expect(isXAPIBookmarksData(data)).toBe(false);
  expect(isXAPIError(data)).toBe(false);
});

// Testing the X migrations

test("test migration: 20241016_add_config", async () => {
  // Close the X account database
  controller.cleanup();

  // Replace it with test data
  const accountDataPath = getAccountDataPath("X", "test");
  fs.mkdirSync(accountDataPath, { recursive: true });
  fs.copyFileSync(
    path.join(
      __dirname,
      "..",
      "testdata",
      "x",
      "migrations",
      "initial.sqlite3",
    ),
    path.join(accountDataPath, "data.sqlite3"),
  );

  // Run the migrations
  controller.initDB();

  // The config table should exist
  const rows = database.exec(
    controller.db,
    "SELECT * FROM config",
    [],
    "all",
  ) as Record<string, string>[];
  expect(rows.length).toBe(0);
});

test("test migration: 20241127_add_deletedAt_fields", async () => {
  // Close the X account database
  controller.cleanup();

  // Replace it with test data
  const accountDataPath = getAccountDataPath("X", "test");
  fs.mkdirSync(accountDataPath, { recursive: true });
  fs.copyFileSync(
    path.join(
      __dirname,
      "..",
      "testdata",
      "x",
      "migrations",
      "20241127_add_deletedAt_fields.sqlite3",
    ),
    path.join(accountDataPath, "data.sqlite3"),
  );

  // Before the migration, there is only deletedAt fields
  // Run the migrations
  controller.initDB();

  // The tweets should all have deletedTweetAt, deletedRetweetAt, and deletedLikeAt values
  const afterTweetRows = database.exec(
    controller.db,
    "SELECT * FROM tweet WHERE deletedAt IS NOT NULL ORDER BY id",
    [],
    "all",
  ) as Record<string, string>[];
  expect(afterTweetRows.length).toBe(6);

  expect(afterTweetRows[0].deletedTweetAt).toBe(null);
  expect(afterTweetRows[0].deletedRetweetAt).toBeDefined();
  expect(afterTweetRows[0].deletedLikeAt).toBe(null);

  expect(afterTweetRows[1].deletedTweetAt).toBe(null);
  expect(afterTweetRows[1].deletedRetweetAt).toBeDefined();
  expect(afterTweetRows[1].deletedLikeAt).toBeDefined();

  expect(afterTweetRows[2].deletedTweetAt).toBeDefined();
  expect(afterTweetRows[2].deletedRetweetAt).toBe(null);
  expect(afterTweetRows[2].deletedLikeAt).toBe(null);

  expect(afterTweetRows[3].deletedTweetAt).toBeDefined();
  expect(afterTweetRows[3].deletedRetweetAt).toBe(null);
  expect(afterTweetRows[3].deletedLikeAt).toBe(null);

  expect(afterTweetRows[4].deletedTweetAt).toBe(null);
  expect(afterTweetRows[4].deletedRetweetAt).toBe(null);
  expect(afterTweetRows[4].deletedLikeAt).toBeDefined();

  expect(afterTweetRows[5].deletedTweetAt).toBe(null);
  expect(afterTweetRows[5].deletedRetweetAt).toBeDefined();
  expect(afterTweetRows[5].deletedLikeAt).toBeDefined();
});
