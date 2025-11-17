import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import { exec } from "../../../database";
import {
  emptyXDatabaseStats,
  emptyXDeleteReviewStats,
  type XTweetItem,
} from "../../../shared_types";
import { getDatabaseStats } from "../../controller/stats/getDatabaseStats";
import { getDeleteReviewStats } from "../../controller/stats/getDeleteReviewStats";
import { getProgressInfo } from "../../controller/stats/getProgressInfo";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";
import { seedTweet } from "../fixtures/tweetFactory";
import type { XAccountController } from "../../x_account_controller";

async function seedStatsFixtures(controller: XAccountController) {
  seedTweet(controller, { tweetID: "tweet-active" });
  seedTweet(controller, {
    tweetID: "tweet-archived",
    archivedAt: new Date().toISOString(),
  });
  seedTweet(controller, {
    tweetID: "tweet-deleted",
    deletedTweetAt: new Date().toISOString(),
  });
  seedTweet(controller, { tweetID: "bookmark-active", isBookmarked: 1 });
  seedTweet(controller, {
    tweetID: "bookmark-deleted",
    isBookmarked: 1,
    deletedBookmarkAt: new Date().toISOString(),
  });
  seedTweet(controller, { tweetID: "retweet-active", text: "RT @someone" });
  seedTweet(controller, {
    tweetID: "retweet-deleted",
    text: "RT @someone else",
    deletedRetweetAt: new Date().toISOString(),
  });
  seedTweet(controller, {
    tweetID: "like-active",
    username: controller.account!.username,
    isLiked: 1,
  });
  seedTweet(controller, {
    tweetID: "like-deleted",
    username: controller.account!.username,
    isLiked: 1,
    deletedLikeAt: new Date().toISOString(),
  });
  seedTweet(controller, {
    tweetID: "unknown",
    username: `${controller.account!.username}-other`,
  });
  const migratedTweet = seedTweet(controller, { tweetID: "migrated" });

  exec(
    controller.db!,
    "INSERT INTO tweet_bsky_migration (tweetID, atprotoURI, atprotoCID, migratedAt) VALUES (?, ?, ?, ?)",
    [migratedTweet, "at://did", "cid", new Date().toISOString()],
  );

  await controller.setConfig("totalConversationsDeleted", "6");
  await controller.setConfig("totalAccountsUnfollowed", "2");
}

describe("XAccountController - Stats", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
    vi.restoreAllMocks();
  });

  describe("getDatabaseStats", () => {
    test("aggregates tweet, retweet, like, and bookmark counts", async () => {
      const controller = controllerContext!.controller;
      await seedStatsFixtures(controller);

      const stats = await getDatabaseStats(controller);

      expect(stats).toEqual({
        tweetsSaved: 6,
        tweetsDeleted: 1,
        retweetsSaved: 2,
        retweetsDeleted: 1,
        likesSaved: 2,
        likesDeleted: 1,
        bookmarksSaved: 2,
        bookmarksDeleted: 1,
        conversationsDeleted: 6,
        accountsUnfollowed: 2,
        tweetsMigratedToBluesky: 1,
      });
    });

    test("returns empty stats when no account is loaded", async () => {
      const controller = controllerContext!.controller;
      controller.account = null;

      const stats = await getDatabaseStats(controller);

      expect(stats).toEqual(emptyXDatabaseStats());
    });
  });

  describe("getDeleteReviewStats", () => {
    test("summarizes delete start responses", async () => {
      const controller = controllerContext!.controller;

      vi.spyOn(controller, "deleteTweetsStart").mockResolvedValue({
        tweets: [{ id: "1" }, { id: "2" }] as unknown as XTweetItem[],
      });
      vi.spyOn(controller, "deleteRetweetsStart").mockResolvedValue({
        tweets: [{ id: "3" }] as unknown as XTweetItem[],
      });
      vi.spyOn(controller, "deleteLikesStart").mockResolvedValue({
        tweets: [
          { id: "4" },
          { id: "5" },
          { id: "6" },
        ] as unknown as XTweetItem[],
      });
      vi.spyOn(controller, "deleteBookmarksStart").mockResolvedValue({
        tweets: [] as unknown as XTweetItem[],
      });

      const stats = await getDeleteReviewStats(controller);

      expect(stats).toEqual({
        tweetsToDelete: 2,
        retweetsToDelete: 1,
        likesToDelete: 3,
        bookmarksToDelete: 0,
      });
    });

    test("returns zeroed stats when account missing", async () => {
      const controller = controllerContext!.controller;
      controller.account = null;

      const stats = await getDeleteReviewStats(controller);

      expect(stats).toEqual(emptyXDeleteReviewStats());
    });
  });

  describe("getProgressInfo", () => {
    test("reports totals across tweet states", async () => {
      const controller = controllerContext!.controller;
      await seedStatsFixtures(controller);

      const progress = await getProgressInfo(controller);

      expect(progress.accountUUID).toBe(controller.accountUUID);
      expect(progress.totalTweetsIndexed).toBe(6);
      expect(progress.totalTweetsArchived).toBe(1);
      expect(progress.totalRetweetsIndexed).toBe(2);
      expect(progress.totalLikesIndexed).toBe(2);
      expect(progress.totalBookmarksIndexed).toBe(2);
      expect(progress.totalUnknownIndexed).toBe(1);
      expect(progress.totalTweetsDeleted).toBe(1);
      expect(progress.totalRetweetsDeleted).toBe(1);
      expect(progress.totalLikesDeleted).toBe(1);
      expect(progress.totalBookmarksDeleted).toBe(1);
      expect(progress.totalConversationsDeleted).toBe(6);
      expect(progress.totalAccountsUnfollowed).toBe(2);
      expect(progress.totalTweetsMigratedToBluesky).toBe(1);
    });
  });
});
