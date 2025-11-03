import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as DeleteJobs from "./jobs_delete";
import { PlausibleEvents } from "../../types";
import { TimeoutError, URLChangedError } from "../BaseViewModel";
import type { XDeleteTweetsStartResponse } from "../../../../shared_types";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../test_util";
import { createMockXViewModel, createMockTweetItem } from "./test_util";

// Mock the helpers module
vi.mock("./helpers", () => ({
  finishJob: vi.fn().mockResolvedValue(undefined),
  syncProgress: vi.fn().mockResolvedValue(undefined),
}));

describe.skip("jobs_delete.ts", () => {
  let vm: ReturnType<typeof createMockXViewModel>;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    // Add spies for methods used by delete jobs
    vi.spyOn(vm, "loadURLWithRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
    vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);
    vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);
    vi.spyOn(vm, "syncProgress").mockResolvedValue(undefined);
    vi.spyOn(vm, "finishJob").mockResolvedValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
    vi.spyOn(vm, "log").mockReturnValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
  });

  describe("deleteDMsLoadDMsPage", () => {
    it("should load messages page", async () => {
      await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/messages",
      );
    });

    it("should wait for search text field", async () => {
      await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'section input[type="text"]',
        "https://x.com/messages",
        30000,
      );
    });

    it("should wait for conversation list", async () => {
      await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'section div div[role="tablist"] div[data-testid="cellInnerDiv"]',
        "https://x.com/messages",
      );
    });

    it("should return false and mark as finished when no conversations exist (no search field)", async () => {
      // Make the first waitForSelector throw timeout error (no search field)
      vi.spyOn(vm, "waitForSelector").mockRejectedValueOnce(
        new TimeoutError("test-selector"),
      );

      const result = await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(result).toBe(false);
      expect(vm.progress.isDeleteDMsFinished).toBe(true);
      expect(vm.syncProgress).toHaveBeenCalled();
    });

    it("should return false and mark as finished when selector times out (no conversations)", async () => {
      // First call succeeds (search field exists), second call times out (no conversations)
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new TimeoutError("test-selector"));

      const result = await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(result).toBe(false);
      expect(vm.progress.isDeleteDMsFinished).toBe(true);
    });

    it("should handle rate limits and retry", async () => {
      // First call succeeds, second call times out with rate limit
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new TimeoutError("test-selector"))
        .mockResolvedValueOnce(undefined);

      mockElectron.X.isRateLimited
        .mockResolvedValueOnce({
          isRateLimited: true,
          rateLimitReset: Date.now() + 60000,
        })
        .mockResolvedValueOnce({
          isRateLimited: false,
          rateLimitReset: 0,
        });

      const result = await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle URL changed error", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(
          new URLChangedError("https://x.com/old", "https://x.com/new"),
        )
        .mockResolvedValueOnce(undefined);

      const result = await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(vm.sleep).toHaveBeenCalledWith(1000);
      expect(result).toBe(false);
    });

    it("should return true and log error after 3 failed attempts", async () => {
      let callCount = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(() => {
        callCount++;
        // Odd calls are for search field (succeed), even calls are for conversation list (fail)
        if (callCount % 2 === 1) {
          return Promise.resolve(undefined);
        } else {
          return Promise.reject(new Error("Test error"));
        }
      });

      const result = await DeleteJobs.deleteDMsLoadDMsPage(vm);

      expect(result).toBe(true);
      expect(vm.error).toHaveBeenCalled();
    });
  });

  describe("unfollowEveryoneLoadPage", () => {
    it("should load following page with correct username", async () => {
      await DeleteJobs.unfollowEveryoneLoadPage(vm);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/testuser/following",
      );
    });

    it("should wait for following users to appear", async () => {
      await DeleteJobs.unfollowEveryoneLoadPage(vm);

      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'div[data-testid="cellInnerDiv"] button button',
        "https://x.com/testuser/following",
        2000,
      );
    });

    it("should return false and mark as finished when no following users exist", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      const result = await DeleteJobs.unfollowEveryoneLoadPage(vm);

      expect(result).toBe(false);
      expect(vm.progress.isUnfollowEveryoneFinished).toBe(true);
    });

    it("should handle rate limits", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockRejectedValueOnce(new TimeoutError("test-selector"))
        .mockResolvedValueOnce(undefined);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 60000,
      });

      const result = await DeleteJobs.unfollowEveryoneLoadPage(vm);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should return true and log error after 3 failed attempts", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new Error("Test error"),
      );

      const result = await DeleteJobs.unfollowEveryoneLoadPage(vm);

      expect(result).toBe(true);
      expect(vm.error).toHaveBeenCalled();
    });
  });

  describe("runJobDeleteTweets", () => {
    const mockTweets: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "1", t: "Tweet 1" }),
        createMockTweetItem({ id: "2", t: "Tweet 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_TWEETS,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should set correct UI state", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.instructions).toBe(
        `# I'm deleting your tweets based on your criteria, starting with the earliest.`,
      );
    });

    it("should get tweets to delete from electron API", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(mockElectron.X.deleteTweetsStart).toHaveBeenCalledWith(1);
    });

    it("should handle error when failing to start", async () => {
      mockElectron.X.deleteTweetsStart.mockRejectedValueOnce(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should initialize progress with correct values", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockTweets);

      // We need to check the progress AFTER it's initialized but BEFORE tweets are deleted
      let progressCaptured = false;
      let capturedProgress: typeof vm.progress | undefined;
      vi.spyOn(vm, "graphqlDelete").mockImplementation(() => {
        if (!progressCaptured) {
          capturedProgress = { ...vm.progress };
          progressCaptured = true;
        }
        return Promise.resolve(200);
      });

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(capturedProgress?.totalTweetsToDelete).toBe(2);
      expect(capturedProgress?.tweetsDeleted).toBe(0);
      expect(capturedProgress?.tweetsArchived).toBe(0);
      expect(capturedProgress?.newTweetsArchived).toBe(0);
    });

    it("should load replies page", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/testuser/with_replies",
      );
    });

    it("should show browser initially then hide it", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.showBrowser).toBe(false);
      expect(vm.showAutomationNotice).toBe(true);
    });

    it("should get ct0 cookie", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(mockElectron.X.getCookie).toHaveBeenCalledWith(1, "x.com", "ct0");
    });

    it("should handle missing ct0 cookie", async () => {
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should delete all tweets successfully", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockTweets);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "1", "tweet");
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "2", "tweet");
    });

    it("should update progress after each deletion", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockTweets);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.progress.tweetsDeleted).toBe(2);
      expect(vm.syncProgress).toHaveBeenCalled();
    });

    it("should handle rate limits (429 status) and retry", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue({
        tweets: [mockTweets.tweets[0]],
      });

      // First call returns 429, second returns 200
      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 60000,
      });

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(vm.progress.tweetsDeleted).toBe(1);
    });

    it("should retry up to 3 times on non-rate-limit failures", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue({
        tweets: [mockTweets.tweets[0]],
      });

      // Return error status 3 times
      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(3);
      expect(vm.sleep).toHaveBeenCalledWith(1000);
      expect(vm.error).toHaveBeenCalled();
      expect(vm.progress.errorsOccured).toBe(1);
    });

    it("should wait for pause after each tweet", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockTweets);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.waitForPause).toHaveBeenCalledTimes(2);
    });

    it("should set currentTweetItem during deletion", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue({
        tweets: [mockTweets.tweets[0]],
      });

      let capturedTweetItem = null;
      vi.spyOn(vm, "graphqlDelete").mockImplementation(() => {
        capturedTweetItem = vm.currentTweetItem;
        return Promise.resolve(200);
      });

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(capturedTweetItem).toEqual(mockTweets.tweets[0]);
    });

    it("should finish job after completion", async () => {
      await DeleteJobs.runJobDeleteTweets(vm, 5);

      expect(vm.finishJob).toHaveBeenCalledWith(5);
    });

    it("should handle error when updating delete timestamp fails", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue({
        tweets: [mockTweets.tweets[0]],
      });

      mockElectron.X.deleteTweet.mockRejectedValueOnce(
        new Error("Database error"),
      );

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });
  });

  describe("runJobDeleteRetweets", () => {
    const mockRetweets: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "1", t: "Retweet 1" }),
        createMockTweetItem({ id: "2", t: "Retweet 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_RETWEETS,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should handle error when failing to start", async () => {
      mockElectron.X.deleteRetweetsStart.mockRejectedValueOnce(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should initialize progress correctly", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue(mockRetweets);

      let progressCaptured = false;
      let capturedProgress: typeof vm.progress | undefined;
      vi.spyOn(vm, "graphqlDelete").mockImplementation(() => {
        if (!progressCaptured) {
          capturedProgress = { ...vm.progress };
          progressCaptured = true;
        }
        return Promise.resolve(200);
      });

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(capturedProgress?.totalRetweetsToDelete).toBe(2);
      expect(capturedProgress?.retweetsDeleted).toBe(0);
    });

    it("should delete all retweets successfully", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue(mockRetweets);

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "1",
        "retweet",
      );
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "2",
        "retweet",
      );
    });

    it("should handle rate limits (429) and retry", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue({
        tweets: [mockRetweets.tweets[0]],
      });

      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 60000,
      });

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(vm.progress.retweetsDeleted).toBe(1);
    });

    it("should retry up to 3 times on non-rate-limit failures", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue({
        tweets: [mockRetweets.tweets[0]],
      });

      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(3);
      expect(vm.sleep).toHaveBeenCalledWith(1000);
      expect(vm.error).toHaveBeenCalled();
      expect(vm.progress.errorsOccured).toBe(1);
    });

    it("should handle error when updating delete timestamp fails", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue({
        tweets: [mockRetweets.tweets[0]],
      });

      mockElectron.X.deleteTweet.mockRejectedValueOnce(
        new Error("Database error"),
      );

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should get ct0 cookie", async () => {
      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(mockElectron.X.getCookie).toHaveBeenCalledWith(1, "x.com", "ct0");
    });

    it("should handle missing ct0 cookie", async () => {
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should finish job after completion", async () => {
      await DeleteJobs.runJobDeleteRetweets(vm, 5);

      expect(vm.finishJob).toHaveBeenCalledWith(5);
    });
  });

  describe("runJobDeleteLikes", () => {
    const mockLikes: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "1", t: "Like 1" }),
        createMockTweetItem({ id: "2", t: "Like 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_LIKES,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should handle error when failing to start", async () => {
      mockElectron.X.deleteLikesStart.mockRejectedValueOnce(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should initialize progress correctly", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue(mockLikes);

      let progressCaptured = false;
      let capturedProgress: typeof vm.progress | undefined;
      vi.spyOn(vm, "graphqlDelete").mockImplementation(() => {
        if (!progressCaptured) {
          capturedProgress = { ...vm.progress };
          progressCaptured = true;
        }
        return Promise.resolve(200);
      });

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(capturedProgress?.totalLikesToDelete).toBe(2);
      expect(capturedProgress?.likesDeleted).toBe(0);
    });

    it("should delete all likes successfully", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue(mockLikes);

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "1", "like");
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "2", "like");
      expect(vm.progress.likesDeleted).toBe(2);
    });

    it("should handle rate limits (429) and retry", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue({
        tweets: [mockLikes.tweets[0]],
      });

      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 60000,
      });

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.likesDeleted).toBe(1);
    });

    it("should retry up to 3 times on non-rate-limit failures", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue({
        tweets: [mockLikes.tweets[0]],
      });

      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(3);
      expect(vm.error).toHaveBeenCalled();
      expect(vm.progress.errorsOccured).toBe(1);
    });

    it("should handle error when updating delete timestamp fails", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue({
        tweets: [mockLikes.tweets[0]],
      });

      mockElectron.X.deleteTweet.mockRejectedValueOnce(
        new Error("Database error"),
      );

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle missing ct0 cookie", async () => {
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should finish job after completion", async () => {
      await DeleteJobs.runJobDeleteLikes(vm, 5);

      expect(vm.finishJob).toHaveBeenCalledWith(5);
    });
  });

  describe("runJobDeleteBookmarks", () => {
    const mockBookmarks: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "1", t: "Bookmark 1" }),
        createMockTweetItem({ id: "2", t: "Bookmark 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_BOOKMARKS,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should handle error when failing to start", async () => {
      mockElectron.X.deleteBookmarksStart.mockRejectedValueOnce(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should initialize progress correctly", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue(mockBookmarks);

      let progressCaptured = false;
      let capturedProgress: typeof vm.progress | undefined;
      vi.spyOn(vm, "graphqlDelete").mockImplementation(() => {
        if (!progressCaptured) {
          capturedProgress = { ...vm.progress };
          progressCaptured = true;
        }
        return Promise.resolve(200);
      });

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(capturedProgress?.totalBookmarksToDelete).toBe(2);
      expect(capturedProgress?.bookmarksDeleted).toBe(0);
    });

    it("should delete all bookmarks successfully", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue(mockBookmarks);

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "1",
        "bookmark",
      );
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "2",
        "bookmark",
      );
      expect(vm.progress.bookmarksDeleted).toBe(2);
    });

    it("should handle rate limits (429) and retry", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue({
        tweets: [mockBookmarks.tweets[0]],
      });

      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 60000,
      });

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.bookmarksDeleted).toBe(1);
    });

    it("should retry up to 3 times on non-rate-limit failures", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue({
        tweets: [mockBookmarks.tweets[0]],
      });

      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(3);
      expect(vm.error).toHaveBeenCalled();
      expect(vm.progress.errorsOccured).toBe(1);
    });

    it("should handle error when updating delete timestamp fails", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue({
        tweets: [mockBookmarks.tweets[0]],
      });

      mockElectron.X.deleteTweet.mockRejectedValueOnce(
        new Error("Database error"),
      );

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle missing ct0 cookie", async () => {
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should finish job after completion", async () => {
      await DeleteJobs.runJobDeleteBookmarks(vm, 5);

      expect(vm.finishJob).toHaveBeenCalledWith(5);
    });
  });

  describe("runJobDeleteDMs", () => {
    it("should track analytics event on start", async () => {
      // Make waitForSelector throw for search field to mark DMs as finished
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_DMS,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toContain("I'm deleting your direct messages");
    });

    it("should return false and finish when deleteDMsLoadDMsPage returns false", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      const result = await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(result).toBe(true);
      expect(vm.finishJob).toHaveBeenCalled();
    });

    it("should return false when deleteDMsLoadDMsPage returns true (error)", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // search field
        .mockRejectedValue(new Error("Generic error"));

      const result = await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should delete conversations successfully", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(2) // Initial count
        .mockResolvedValueOnce(1) // After first delete
        .mockResolvedValueOnce(0); // After second delete (finished)

      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(vm.scriptClickElementNth).toHaveBeenCalled();
      expect(vm.scriptClickElement).toHaveBeenCalled();
      expect(vm.progress.conversationsDeleted).toBeGreaterThan(0);
    });

    it("should handle rate limits during deletion", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // search field
        .mockResolvedValueOnce(undefined) // conversation list
        .mockRejectedValueOnce(new TimeoutError("confirm-button")) // First try - timeout
        .mockResolvedValueOnce(undefined); // After rate limit

      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should handle errors when clicking menu button fails", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(false);

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });
  });

  describe("runJobUnfollowEveryone", () => {
    it("should track analytics event on start", async () => {
      // Make waitForSelector throw for following users to mark as finished
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_UNFOLLOW_EVERYONE,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toContain("I'm unfollowing everyone");
    });

    it("should return true and finish when no following users exist", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      const result = await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(result).toBe(true);
      expect(vm.finishJob).toHaveBeenCalled();
      expect(vm.progress.isUnfollowEveryoneFinished).toBe(true);
    });

    it("should unfollow users successfully", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(2) // Initial count
        .mockResolvedValueOnce(2) // Same count after first unfollow
        .mockResolvedValueOnce(0); // No more after reload

      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.scriptMouseoverElementNth).toHaveBeenCalled();
      expect(vm.scriptClickElementNth).toHaveBeenCalled();
      expect(vm.scriptClickElement).toHaveBeenCalled();
      expect(vm.progress.accountsUnfollowed).toBeGreaterThan(0);
    });

    it("should handle mouseover failure and reload page", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1) // First load
        .mockResolvedValueOnce(0); // After reload - no more users

      vi.spyOn(vm, "scriptMouseoverElementNth")
        .mockResolvedValueOnce(false) // Mouseover fails
        .mockResolvedValueOnce(true); // Succeeds after reload

      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalled();
    });

    it("should handle click unfollow button failure", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElementNth")
        .mockResolvedValueOnce(false) // Click fails
        .mockResolvedValueOnce(true); // Succeeds after retry

      vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalled();
    });

    it("should handle rate limits when waiting for confirm button", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // Following users exist
        .mockRejectedValueOnce(new TimeoutError("confirm-button")) // Confirm button timeout
        .mockResolvedValueOnce(undefined) // Following users after reload
        .mockResolvedValueOnce(undefined) // Confirm button appears
        .mockResolvedValueOnce(undefined);

      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should handle click confirm button failure", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
      vi.spyOn(vm, "scriptClickElement")
        .mockResolvedValueOnce(false) // Confirm click fails
        .mockResolvedValueOnce(true); // Succeeds after reload

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalled();
    });

    it("should emit submit progress event", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.emitter?.emit).toHaveBeenCalledWith("x-submit-progress-1");
    });

    it("should return false on error after retries", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(false); // Always fails

      const result = await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });
  });
});
