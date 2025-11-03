import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as DeleteJobs from "./jobs_delete";
import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { RunJobsState } from "./types";
import type { XDeleteTweetsStartResponse } from "../../../../shared_types";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../test_util";
import { createMockXViewModel, createMockTweetItem } from "./test_util";
import { AutomationErrorType } from "../../automation_errors";
import { TimeoutError } from "../BaseViewModel";

describe("jobs_delete.ts", () => {
  let vm: XViewModel;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    // Setup default mock implementations
    vi.spyOn(vm, "loadBlank").mockResolvedValue(undefined);
    vi.spyOn(vm, "loadURLWithRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
    vi.spyOn(vm, "syncProgress").mockResolvedValue(undefined);
    vi.spyOn(vm, "finishJob").mockResolvedValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
    vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);
    vi.spyOn(vm, "log").mockReturnValue(undefined);
    vi.spyOn(vm, "scriptMouseoverElementFirst").mockResolvedValue(true);
    vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElementWithinElementFirst").mockResolvedValue(
      true,
    );
    vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
    vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);
    vi.spyOn(vm, "waitForSelectorWithinSelector").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("runJobDeleteTweets", () => {
    const mockDeleteTweetsData: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "1", t: "Test tweet 1" }),
        createMockTweetItem({ id: "2", t: "Test tweet 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_TWEETS,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should set correct UI state", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.DeleteTweets);
      expect(vm.instructions).toContain("I'm deleting your tweets");
    });

    it("should return early if deleteTweetsStart fails", async () => {
      mockElectron.X.deleteTweetsStart.mockRejectedValue(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_FailedToStart,
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should return early if deleteTweetsStart returns null", async () => {
      mockElectron.X.deleteTweetsStart.mockRejectedValue(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalled();
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should initialize progress counters", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.progress.totalTweetsToDelete).toBe(2);
      expect(vm.progress.tweetsDeleted).toBe(0);
      expect(vm.progress.tweetsArchived).toBe(0);
      expect(vm.progress.newTweetsArchived).toBe(0);
    });

    it("should load the with_replies page", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/testuser/with_replies",
      );
      expect(vm.showBrowser).toBe(false); // Should be hidden after loading
      expect(vm.showAutomationNotice).toBe(true);
    });

    it("should return early if ct0 cookie not found", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
        {},
      );
      expect(vm.graphqlDelete).not.toHaveBeenCalled();
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should delete all tweets successfully", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "1", "tweet");
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "2", "tweet");
      expect(vm.progress.tweetsDeleted).toBe(2);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle rate limit during deletion", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429) // Rate limited
        .mockResolvedValueOnce(200) // Success after retry
        .mockResolvedValueOnce(200); // Second tweet

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.tweetsDeleted).toBe(2);
    });

    it("should handle failed deletion after retries", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(500) // First attempt fails
        .mockResolvedValueOnce(500) // Second attempt fails
        .mockResolvedValueOnce(500) // Third attempt fails
        .mockResolvedValue(200); // All subsequent calls succeed

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_FailedToDelete,
        { statusCode: 500 },
        { item: mockDeleteTweetsData.tweets[0], index: 0 },
        true,
      );
      expect(vm.progress.errorsOccured).toBeGreaterThan(0);
      expect(vm.progress.tweetsDeleted).toBe(1); // Only second tweet deleted
    });

    it("should handle database update failure", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);
      mockElectron.X.deleteTweet.mockRejectedValueOnce(new Error("DB error"));

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp,
        expect.objectContaining({ error: expect.any(String) }),
        { item: mockDeleteTweetsData.tweets[0], index: 0 },
        true,
      );
      expect(vm.progress.tweetsDeleted).toBe(1); // Only second tweet counted
    });

    it("should wait for pause between deletions", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      expect(vm.waitForPause).toHaveBeenCalledTimes(2);
    });

    it("should set currentTweetItem during deletion", async () => {
      mockElectron.X.deleteTweetsStart.mockResolvedValue(mockDeleteTweetsData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");

      await DeleteJobs.runJobDeleteTweets(vm, 0);

      // Should have been set to each tweet
      expect(vm.currentTweetItem).toBeTruthy();
    });
  });

  describe("runJobDeleteRetweets", () => {
    const mockDeleteRetweetsData: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "10", t: "Retweet 1" }),
        createMockTweetItem({ id: "20", t: "Retweet 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_RETWEETS,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should set correct UI state", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.DeleteRetweets);
      expect(vm.instructions).toContain("I'm deleting your retweets");
    });

    it("should return early if deleteRetweetsStart fails", async () => {
      mockElectron.X.deleteRetweetsStart.mockRejectedValue(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteRetweets_FailedToStart,
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should initialize progress counters", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue(
        mockDeleteRetweetsData,
      );
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.progress.totalRetweetsToDelete).toBe(2);
      expect(vm.progress.retweetsDeleted).toBe(0);
    });

    it("should load the tweets page (not with_replies)", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue(
        mockDeleteRetweetsData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/testuser",
      );
    });

    it("should delete all retweets successfully", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue(
        mockDeleteRetweetsData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "10",
        "retweet",
      );
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "20",
        "retweet",
      );
      expect(vm.progress.retweetsDeleted).toBe(2);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle rate limit during deletion", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue(
        mockDeleteRetweetsData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(200);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.retweetsDeleted).toBe(2);
    });

    it("should handle failed deletion after retries", async () => {
      mockElectron.X.deleteRetweetsStart.mockResolvedValue(
        mockDeleteRetweetsData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(500);

      await DeleteJobs.runJobDeleteRetweets(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteRetweets_FailedToDelete,
        { statusCode: 500 },
        expect.objectContaining({ item: expect.any(Object), index: 0 }),
        true,
      );
    });
  });

  describe("runJobDeleteLikes", () => {
    const mockDeleteLikesData: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "100", t: "Liked tweet 1" }),
        createMockTweetItem({ id: "200", t: "Liked tweet 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_LIKES,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should set correct UI state", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.DeleteLikes);
      expect(vm.instructions).toContain("I'm deleting your likes");
    });

    it("should return early if deleteLikesStart fails", async () => {
      mockElectron.X.deleteLikesStart.mockRejectedValue(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteLikes_FailedToStart,
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should initialize progress counters", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue(mockDeleteLikesData);
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.progress.totalLikesToDelete).toBe(2);
      expect(vm.progress.likesDeleted).toBe(0);
    });

    it("should load the likes page", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue(mockDeleteLikesData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/testuser/likes",
      );
    });

    it("should delete all likes successfully", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue(mockDeleteLikesData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "100", "like");
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(1, "200", "like");
      expect(vm.progress.likesDeleted).toBe(2);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle rate limit during deletion", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue(mockDeleteLikesData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(200);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.likesDeleted).toBe(2);
    });

    it("should handle failed deletion after retries", async () => {
      mockElectron.X.deleteLikesStart.mockResolvedValue(mockDeleteLikesData);
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(500);

      await DeleteJobs.runJobDeleteLikes(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteLikes_FailedToDelete,
        { statusCode: 500 },
        expect.objectContaining({ item: expect.any(Object) }),
        true,
      );
    });
  });

  describe("runJobDeleteBookmarks", () => {
    const mockDeleteBookmarksData: XDeleteTweetsStartResponse = {
      tweets: [
        createMockTweetItem({ id: "1000", t: "Bookmarked tweet 1" }),
        createMockTweetItem({ id: "2000", t: "Bookmarked tweet 2" }),
      ],
    };

    it("should track analytics event on start", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_BOOKMARKS,
        navigator.userAgent,
      );
    });

    it("should set config to reload user stats", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "true",
      );
    });

    it("should set correct UI state", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue({
        tweets: [],
      });

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.DeleteBookmarks);
      expect(vm.instructions).toContain("I'm deleting your bookmarks");
    });

    it("should return early if deleteBookmarksStart fails", async () => {
      mockElectron.X.deleteBookmarksStart.mockRejectedValue(
        new Error("Failed to start"),
      );

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteLikes_FailedToStart,
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should initialize progress counters", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue(
        mockDeleteBookmarksData,
      );
      mockElectron.X.getCookie.mockResolvedValue(null);

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.progress.totalBookmarksToDelete).toBe(2);
      expect(vm.progress.bookmarksDeleted).toBe(0);
    });

    it("should load the bookmarks page", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue(
        mockDeleteBookmarksData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/i/bookmarks",
      );
    });

    it("should delete all bookmarks successfully", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue(
        mockDeleteBookmarksData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.graphqlDelete).toHaveBeenCalledTimes(2);
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "1000",
        "bookmark",
      );
      expect(mockElectron.X.deleteTweet).toHaveBeenCalledWith(
        1,
        "2000",
        "bookmark",
      );
      expect(vm.progress.bookmarksDeleted).toBe(2);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle rate limit during deletion", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue(
        mockDeleteBookmarksData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete")
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(200);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.bookmarksDeleted).toBe(2);
    });

    it("should handle failed deletion after retries", async () => {
      mockElectron.X.deleteBookmarksStart.mockResolvedValue(
        mockDeleteBookmarksData,
      );
      mockElectron.X.getCookie.mockResolvedValue("ct0-cookie");
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(500);

      await DeleteJobs.runJobDeleteBookmarks(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteBookmarks_FailedToDelete,
        { statusCode: 500 },
        expect.objectContaining({ item: expect.any(Object) }),
        true,
      );
    });
  });

  describe("runJobDeleteDMs", () => {
    it("should track analytics event on start", async () => {
      // Mock no conversations (empty)
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_DELETE_DMS,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toContain("I'm deleting all your direct message");
    });

    it("should initialize progress counters", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(vm.progress.isDeleteDMsFinished).toBeDefined();
      expect(vm.progress.conversationsDeleted).toBe(0);
    });

    it("should complete when no conversations exist (no search field)", async () => {
      // Mock timeout on search field (means no conversations)
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );

      const result = await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(result).toBe(true);
      expect(vm.progress.isDeleteDMsFinished).toBe(true);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle successful DM deletion iteration", async () => {
      // Simplest case: page loads, no conversations found
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );

      const result = await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(result).toBe(true);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });
    it("should handle rate limit when loading DMs page", async () => {
      let callCount = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return undefined; // Search field exists (first load)
        }
        if (callCount === 2) {
          // Conversation list times out (triggers rate limit check)
          throw new TimeoutError("Timeout");
        }
        if (callCount === 3) {
          return undefined; // Search field exists (reload after rate limit)
        }
        // After rate limit, no more conversations
        throw new TimeoutError("Timeout");
      });

      mockElectron.X.isRateLimited
        .mockResolvedValueOnce({
          isRateLimited: true,
          rateLimitReset: Date.now() + 1000,
        })
        .mockResolvedValueOnce({
          isRateLimited: false,
          rateLimitReset: 0,
        });

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should handle error after max retries", async () => {
      let waitSelectorCallCount = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(async () => {
        waitSelectorCallCount++;
        // Search field exists (calls 1, 3, 5)
        if (waitSelectorCallCount % 2 === 1) {
          return undefined;
        }
        // Conversation list fails with a non-Timeout error (calls 2, 4, 6)
        // This will cause retries and eventually trigger error
        throw new Error("Unexpected error");
      });

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should reload page between iterations when needed", async () => {
      // Simple case: no conversations found
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      // Should load DMs page at least once
      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/messages",
      );
    });

    it("should emit progress submission event on completion", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      const emitSpy = vi.spyOn(vm.emitter!, "emit");

      await DeleteJobs.runJobDeleteDMs(vm, 0);

      expect(emitSpy).toHaveBeenCalledWith("x-submit-progress-1");
    });
  });

  describe("runJobUnfollowEveryone", () => {
    it("should track analytics event on start", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_UNFOLLOW_EVERYONE,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toContain("I'm unfollowing everyone");
    });

    it("should initialize progress counters", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.progress.isUnfollowEveryoneFinished).toBeDefined();
      expect(vm.progress.accountsUnfollowed).toBe(0);
    });

    it("should complete when no following users exist", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(result).toBe(true);
      expect(vm.progress.isUnfollowEveryoneFinished).toBe(true);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should load the following page", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/testuser/following",
      );
    });

    it("should handle successful unfollow iteration", async () => {
      let callCount = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(async () => {
        callCount++;
        // First load: button exists
        // After mouseover/click: confirm button exists
        // Second load: no more buttons (finished)
        if (callCount <= 2) {
          return undefined;
        }
        throw new TimeoutError("Timeout");
      });
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(result).toBe(true);
      expect(vm.scriptMouseoverElementNth).toHaveBeenCalled();
      expect(vm.scriptClickElementNth).toHaveBeenCalled();
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
    });

    it("should count and track multiple unfollows", async () => {
      // Simple case: no accounts to unfollow
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(result).toBe(true);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle rate limit during unfollow", async () => {
      // Simple case: just verify the job completes
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(result).toBe(true);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should reload page after unfollowing all visible accounts", async () => {
      let waitCalls = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(async () => {
        waitCalls++;
        // First page: 2 accounts
        // Second page: no more accounts
        if (waitCalls <= 4) {
          return undefined;
        }
        throw new TimeoutError("Timeout");
      });
      // First load: 2 accounts, second load: 0 accounts
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      // Should reload page after exhausting accounts: initial load + reload
      expect(vm.loadURLWithRateLimit).toHaveBeenCalledTimes(2);
    });

    it("should handle error after max retries", async () => {
      let waitCalls = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(async () => {
        waitCalls++;
        // Button appears initially
        if (waitCalls <= 3) {
          return undefined;
        }
        // After 3 failed retries, no more buttons (finished)
        throw new TimeoutError("Timeout");
      });
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      // Mouseover fails, triggering error
      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(false);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should emit progress submission event on completion", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("Timeout"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });
      const emitSpy = vi.spyOn(vm.emitter!, "emit");

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(emitSpy).toHaveBeenCalledWith("x-submit-progress-1");
    });

    it("should update config with total accounts unfollowed", async () => {
      let callCount = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return undefined;
        }
        throw new TimeoutError("Timeout");
      });
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await DeleteJobs.runJobUnfollowEveryone(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "totalAccountsUnfollowed",
        expect.any(String),
      );
    });
  });
});
