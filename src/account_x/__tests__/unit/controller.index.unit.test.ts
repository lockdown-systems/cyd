/**
 * Unit tests for XAccountController indexing functionality:
 * - indexTweet() - individual tweet indexing
 * - indexUser() - user indexing and updates
 * - indexConversation() - conversation and participant indexing
 * - indexTweetMedia() - media extraction and storage
 * - indexTweetURLs() - URL extraction and storage
 */

import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, test, expect, vi } from "vitest";

import {
  XAPILegacyTweet,
  XAPIUserCore,
  XAPIConversation,
  XAPIUser,
  XTweetRow,
  XUserRow,
  XConversationRow,
  XConversationParticipantRow,
} from "../../types";
import { XAccountController } from "../../x_account_controller";
import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";
import { XMockMITMController } from "../fixtures/mockMitmController";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

vi.mock("../../controller/index/saveTweetMedia", () => {
  return {
    saveTweetMedia: vi.fn(async () => ""),
  };
});

// Mock the util module
const pathMocks = createPlatformPathMocks("account_x");

vi.mock("../../../util", async () => {
  const actual =
    await vi.importActual<typeof import("../../../util")>("../../../util");
  return {
    ...actual,
    getSettingsPath: () => pathMocks.getSettingsPath(),
    getAccountSettingsPath: (accountID: number) =>
      pathMocks.getAccountSettingsPath(accountID),
    getDataPath: () => pathMocks.getDataPath(),
    getAccountDataPath: (accountType: string, accountUsername: string) =>
      pathMocks.getAccountDataPath(accountType, accountUsername),
  };
});

import * as database from "../../../database";

let controllerContext: XControllerTestContext | null = null;
let mitmController: XMockMITMController;
let controller: XAccountController;

beforeEach(() => {
  controllerContext = createXControllerTestContext();
  controller = controllerContext.controller;
  mitmController = controllerContext.mitmController;
});

afterEach(() => {
  controllerContext?.cleanup();
  controllerContext = null;
  pathMocks.cleanup();
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

// Unit tests for individual indexing methods

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
