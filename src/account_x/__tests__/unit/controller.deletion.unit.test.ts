import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { randomUUID } from "crypto";
import { describe, test, expect, beforeEach, afterEach } from "vitest";

import type { XAccountController } from "../../x_account_controller";
import { exec } from "../../../database";
import { getTimestampDaysAgo } from "../../../util";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

type TweetSeed = {
  tweetID?: string;
  username?: string;
  text?: string;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  replyCount?: number;
  isLiked?: number;
  isRetweeted?: number;
  isBookmarked?: number;
  conversationID?: string;
  path?: string;
  addedToDatabaseAt?: string;
  archivedAt?: string | null;
  deletedTweetAt?: string | null;
  deletedRetweetAt?: string | null;
  deletedLikeAt?: string | null;
  deletedBookmarkAt?: string | null;
  hasMedia?: number;
  isReply?: number;
  replyTweetID?: string | null;
  replyUserID?: string | null;
  isQuote?: number;
  quotedTweet?: string | null;
};

type ConversationSeed = {
  conversationID: string;
  type?: string;
  addedToDatabaseAt?: string;
  deletedAt?: string | null;
};

type MessageSeed = {
  messageID: string;
  conversationID: string;
  createdAt?: string;
  senderID?: string;
  text?: string;
  deletedAt?: string | null;
};

