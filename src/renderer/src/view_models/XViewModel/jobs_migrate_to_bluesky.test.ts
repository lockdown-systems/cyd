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
});
