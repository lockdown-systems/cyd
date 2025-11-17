import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach } from "vitest";

import { exec } from "../../../database";
import { BlueskyService } from "../../controller/bluesky/BlueskyService";
import type { XAccountController } from "../../x_account_controller";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";
import { seedTweet } from "../fixtures/tweetFactory";

function createService(
  controller: XAccountController,
  accountID: number,
): BlueskyService {
  return new BlueskyService(
    controller.db!,
    controller.account!,
    accountID,
    (key) => controller.getConfig(key),
    (key, value) => controller.setConfig(key, value),
    (key) => controller.deleteConfig(key),
    (key) => controller.deleteConfigLike(key),
    (whereClause, params) =>
      controller.fetchTweetsWithMediaAndURLs(whereClause, params),
    () => controller.getMediaPath(),
    () => undefined,
  );
}

describe("BlueskyService", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
  });

  test("getTweetCounts filters replies and migrations", async () => {
    const controller = controllerContext!.controller;
    controller.account!.userID = "account-user";

    seedTweet(controller, { tweetID: "eligible" });
    seedTweet(controller, {
      tweetID: "self-reply",
      isReply: 1,
      replyUserID: "account-user",
    });
    seedTweet(controller, {
      tweetID: "other-reply",
      isReply: 1,
      replyUserID: "someone-else",
    });
    seedTweet(controller, { tweetID: "retweet", text: "RT @someone" });
    seedTweet(controller, { tweetID: "liked", isLiked: 1 });
    seedTweet(controller, {
      tweetID: "deleted",
      deletedTweetAt: new Date().toISOString(),
    });
    const alreadyMigrated = seedTweet(controller, { tweetID: "migrated" });

    exec(
      controller.db!,
      "INSERT INTO tweet_bsky_migration (tweetID, atprotoURI, atprotoCID, migratedAt) VALUES (?, ?, ?, ?)",
      [alreadyMigrated, "at://did", "cid", new Date().toISOString()],
    );

    const service = createService(controller, controllerContext!.account.id);

    const counts = await service.getTweetCounts();

    expect(counts.totalTweetsCount).toBe(5);
    expect(counts.totalRetweetsCount).toBe(1);
    expect(counts.toMigrateTweets.map((tweet) => tweet.id).sort()).toEqual([
      "deleted",
      "eligible",
      "self-reply",
    ]);
    expect(counts.cannotMigrateCount).toBe(1);
    expect(counts.alreadyMigratedTweets.map((tweet) => tweet.id)).toEqual([
      "migrated",
    ]);
  });
});