describe("XAccountController - Deletion", () => {
  let controllerContext: XControllerTestContext | null = null;
  let controller: XAccountController;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
    controller = controllerContext.controller;
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
  });

  describe("deleteTweetsStart", () => {
    test("should return empty list when no tweets exist", async () => {
      const result = await controller.deleteTweetsStart();

      expect(result).toEqual({ tweets: [] });
    });

    test("filters tweets based on age, thresholds, and deletion state", async () => {
      controller.account!.deleteTweetsDaysOldEnabled = true;
      controller.account!.deleteTweetsDaysOld = 30;
      controller.account!.deleteTweetsLikesThresholdEnabled = true;
      controller.account!.deleteTweetsLikesThreshold = 5;
      controller.account!.deleteTweetsRetweetsThresholdEnabled = true;
      controller.account!.deleteTweetsRetweetsThreshold = 2;

      seedTweet(controller, {
        tweetID: "eligible",
        createdAt: getTimestampDaysAgo(60),
        likeCount: 1,
        retweetCount: 1,
        text: "Keep me",
      });
      seedTweet(controller, {
        tweetID: "too-new",
        createdAt: getTimestampDaysAgo(10),
      });
      seedTweet(controller, {
        tweetID: "too-many-likes",
        createdAt: getTimestampDaysAgo(60),
        likeCount: 10,
      });
      seedTweet(controller, {
        tweetID: "too-many-retweets",
        createdAt: getTimestampDaysAgo(60),
        retweetCount: 5,
      });
      seedTweet(controller, {
        tweetID: "retweet",
        createdAt: getTimestampDaysAgo(60),
        text: "RT @someone else",
      });
      seedTweet(controller, {
        tweetID: "already-deleted",
        createdAt: getTimestampDaysAgo(60),
        deletedTweetAt: new Date().toISOString(),
      });

      const result = await controller.deleteTweetsStart();
      const ids = result.tweets.map((tweet) => tweet.id).sort();

      expect(ids).toEqual(["eligible"]);
    });
  });

  describe("deleteRetweetsStart", () => {
    test("should return empty list when no retweets exist", async () => {
      const result = await controller.deleteRetweetsStart();

      expect(result).toEqual({ tweets: [] });
    });

    test("returns only undeleted retweets that meet age criteria", async () => {
      controller.account!.deleteRetweetsDaysOldEnabled = true;
      controller.account!.deleteRetweetsDaysOld = 30;

      seedTweet(controller, {
        tweetID: "old-retweet",
        text: "RT @someone old",
        createdAt: getTimestampDaysAgo(60),
      });
      seedTweet(controller, {
        tweetID: "recent-retweet",
        text: "RT @someone recent",
        createdAt: getTimestampDaysAgo(5),
      });
      seedTweet(controller, {
        tweetID: "deleted-retweet",
        text: "RT @someone deleted",
        createdAt: getTimestampDaysAgo(60),
        deletedRetweetAt: new Date().toISOString(),
      });
      seedTweet(controller, {
        tweetID: "regular-tweet",
        text: "Just a tweet",
        createdAt: getTimestampDaysAgo(60),
      });

      const result = await controller.deleteRetweetsStart();
      const ids = result.tweets.map((tweet) => tweet.id);

      expect(ids).toEqual(["old-retweet"]);
    });
  });

  describe("deleteLikesStart", () => {
    test("should return empty list when no likes exist", async () => {
      const result = await controller.deleteLikesStart();

      expect(result).toEqual({ tweets: [] });
    });

    test("returns liked tweets that have not already been deleted", async () => {
      seedTweet(controller, {
        tweetID: "liked",
        username: "other",
        isLiked: 1,
      });
      seedTweet(controller, {
        tweetID: "unliked",
        username: "other",
        isLiked: 0,
      });
      seedTweet(controller, {
        tweetID: "liked-deleted",
        username: "other",
        isLiked: 1,
        deletedLikeAt: new Date().toISOString(),
      });

      const result = await controller.deleteLikesStart();
      const ids = result.tweets.map((tweet) => tweet.id).sort();

      expect(ids).toEqual(["liked"]);
    });
  });

  describe("deleteBookmarksStart", () => {
    test("should return empty list when no bookmarks exist", async () => {
      const result = await controller.deleteBookmarksStart();

      expect(result).toEqual({ tweets: [] });
    });

    test("returns bookmarked tweets that still need action", async () => {
      seedTweet(controller, {
        tweetID: "bookmarked",
        username: "other",
        isBookmarked: 1,
      });
      seedTweet(controller, {
        tweetID: "not-bookmarked",
        username: "other",
        isBookmarked: 0,
      });
      seedTweet(controller, {
        tweetID: "bookmark-deleted",
        username: "other",
        isBookmarked: 1,
        deletedBookmarkAt: new Date().toISOString(),
      });

      const result = await controller.deleteBookmarksStart();
      const ids = result.tweets.map((tweet) => tweet.id).sort();

      expect(ids).toEqual(["bookmarked"]);
    });
  });

  describe("deleteTweet", () => {
    test.each([
      ["tweet", "deletedTweetAt"],
      ["retweet", "deletedRetweetAt"],
      ["like", "deletedLikeAt"],
      ["bookmark", "deletedBookmarkAt"],
    ])("marks %s rows as deleted", async (deleteType, column) => {
      const tweetID = seedTweet(controller, { tweetID: deleteType });

      await controller.deleteTweet(tweetID, deleteType as string);

      const row = exec(
        controller.db!,
        `SELECT ${column} as value FROM tweet WHERE tweetID = ?`,
        [tweetID],
        "get",
      ) as { value: string | null };

      expect(row.value).not.toBeNull();
    });

    test("throws for invalid delete type", async () => {
      const tweetID = seedTweet(controller, { tweetID: "unknown" });

      await expect(controller.deleteTweet(tweetID, "oops")).rejects.toThrow(
        "Invalid deleteType",
      );
    });
  });

  describe("deleteTweetsCountNotArchived", () => {
    test("counts all non-archived tweets when total=true", async () => {
      seedTweet(controller, { tweetID: "active" });
      seedTweet(controller, {
        tweetID: "archived",
        archivedAt: new Date().toISOString(),
      });
      seedTweet(controller, {
        tweetID: "deleted",
        deletedTweetAt: new Date().toISOString(),
      });
      seedTweet(controller, { tweetID: "retweet", text: "RT @someone" });

      const count = await controller.deleteTweetsCountNotArchived(true);

      expect(count).toBe(1);
    });

    test("applies age and threshold filters when total=false", async () => {
      controller.account!.deleteTweetsDaysOldEnabled = true;
      controller.account!.deleteTweetsDaysOld = 30;
      controller.account!.deleteTweetsLikesThresholdEnabled = true;
      controller.account!.deleteTweetsLikesThreshold = 5;

      seedTweet(controller, {
        tweetID: "eligible",
        createdAt: getTimestampDaysAgo(90),
        likeCount: 2,
      });
      seedTweet(controller, {
        tweetID: "too-new",
        createdAt: getTimestampDaysAgo(5),
        likeCount: 2,
      });
      seedTweet(controller, {
        tweetID: "too-many-likes",
        createdAt: getTimestampDaysAgo(90),
        likeCount: 20,
      });

      const count = await controller.deleteTweetsCountNotArchived(false);

      expect(count).toBe(1);
    });
  });

  describe("deleteDMsMarkDeleted", () => {
    test("marks a conversation and its messages as deleted", () => {
      seedConversation(controller, { conversationID: "conv1" });
      seedMessage(controller, {
        messageID: "msg1",
        conversationID: "conv1",
      });
      seedMessage(controller, {
        messageID: "msg2",
        conversationID: "conv1",
      });

      controller.deleteDMsMarkDeleted("conv1");

      const conversation = exec(
        controller.db!,
        "SELECT deletedAt FROM conversation WHERE conversationID = ?",
        ["conv1"],
        "get",
      ) as { deletedAt: string | null };
      const messages = exec(
        controller.db!,
        "SELECT messageID, deletedAt FROM message WHERE conversationID = ?",
        ["conv1"],
        "all",
      ) as { messageID: string; deletedAt: string | null }[];

      expect(conversation.deletedAt).not.toBeNull();
      expect(messages.every((message) => message.deletedAt)).toBe(true);
      expect(controller.progress.conversationsDeleted).toBe(1);
    });
  });

  describe("deleteDMsMarkAllDeleted", () => {
    test("marks every remaining conversation and message as deleted", async () => {
      seedConversation(controller, { conversationID: "conv1" });
      seedConversation(controller, { conversationID: "conv2" });
      seedConversation(controller, {
        conversationID: "conv3",
        deletedAt: new Date().toISOString(),
      });
      seedMessage(controller, {
        messageID: "msg1",
        conversationID: "conv1",
      });
      seedMessage(controller, {
        messageID: "msg2",
        conversationID: "conv2",
      });

      await controller.deleteDMsMarkAllDeleted();

      const conversations = exec(
        controller.db!,
        "SELECT conversationID, deletedAt FROM conversation",
        [],
        "all",
      ) as { conversationID: string; deletedAt: string | null }[];
      const messages = exec(
        controller.db!,
        "SELECT messageID, deletedAt FROM message",
        [],
        "all",
      ) as { messageID: string; deletedAt: string | null }[];

      expect(
        conversations.every((conversation) => conversation.deletedAt),
      ).toBe(true);
      expect(messages.every((message) => message.deletedAt)).toBe(true);
      expect(controller.progress.conversationsDeleted).toBe(2);
    });
  });
});

