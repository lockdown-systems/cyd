/**
 * Unit tests for XAccountController indexing functionality:
 * - indexTweet() - individual tweet indexing
 * - indexTweetMedia() - media extraction and storage
 * - indexTweetURLs() - URL extraction and storage
 */

import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, test, expect, vi } from "vitest";

import { XAPILegacyTweet, XAPIUserCore, XTweetRow } from "../../types";
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
