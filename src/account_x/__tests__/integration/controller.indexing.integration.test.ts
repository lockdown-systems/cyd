/**
 * Integration tests for XAccountController indexing workflows:
 * - End-to-end tweet indexing with real data
 * - Bookmarks indexing
 * - Media and URL extraction
 * - Automation error handling
 */

import fs from "fs";
import path from "path";

import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, test, expect, vi } from "vitest";

import { XTweetRow, XTweetMediaRow, XTweetURLRow } from "../../types";
import { XProgress } from "../../../shared_types";
import { XAccountController } from "../../x_account_controller";
import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";
import {
  XMockMITMController,
  LIKES_URL,
  USER_ORIGINALS_URL,
} from "../fixtures/mockMitmController";
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

// --- The capture of 2026-09-14 ---------------------------------------------
//
// X renamed the timeline operations, split the profile timeline in three, and
// moved the author fields into `core`. These tests hold the parser to the
// responses X actually returned; see docs/x-capture/findings-20260914.md.

function saveAsAccount(username: string) {
  if (controller.account) {
    controller.account.username = username;
  }
}

function countRows(whereClause: string = "1=1"): number {
  const rows = database.exec(
    controller.db,
    `SELECT * FROM tweet WHERE ${whereClause}`,
    [],
    "all",
  ) as XTweetRow[];
  return rows.length;
}

test("indexParseTweets() saves posts from the profile timeline", async () => {
  mitmController.setTestdata("indexPosts_20260914");
  saveAsAccount("snowyfoxmatch");

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.tweetsIndexed).toBe(57);
  expect(progress.retweetsIndexed).toBe(0);
  expect(progress.likesIndexed).toBe(0);
  expect(progress.unknownIndexed).toBe(0);
  expect(countRows()).toBe(57);

  // The shapes that historically broke parsing are all in these pages, and
  // all of them save: quote posts, posts with images and video, link cards,
  // polls, and self-threads, which arrive nested inside modules.
  expect(countRows("isQuote=1")).toBe(2);
  expect(countRows("hasMedia=1")).toBe(7);
  expect(countRows("isReply=1")).toBe(2);
  const awkward = [
    "2099595172799815895", // link card
    "2099595106072621327", // poll
    "2099594029348634934", // self-thread, 1 of 3
    "2099594030929842403", // self-thread, 2 of 3
  ];
  expect(
    countRows(`tweetID IN (${awkward.map((id) => `'${id}'`).join(", ")})`),
  ).toBe(awkward.length);
});

test("indexParseTweets() pages the profile timeline to the end", async () => {
  saveAsAccount("snowyfoxmatch");
  controller.thereIsMore = true;

  // The first three pages carry posts, so there is more to come.
  mitmController.setTestdataFromFile(
    "XUserOriginalsTimeline_20260914_1.json",
    USER_ORIGINALS_URL,
  );
  await controller.indexParseTweets();
  expect(await controller.indexIsThereMore()).toBe(true);
  expect(countRows()).toBe(20);

  // The last page carries cursors and no posts. That is the end of the
  // timeline, and it is not an error.
  mitmController.setTestdataFromFile(
    "XUserOriginalsTimeline_20260914_4.json",
    USER_ORIGINALS_URL,
  );
  await controller.indexParseTweets();
  expect(await controller.indexIsThereMore()).toBe(false);
  expect(countRows()).toBe(20);
});

test("indexParseTweets() saves replies, which arrive nested in modules", async () => {
  mitmController.setTestdata("indexReplies_20260914");
  saveAsAccount("snowyfoxmatch");

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.tweetsIndexed).toBe(4);
  expect(countRows()).toBe(4);
  expect(countRows("isReply=1")).toBe(3);
});

test("indexParseTweets() saves reposts", async () => {
  mitmController.setTestdata("indexReposts_20260914");
  saveAsAccount("snowyfoxmatch");

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.retweetsIndexed).toBe(2);
  expect(countRows()).toBe(2);

  // X undoes a repost by naming the post that was reposted, so each repost
  // has to carry that post's ID
  const reposted = database.exec(
    controller.db,
    "SELECT tweetID, retweetedTweetID FROM tweet ORDER BY tweetID",
    [],
    "all",
  ) as { tweetID: string; retweetedTweetID: string | null }[];
  expect(reposted).toEqual([
    {
      tweetID: "2099598114986545360",
      retweetedTweetID: "2099358318083109242",
    },
    {
      tweetID: "2099598159727210713",
      retweetedTweetID: "2099459833833406805",
    },
  ]);
});

test("indexParseTweets() saves likes", async () => {
  mitmController.setTestdata("indexLikes_20260914");
  saveAsAccount("snowyfoxmatch");

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.likesIndexed).toBe(56);
  expect(progress.unknownIndexed).toBe(0);
  expect(countRows("isLiked=1")).toBe(56);
});

test("indexParseTweets() saves bookmarks", async () => {
  mitmController.setTestdata("indexBookmarks_20260914");
  saveAsAccount("snowyfoxmatch");

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.bookmarksIndexed).toBe(58);
  expect(countRows("isBookmarked=1")).toBe(58);
});