function seedTweet(
  controller: XAccountController,
  overrides: TweetSeed = {},
): string {
  const tweetID = overrides.tweetID ?? randomUUID();
  const now = new Date().toISOString();
  const data = {
    tweetID,
    username: controller.account!.username,
    text: "Test tweet",
    createdAt: getTimestampDaysAgo(0),
    likeCount: 0,
    retweetCount: 0,
    quoteCount: 0,
    replyCount: 0,
    isLiked: 0,
    isRetweeted: 0,
    isBookmarked: 0,
    conversationID: randomUUID(),
    path: `/tmp/${tweetID}`,
    addedToDatabaseAt: now,
    archivedAt: null,
    deletedTweetAt: null,
    deletedRetweetAt: null,
    deletedLikeAt: null,
    deletedBookmarkAt: null,
    hasMedia: 0,
    isReply: 0,
    replyTweetID: null,
    replyUserID: null,
    isQuote: 0,
    quotedTweet: null,
    ...overrides,
  };

  exec(
    controller.db!,
    `INSERT INTO tweet (
        tweetID,
        username,
        text,
        createdAt,
        likeCount,
        retweetCount,
        quoteCount,
        replyCount,
        isLiked,
        isRetweeted,
        isBookmarked,
        conversationID,
        path,
        addedToDatabaseAt,
        archivedAt,
        deletedTweetAt,
        deletedRetweetAt,
        deletedLikeAt,
        deletedBookmarkAt,
        hasMedia,
        isReply,
        replyTweetID,
        replyUserID,
        isQuote,
        quotedTweet
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.tweetID,
      data.username,
      data.text,
      data.createdAt,
      data.likeCount,
      data.retweetCount,
      data.quoteCount,
      data.replyCount,
      data.isLiked,
      data.isRetweeted,
      data.isBookmarked,
      data.conversationID,
      data.path,
      data.addedToDatabaseAt,
      data.archivedAt,
      data.deletedTweetAt,
      data.deletedRetweetAt,
      data.deletedLikeAt,
      data.deletedBookmarkAt,
      data.hasMedia,
      data.isReply,
      data.replyTweetID,
      data.replyUserID,
      data.isQuote,
      data.quotedTweet,
    ],
  );

  return data.tweetID;
}

function seedConversation(
  controller: XAccountController,
  seed: ConversationSeed,
): void {
  const now = new Date().toISOString();
  const data = {
    type: "DM",
    addedToDatabaseAt: now,
    deletedAt: null,
    ...seed,
  };

  exec(
    controller.db!,
    `INSERT INTO conversation (
        conversationID,
        type,
        sortTimestamp,
        minEntryID,
        maxEntryID,
        isTrusted,
        shouldIndexMessages,
        addedToDatabaseAt,
        updatedInDatabaseAt,
        deletedAt
    ) VALUES (?, ?, NULL, NULL, NULL, 0, 0, ?, ?, ?)`,
    [
      data.conversationID,
      data.type,
      data.addedToDatabaseAt,
      data.addedToDatabaseAt,
      data.deletedAt,
    ],
  );
}

function seedMessage(controller: XAccountController, seed: MessageSeed): void {
  const data = {
    createdAt: new Date().toISOString(),
    senderID: "sender",
    text: "Hello",
    deletedAt: null,
    ...seed,
  };

  exec(
    controller.db!,
    `INSERT INTO message (
        messageID,
        conversationID,
        createdAt,
        senderID,
        text,
        deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.messageID,
      data.conversationID,
      data.createdAt,
      data.senderID,
      data.text,
      data.deletedAt,
    ],
  );
}
