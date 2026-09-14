/**
 * Integration tests for XAccountController indexing workflows:
 * - End-to-end tweet indexing with real data
 * - Bookmarks indexing
 * - Media and URL extraction
 * - Automation error handling
 */

import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, test, expect, vi } from "vitest";

import { XTweetRow, XTweetMediaRow, XTweetURLRow } from "../../types";
import { XProgress } from "../../../shared_types";
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
