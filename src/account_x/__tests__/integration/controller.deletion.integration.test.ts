import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, describe, test, expect } from "vitest";

import { exec } from "../../../database";
import { getTimestampDaysAgo } from "../../../util";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";
import {
  seedTweet,
  seedConversation,
  seedMessage,
} from "../fixtures/tweetFactory";

describe("XAccountController - Deletion integration", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
  });

  test("deleteTweetsStart applies date and threshold filters", async () => {
    const controller = controllerContext!.controller;
    const eligibleOld = seedTweet(controller, {
      tweetID: "eligible-old",
      createdAt: getTimestampDaysAgo(90),
    });
    const eligibleOlder = seedTweet(controller, {
      tweetID: "eligible-older",
      createdAt: getTimestampDaysAgo(60),
      likeCount: 1,
      retweetCount: 1,
    });
    seedTweet(controller, {
      tweetID: "too-new",
      createdAt: getTimestampDaysAgo(5),
    });
    seedTweet(controller, {
      tweetID: "retweet",
      text: "RT @someone",
      createdAt: getTimestampDaysAgo(90),
    });
    seedTweet(controller, {
      tweetID: "likes-too-high",
      createdAt: getTimestampDaysAgo(120),
      likeCount: 10,
    });
    seedTweet(controller, {
      tweetID: "retweets-too-high",
      createdAt: getTimestampDaysAgo(120),
      retweetCount: 5,
    });
    seedTweet(controller, {
      tweetID: "already-deleted",
      createdAt: getTimestampDaysAgo(120),
      deletedTweetAt: new Date().toISOString(),
    });
    seedTweet(controller, {
      tweetID: "other-user",
      username: "different-user",
      createdAt: getTimestampDaysAgo(120),
    });

    controller.account!.deleteTweetsDaysOldEnabled = true;
    controller.account!.deleteTweetsDaysOld = 30;
    controller.account!.deleteTweetsLikesThresholdEnabled = true;
    controller.account!.deleteTweetsLikesThreshold = 5;
    controller.account!.deleteTweetsRetweetsThresholdEnabled = true;
    controller.account!.deleteTweetsRetweetsThreshold = 2;

    const response = await controller.deleteTweetsStart();
    const ids = response.tweets.map((tweet) => tweet.id).sort();

    expect(ids).toEqual([eligibleOld, eligibleOlder].sort());
  });

  test("deleteRetweetsStart, deleteLikesStart, and deleteBookmarksStart target active items", async () => {
    const controller = controllerContext!.controller;

    const retweetOld = seedTweet(controller, {
      tweetID: "retweet-old",
      text: "RT @friend",
      createdAt: getTimestampDaysAgo(40),
    });
    seedTweet(controller, {
      tweetID: "retweet-new",
      text: "RT @friend",
      createdAt: getTimestampDaysAgo(2),
    });
    seedTweet(controller, {
      tweetID: "retweet-deleted",
      text: "RT @friend",
      deletedRetweetAt: new Date().toISOString(),
      createdAt: getTimestampDaysAgo(90),
    });

    controller.account!.deleteRetweetsDaysOldEnabled = true;
    controller.account!.deleteRetweetsDaysOld = 10;

    const retweets = await controller.deleteRetweetsStart();
    expect(retweets.tweets.map((tweet) => tweet.id)).toEqual([retweetOld]);

    const likeActive = seedTweet(controller, {
      tweetID: "like-active",
      isLiked: 1,
    });
    seedTweet(controller, {
      tweetID: "like-deleted",
      isLiked: 1,
      deletedLikeAt: new Date().toISOString(),
    });
    seedTweet(controller, { tweetID: "not-liked", isLiked: 0 });

    const likes = await controller.deleteLikesStart();
    expect(likes.tweets.map((tweet) => tweet.id)).toEqual([likeActive]);

    const bookmarkActive = seedTweet(controller, {
      tweetID: "bookmark-active",
      isBookmarked: 1,
    });
    seedTweet(controller, {
      tweetID: "bookmark-deleted",
      isBookmarked: 1,
      deletedBookmarkAt: new Date().toISOString(),
    });
    seedTweet(controller, { tweetID: "not-bookmarked", isBookmarked: 0 });

    const bookmarks = await controller.deleteBookmarksStart();
    expect(bookmarks.tweets.map((tweet) => tweet.id)).toEqual([bookmarkActive]);
  });

  test("deleteTweet updates timestamps and DM helpers mark rows deleted", async () => {
    const controller = controllerContext!.controller;

    const tweetID = seedTweet(controller, { tweetID: "tweet-delete" });
    const retweetID = seedTweet(controller, {
      tweetID: "retweet-delete",
      text: "RT @friend",
    });
    const likeID = seedTweet(controller, {
      tweetID: "like-delete",
      isLiked: 1,
    });
    const bookmarkID = seedTweet(controller, {
      tweetID: "bookmark-delete",
      isBookmarked: 1,
    });

    await controller.deleteTweet(tweetID, "tweet");
    await controller.deleteTweet(retweetID, "retweet");
    await controller.deleteTweet(likeID, "like");
    await controller.deleteTweet(bookmarkID, "bookmark");

    const tweetTimestamps = exec(
      controller.db!,
      `SELECT tweetID, deletedTweetAt, deletedRetweetAt, deletedLikeAt, deletedBookmarkAt
       FROM tweet WHERE tweetID IN (?, ?, ?, ?)`,
      [tweetID, retweetID, likeID, bookmarkID],
      "all",
    ) as {
      tweetID: string;
      deletedTweetAt: string | null;
      deletedRetweetAt: string | null;
      deletedLikeAt: string | null;
      deletedBookmarkAt: string | null;
    }[];
    const rowByID = Object.fromEntries(
      tweetTimestamps.map((row) => [row.tweetID, row]),
    );

    expect(rowByID[tweetID].deletedTweetAt).not.toBeNull();
    expect(rowByID[tweetID].deletedRetweetAt).toBeNull();
    expect(rowByID[retweetID].deletedRetweetAt).not.toBeNull();
    expect(rowByID[likeID].deletedLikeAt).not.toBeNull();
    expect(rowByID[bookmarkID].deletedBookmarkAt).not.toBeNull();

    const conversationID = "conversation-1";
    const otherConversationID = "conversation-2";
    seedConversation(controller, { conversationID });
    seedConversation(controller, { conversationID: otherConversationID });
    seedMessage(controller, { messageID: "msg-1", conversationID });
    seedMessage(controller, { messageID: "msg-2", conversationID });
    seedMessage(controller, {
      messageID: "msg-3",
      conversationID: otherConversationID,
    });

    controller.deleteDMsMarkDeleted(conversationID);

    let conversationRows = exec(
      controller.db!,
      "SELECT conversationID, deletedAt FROM conversation",
      [],
      "all",
    ) as { conversationID: string; deletedAt: string | null }[];
    let messageRows = exec(
      controller.db!,
      "SELECT messageID, conversationID, deletedAt FROM message",
      [],
      "all",
    ) as {
      messageID: string;
      conversationID: string;
      deletedAt: string | null;
    }[];

    const convByID = Object.fromEntries(
      conversationRows.map((row) => [row.conversationID, row]),
    );
    const messagesByID = Object.fromEntries(
      messageRows.map((row) => [row.messageID, row]),
    );

    expect(convByID[conversationID].deletedAt).not.toBeNull();
    expect(convByID[otherConversationID].deletedAt).toBeNull();
    expect(messagesByID["msg-1"].deletedAt).not.toBeNull();
    expect(messagesByID["msg-2"].deletedAt).not.toBeNull();
    expect(messagesByID["msg-3"].deletedAt).toBeNull();
    expect(controller.progress.conversationsDeleted).toBe(1);

    await controller.deleteDMsMarkAllDeleted();

    conversationRows = exec(
      controller.db!,
      "SELECT conversationID, deletedAt FROM conversation",
      [],
      "all",
    ) as { conversationID: string; deletedAt: string | null }[];
    messageRows = exec(
      controller.db!,
      "SELECT messageID, conversationID, deletedAt FROM message",
      [],
      "all",
    ) as {
      messageID: string;
      conversationID: string;
      deletedAt: string | null;
    }[];

    const updatedConvByID = Object.fromEntries(
      conversationRows.map((row) => [row.conversationID, row]),
    );
    const updatedMessagesByID = Object.fromEntries(
      messageRows.map((row) => [row.messageID, row]),
    );

    expect(updatedConvByID[otherConversationID].deletedAt).not.toBeNull();
    expect(updatedMessagesByID["msg-3"].deletedAt).not.toBeNull();
    expect(controller.progress.conversationsDeleted).toBe(2);
  });
});
