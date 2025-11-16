/**
 * Integration tests for XAccountController indexing workflows:
 * - End-to-end tweet indexing with real data
 * - Conversation and message parsing
 * - Bookmarks indexing
 * - Media and URL extraction
 * - Automation error handling
 */

import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, test, expect, vi } from "vitest";

import {
  XTweetRow,
  XTweetMediaRow,
  XTweetURLRow,
  XUserRow,
  XConversationRow,
  XConversationParticipantRow,
  XMessageRow,
} from "../../types";
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