test.each([
  ["indexPostsEmpty_20260914"],
  ["indexLikesEmpty_20260914"],
  ["indexBookmarksEmpty_20260914"],
])("indexParseTweets() finishes cleanly on %s", async (testdata) => {
  mitmController.setTestdata(testdata);

  const progress: XProgress = await controller.indexParseTweets();
  expect(progress.tweetsIndexed).toBe(0);
  expect(countRows()).toBe(0);

  // An empty account is done, not broken: the response was recognized, it
  // simply carried no posts.
  expect(await controller.indexIsThereMore()).toBe(false);
  const stats = await controller.indexTimelineStats();
  expect(stats.recognizedResponses).toBeGreaterThan(0);
  expect(stats.tweetEntries).toBe(0);
  expect(stats.tweetsSaved).toBe(0);
});

test("indexParseTweets() reports that no timeline response was recognized", async () => {
  // What a run against a renamed operation looks like: responses arrive, none
  // of them is a timeline Cyd knows how to read.
  mitmController.setTestdataFromFile(
    "XUserOriginalsTimeline_20260914_1.json",
    "/i/api/graphql/abc123/SomeOperationCydDoesNotKnow?",
  );

  await controller.indexParseTweets();
  const stats = await controller.indexTimelineStats();
  expect(stats.recognizedResponses).toBe(0);
  expect(stats.tweetEntries).toBe(0);
  expect(countRows()).toBe(0);
});

test("indexParseTweets() counts what it recognized and what it saved", async () => {
  mitmController.setTestdata("indexPosts_20260914");
  saveAsAccount("snowyfoxmatch");

  await controller.indexParseTweets();
  const stats = await controller.indexTimelineStats();
  expect(stats.recognizedResponses).toBe(4);
  expect(stats.tweetEntries).toBe(57);
  expect(stats.tweetsSaved).toBe(57);
});

test("indexParseTweets() treats a rate limit inside a successful response as a rate limit", async () => {
  // X was never seen doing this during the capture, so this is written
  // defensively rather than against a fixture: a 200 carrying an errors array
  // that names a rate limit must not read as "no more data".
  const now = Math.floor(Date.now() / 1000);
  mitmController.responseData = [
    {
      host: "x.com",
      url: `${USER_ORIGINALS_URL}variables=%7B%7D`,
      status: 200,
      requestBody: "",
      responseHeaders: {},
      responseBody: JSON.stringify({
        errors: [
          {
            message: "Rate limit exceeded",
            code: 88,
            kind: "Permissions",
            name: "AuthorizationError",
            retry_after: 300,
          },
        ],
      }),
      processed: false,
    },
  ];

  controller.thereIsMore = true;
  await controller.indexParseTweets();

  const rateLimitInfo = await controller.isRateLimited();
  expect(rateLimitInfo.isRateLimited).toBe(true);
  expect(rateLimitInfo.rateLimitReset).toBeGreaterThanOrEqual(now + 290);
  expect(rateLimitInfo.rateLimitReset).toBeLessThanOrEqual(now + 310);

  // A rate limit is not the end of the timeline.
  expect(await controller.indexIsThereMore()).toBe(true);
});

test("indexParseTweets() reads the rate limit reset from the response headers", async () => {
  mitmController.responseData = [
    {
      host: "x.com",
      url: `${LIKES_URL}variables=%7B%7D`,
      status: 200,
      requestBody: "",
      responseHeaders: { "x-rate-limit-reset": "1789429535" },
      responseBody: JSON.stringify({
        errors: [{ message: "Rate limit exceeded", code: 88 }],
      }),
      processed: false,
    },
  ];

  await controller.indexParseTweets();

  const rateLimitInfo = await controller.isRateLimited();
  expect(rateLimitInfo.isRateLimited).toBe(true);
  expect(rateLimitInfo.rateLimitReset).toBe(1789429535);
});

test("indexParseTweets() saves the rest when one entry cannot be read", async () => {
  // No fixture can show a retweet whose original was deleted — the entry is
  // simply gone from the timeline (findings 5). What that would cost, if X
  // ever returns one Cyd cannot read, is the rest of the archive. It does not.
  const body = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "testdata",
        "x",
        "XUserOriginalsTimeline_20260914_1.json",
      ),
      "utf8",
    ),
  );
  const entries = body.data.user.result.timeline.timeline.instructions.find(
    (instruction: { type: string }) => instruction.type == "TimelineAddEntries",
  ).entries;
  const unreadable = entries.find((entry: { entryId: string }) =>
    entry.entryId.startsWith("tweet-"),
  );
  delete unreadable.content.itemContent.tweet_results.result.legacy;

  mitmController.responseData = [
    {
      host: "x.com",
      url: USER_ORIGINALS_URL,
      status: 200,
      requestBody: "",
      responseHeaders: {},
      responseBody: JSON.stringify(body),
      processed: false,
    },
  ];
  saveAsAccount("snowyfoxmatch");

  await controller.indexParseTweets();

  expect(countRows()).toBe(19);
  const stats = await controller.indexTimelineStats();
  expect(stats.tweetEntries).toBe(20);
  expect(stats.tweetsSaved).toBe(19);
});
