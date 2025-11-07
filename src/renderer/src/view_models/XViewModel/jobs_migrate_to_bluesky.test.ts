import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as MigrateBluesky from "./jobs_migrate_to_bluesky";
import { RunJobsState } from "./types";
import { PlausibleEvents } from "../../types";
import type { XTweetItem } from "../../../../shared_types";
import { emptyXMigrateTweetCounts } from "../../../../shared_types";
import { mockElectronAPI, resetElectronAPIMocks } from "../../test_util";
import { createMockXViewModel, createMockTweetItem } from "./test_util";

// Mock the rate_limit module
vi.mock("./rate_limit", () => ({
  waitForRateLimit: vi.fn().mockResolvedValue(undefined),
}));

// Mock the helpers module
vi.mock("./helpers", () => ({
  finishJob: vi.fn().mockResolvedValue(undefined),
  syncProgress: vi.fn().mockResolvedValue(undefined),
}));

describe("jobs_migrate_to_bluesky.ts", () => {
  let vm: ReturnType<typeof createMockXViewModel>;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel();
  });

  afterEach(() => {
    resetElectronAPIMocks();
  });

  describe("runJobMigrateBluesky", () => {
    it("should track analytics event on start", async () => {
      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_MIGRATE_BLUESKY,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(vm.showBrowser).toBe(false);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toBe("# I'm migrating your tweets to Bluesky.");
    });

    it("should set runJobsState to MigrateBluesky", async () => {
      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.MigrateBluesky);
    });

    it("should reset rate limit info before starting", async () => {
      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(mockElectron.X.resetRateLimitInfo).toHaveBeenCalledWith(1);
    });

    it("should get tweet counts from electron API", async () => {
      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(mockElectron.X.blueskyGetTweetCounts).toHaveBeenCalledWith(1);
    });

    it("should initialize progress with correct values", async () => {
      const mockTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
        createMockTweetItem({ id: "3", t: "Tweet 3" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        toMigrateTweets: mockTweets,
      });

      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(vm.progress.totalTweetsToMigrate).toBe(3);
      expect(vm.progress.migrateTweetsCount).toBe(3);
      expect(vm.progress.migrateSkippedTweetsCount).toBe(0);
      expect(vm.progress.migrateSkippedTweetsErrors).toEqual({});
    });

    it("should reset currentTweetItem to null", async () => {
      vm.currentTweetItem = createMockTweetItem({ id: "old" });

      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(vm.currentTweetItem).toBe(null);
    });

    it("should migrate all tweets successfully", async () => {
      const mockTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        toMigrateTweets: mockTweets,
      });

      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(mockElectron.X.blueskyMigrateTweet).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.blueskyMigrateTweet).toHaveBeenCalledWith(1, "1");
      expect(mockElectron.X.blueskyMigrateTweet).toHaveBeenCalledWith(1, "2");
      expect(vm.progress.migrateTweetsCount).toBe(2);
    });

    it("should handle empty tweet list", async () => {
      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue(
        emptyXMigrateTweetCounts(),
      );

      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(mockElectron.X.blueskyMigrateTweet).not.toHaveBeenCalled();
      expect(vm.progress.totalTweetsToMigrate).toBe(0);
    });

    it("should set currentTweetItem for each tweet during migration", async () => {
      const mockTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        toMigrateTweets: mockTweets,
      });

      let currentTweetDuringMigration: XTweetItem | null = null;
      mockElectron.X.blueskyMigrateTweet.mockImplementation(() => {
        currentTweetDuringMigration = vm.currentTweetItem;
        return Promise.resolve(true);
      });

      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(currentTweetDuringMigration).toBeTruthy();
      // currentTweetItem is NOT reset to null after the loop, it stays at the last tweet
      expect(vm.currentTweetItem).toEqual(mockTweets[1]);
    });

    it("should handle migration errors by tracking skipped tweets", async () => {
      const mockTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
        createMockTweetItem({ id: "3", t: "Tweet 3" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        toMigrateTweets: mockTweets,
      });

      // The implementation expects string errors, not rejected promises
      mockElectron.X.blueskyMigrateTweet
        .mockResolvedValueOnce(true) // Success
        .mockResolvedValueOnce("Failed to migrate") // Error (string)
        .mockResolvedValueOnce(true); // Success

      await MigrateBluesky.runJobMigrateBluesky(vm, 0);

      expect(vm.progress.migrateTweetsCount).toBe(2);
      expect(vm.progress.migrateSkippedTweetsCount).toBe(1);
      expect(vm.progress.migrateSkippedTweetsErrors["2"]).toBe(
        "Failed to migrate",
      );
    });

    it("should call finishJob with correct job ID", async () => {
      const { finishJob } = await import("./helpers");

      await MigrateBluesky.runJobMigrateBluesky(vm, 42);

      expect(finishJob).toHaveBeenCalledWith(vm, 42);
    });
  });

  describe("runJobMigrateBlueskyDelete", () => {
    it("should track analytics event on start", async () => {
      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_MIGRATE_BLUESKY_DELETE,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(vm.showBrowser).toBe(false);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toBe(
        "# I'm deleting your posts from Bluesky that you migrated from X.",
      );
    });

    it("should set runJobsState to MigrateBlueskyDelete", async () => {
      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.MigrateBlueskyDelete);
    });

    it("should get migrated tweet counts from electron API", async () => {
      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(mockElectron.X.blueskyGetTweetCounts).toHaveBeenCalledWith(1);
    });

    it("should initialize progress with correct values", async () => {
      const mockMigratedTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
        createMockTweetItem({ id: "3", t: "Tweet 3" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        alreadyMigratedTweets: mockMigratedTweets,
      });

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(vm.progress.totalMigratedPostsToDelete).toBe(3);
      expect(vm.progress.migrateDeletePostsCount).toBe(3);
      expect(vm.progress.migrateDeleteSkippedPostsCount).toBe(0);
      expect(vm.progress.migrateSkippedTweetsErrors).toEqual({});
    });

    it("should reset currentTweetItem to null", async () => {
      vm.currentTweetItem = createMockTweetItem({ id: "old" });

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(vm.currentTweetItem).toBe(null);
    });

    it("should delete all migrated tweets successfully", async () => {
      const mockMigratedTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        alreadyMigratedTweets: mockMigratedTweets,
      });

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(mockElectron.X.blueskyDeleteMigratedTweet).toHaveBeenCalledTimes(
        2,
      );
      expect(mockElectron.X.blueskyDeleteMigratedTweet).toHaveBeenCalledWith(
        1,
        "1",
      );
      expect(mockElectron.X.blueskyDeleteMigratedTweet).toHaveBeenCalledWith(
        1,
        "2",
      );
      expect(vm.progress.migrateDeletePostsCount).toBe(2);
    });

    it("should handle empty migrated tweet list", async () => {
      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue(
        emptyXMigrateTweetCounts(),
      );

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(mockElectron.X.blueskyDeleteMigratedTweet).not.toHaveBeenCalled();
      expect(vm.progress.totalMigratedPostsToDelete).toBe(0);
    });

    it("should set currentTweetItem for each tweet during deletion", async () => {
      const mockMigratedTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        alreadyMigratedTweets: mockMigratedTweets,
      });

      let currentTweetDuringDeletion: XTweetItem | null = null;
      mockElectron.X.blueskyDeleteMigratedTweet.mockImplementation(() => {
        currentTweetDuringDeletion = vm.currentTweetItem;
        return Promise.resolve(true);
      });

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(currentTweetDuringDeletion).toBeTruthy();
      expect(vm.currentTweetItem).toEqual(mockMigratedTweets[1]);
    });

    it("should handle deletion errors by tracking skipped posts", async () => {
      const mockMigratedTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
        createMockTweetItem({ id: "3", t: "Tweet 3" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        alreadyMigratedTweets: mockMigratedTweets,
      });

      mockElectron.X.blueskyDeleteMigratedTweet
        .mockResolvedValueOnce(true) // Success
        .mockResolvedValueOnce("Failed to delete") // Error (string)
        .mockResolvedValueOnce(true); // Success

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(vm.progress.migrateDeletePostsCount).toBe(2);
      expect(vm.progress.migrateDeleteSkippedPostsCount).toBe(1);
      expect(vm.progress.migrateSkippedTweetsErrors["2"]).toBe(
        "Failed to delete",
      );
    });

    it("should handle rate limits and retry", async () => {
      const { waitForRateLimit } = await import("./rate_limit");
      const mockMigratedTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        alreadyMigratedTweets: mockMigratedTweets,
      });

      // First attempt: rate limited, second attempt: success
      mockElectron.X.blueskyDeleteMigratedTweet
        .mockResolvedValueOnce("Rate limited") // Rate limit error
        .mockResolvedValueOnce(true); // Success after retry

      mockElectron.X.isRateLimited
        .mockResolvedValueOnce({
          isRateLimited: true,
          rateLimitReset: Date.now() + 60000,
        })
        .mockResolvedValueOnce({
          isRateLimited: false,
          rateLimitReset: 0,
        });

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(waitForRateLimit).toHaveBeenCalledWith(vm);
      expect(mockElectron.X.resetRateLimitInfo).toHaveBeenCalled();
      expect(vm.progress.migrateDeletePostsCount).toBe(1);
      expect(vm.progress.migrateDeleteSkippedPostsCount).toBe(0);
    });

    it("should emit database stats update after each deletion", async () => {
      const mockMigratedTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        alreadyMigratedTweets: mockMigratedTweets,
      });

      const emitSpy = vi.spyOn(vm.emitter!, "emit");

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(emitSpy).toHaveBeenCalledWith("x-update-database-stats-1");
      // Should be called for each tweet
      expect(emitSpy).toHaveBeenCalledTimes(3); // 2 tweets + 1 submit-progress
    });

    it("should emit submit progress event at the end", async () => {
      const emitSpy = vi.spyOn(vm.emitter!, "emit");

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(emitSpy).toHaveBeenCalledWith("x-submit-progress-1");
    });

    it("should wait for pause after each deletion", async () => {
      const mockMigratedTweets = [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
      ];

      mockElectron.X.blueskyGetTweetCounts.mockResolvedValue({
        ...emptyXMigrateTweetCounts(),
        alreadyMigratedTweets: mockMigratedTweets,
      });

      const waitForPauseSpy = vi.spyOn(vm, "waitForPause");

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      // Should be called for each tweet
      expect(waitForPauseSpy).toHaveBeenCalledTimes(2);
    });

    it("should call finishJob with correct job ID", async () => {
      const { finishJob } = await import("./helpers");

      await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 42);

      expect(finishJob).toHaveBeenCalledWith(vm, 42);
    });

    it("should return true when complete", async () => {
      const result = await MigrateBluesky.runJobMigrateBlueskyDelete(vm, 0);

      expect(result).toBe(true);
    });
  });
});
