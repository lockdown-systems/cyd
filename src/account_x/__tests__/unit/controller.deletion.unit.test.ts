import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import type { XAccountController } from "../../x_account_controller";
import { exec } from "../../../database";
import { getTimestampDaysAgo } from "../../../util";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";
import { seedTweet } from "../fixtures/tweetFactory";
import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";

// Mock the util module with unique paths per test run
const pathMocks = createPlatformPathMocks("deletion");

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
    pathMocks.cleanup();
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

    test("only returns tweets containing the filter text when enabled", async () => {
      controller.account!.deleteTweetsFilterEnabled = true;
      controller.account!.deleteTweetsFilterText = "@Someone";

      seedTweet(controller, {
        tweetID: "mentions",
        text: "hey @someone look at this",
      });
      seedTweet(controller, {
        tweetID: "reply",
        text: "@SOMEONE no way",
      });
      seedTweet(controller, {
        tweetID: "unrelated",
        text: "nothing to see here",
      });
      seedTweet(controller, {
        tweetID: "retweet-of-them",
        text: "RT @someone: their post",
      });

      const result = await controller.deleteTweetsStart();
      const ids = result.tweets.map((tweet) => tweet.id).sort();

      expect(ids).toEqual(["mentions", "reply"]);
    });

    test("matches whole words only, and a star matches the rest of a word", async () => {
      seedTweet(controller, {
        tweetID: "hashtag",
        text: "#Coffee - Fresh Cup",
      });
      seedTweet(controller, { tweetID: "bot", text: "@CoffeeBot hello" });
      seedTweet(controller, { tweetID: "glued", text: "coffeeTHIS" });
      seedTweet(controller, { tweetID: "other", text: "nothing here" });

      controller.account!.deleteTweetsFilterEnabled = true;
      controller.account!.deleteTweetsFilterText = "Coffee";
      const whole = await controller.deleteTweetsStart();
      expect(whole.tweets.map((tweet) => tweet.id)).toEqual(["hashtag"]);

      controller.account!.deleteTweetsFilterText = "Coffee*";
      const starred = await controller.deleteTweetsStart();
      expect(starred.tweets.map((tweet) => tweet.id).sort()).toEqual([
        "bot",
        "glued",
        "hashtag",
      ]);
    });

    test("does not filter at all for stars alone", async () => {
      seedTweet(controller, { tweetID: "a", text: "one" });
      seedTweet(controller, { tweetID: "b", text: "two" });

      controller.account!.deleteTweetsFilterEnabled = true;
      controller.account!.deleteTweetsFilterText = "*";
      const result = await controller.deleteTweetsStart();

      // The page never lets this through, so it must at least not be treated
      // as a filter that matches a particular post
      expect(result.tweets.length).toBe(2);
    });

    test("treats LIKE wildcards in the filter text literally", async () => {
      controller.account!.deleteTweetsFilterEnabled = true;
      controller.account!.deleteTweetsFilterText = "100%";

      seedTweet(controller, { tweetID: "literal", text: "I am 100% sure" });
      seedTweet(controller, { tweetID: "not-literal", text: "100 percent" });

      const result = await controller.deleteTweetsStart();
      const ids = result.tweets.map((tweet) => tweet.id);

      expect(ids).toEqual(["literal"]);
    });

    test("ignores the filter text when the filter is disabled", async () => {
      controller.account!.deleteTweetsFilterEnabled = false;
      controller.account!.deleteTweetsFilterText = "@someone";

      seedTweet(controller, { tweetID: "a", text: "@someone hi" });
      seedTweet(controller, { tweetID: "b", text: "unrelated" });

      const result = await controller.deleteTweetsStart();

      expect(result.tweets.length).toBe(2);
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

    test("only returns retweets containing the filter text when enabled", async () => {
      controller.account!.deleteRetweetsFilterEnabled = true;
      controller.account!.deleteRetweetsFilterText = "@someone";

      seedTweet(controller, {
        tweetID: "retweet-of-them",
        text: "RT @Someone: their post",
      });
      seedTweet(controller, {
        tweetID: "retweet-mentioning-them",
        text: "RT @other: cc @someone",
      });
      seedTweet(controller, {
        tweetID: "other-retweet",
        text: "RT @other: unrelated",
      });
      seedTweet(controller, {
        tweetID: "regular-tweet",
        text: "@someone not a retweet",
      });

      const result = await controller.deleteRetweetsStart();
      const ids = result.tweets.map((tweet) => tweet.id).sort();

      expect(ids).toEqual(["retweet-mentioning-them", "retweet-of-them"]);
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

    test("applies the contains filter when total=false but not when total=true", async () => {
      controller.account!.deleteTweetsFilterEnabled = true;
      controller.account!.deleteTweetsFilterText = "butter";

      seedTweet(controller, { tweetID: "match", text: "butter is great" });
      seedTweet(controller, { tweetID: "no-match", text: "margarine is fine" });

      expect(await controller.deleteTweetsCountNotArchived(false)).toBe(1);
      expect(await controller.deleteTweetsCountNotArchived(true)).toBe(2);
    });
  });
});
