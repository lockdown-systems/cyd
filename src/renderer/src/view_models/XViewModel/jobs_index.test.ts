import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as IndexJobs from "./jobs_index";
import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { TimeoutError, URLChangedError } from "../BaseViewModel";
import type { XArchiveStartResponse } from "../../../../shared_types";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../test_util";
import { createMockXViewModel, createMockJob } from "./test_util";

// Mock the helpers module
vi.mock("./helpers", () => ({
  finishJob: vi.fn().mockResolvedValue(undefined),
  syncProgress: vi.fn().mockResolvedValue(undefined),
}));

describe("jobs_index.ts", () => {
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
    vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
    vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);
    vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0);
    vi.spyOn(vm, "scriptClickElementWithinElementLast").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "scrollUp").mockResolvedValue(undefined);
    vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);
    vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
    vi.spyOn(vm, "syncProgress").mockResolvedValue(undefined);
    vi.spyOn(vm, "finishJob").mockResolvedValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("runJobIndexTweets", () => {
    beforeEach(() => {
      // Initialize jobs array for tests that modify jobs[jobIndex]
      vm.jobs = [
        createMockJob("indexTweets"),
        createMockJob("indexLikes"),
        createMockJob("indexBookmarks"),
        createMockJob("archiveTweets"),
      ];
    });

    it("should track analytics event on start", async () => {
      // Mock empty content to exit immediately after start
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_TWEETS,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      // Mock empty content to exit immediately
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toContain("I'm saving your tweets");
    });

    it("should start indexing", async () => {
      // Mock empty content to exit immediately
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(mockElectron.X.indexStart).toHaveBeenCalledWith(1);
    });

    it("should handle empty tweets list", async () => {
      // Mock section exists but no articles
      vi.spyOn(vm, "doesSelectorExist")
        .mockResolvedValueOnce(false) // No empty state selector
        .mockResolvedValueOnce(true); // Section exists
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(vm.progress.isIndexTweetsFinished).toBe(true);
      expect(vm.progress.tweetsIndexed).toBe(0);
      expect(vm.syncProgress).toHaveBeenCalled();
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle timeout waiting for tweets to appear", async () => {
      // Mock content exists but waitForSelector times out
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("article"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(vm.progress.isIndexTweetsFinished).toBe(true);
      expect(vm.waitForLoadingToFinish).toHaveBeenCalled();
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should handle URLChangedError when waiting for tweets", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new URLChangedError(
          "https://x.com/test/with_replies",
          "https://x.com/new",
        ),
      );

      const result = await IndexJobs.runJobIndexTweets(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
    });

    it("should handle generic error when waiting for tweets", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new Error("Generic error"),
      );

      const result = await IndexJobs.runJobIndexTweets(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
    });

    it("should handle rate limits during scrolling", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1) // Initial check
        .mockResolvedValueOnce(5) // First iteration - before rate limit check
        .mockResolvedValueOnce(10); // After rate limit handled - more loaded
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      mockElectron.X.indexParseTweets.mockResolvedValueOnce({
        ...vm.progress,
        tweetsIndexed: 5,
        isIndexTweetsFinished: false,
      });

      mockElectron.X.indexIsThereMore.mockResolvedValue(false);
      mockElectron.X.resetThereIsMore.mockResolvedValue(undefined);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.isIndexTweetsFinished).toBe(true);
    });

    it("should handle ParseTweetsError", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseTweets.mockRejectedValue(
        new Error("Parse error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("response data");

      const result = await IndexJobs.runJobIndexTweets(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
    });

    it("should handle VerifyThereIsNoMoreError", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseTweets.mockResolvedValue({
        ...vm.progress,
        tweetsIndexed: 5,
      });

      mockElectron.X.indexIsThereMore.mockResolvedValue(false);
      mockElectron.X.resetThereIsMore.mockRejectedValue(
        new Error("Verify error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("response data");

      const result = await IndexJobs.runJobIndexTweets(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
    });

    it("should set failure state when handleRateLimit fails", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      // indexTweetsHandleRateLimit will fail because countSelectorsFound stays same and no retry button
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(5); // Same count
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0); // No button

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "indexTweets_FailedToRetryAfterRateLimit",
        "true",
      );
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
    });

    it("should clear failure state on successful completion", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseTweets.mockResolvedValue({
        ...vm.progress,
        tweetsIndexed: 5,
        isIndexTweetsFinished: false,
      });

      mockElectron.X.indexIsThereMore.mockResolvedValue(false);
      mockElectron.X.resetThereIsMore.mockResolvedValue(undefined);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "indexTweets_FailedToRetryAfterRateLimit",
        "false",
      );
      expect(vm.progress.isIndexTweetsFinished).toBe(true);
    });

    it("should scroll up when at bottom but not finished", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom")
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false); // No more to scroll

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseTweets.mockResolvedValue({
        ...vm.progress,
        tweetsIndexed: 5,
        isIndexTweetsFinished: false,
      });

      mockElectron.X.indexIsThereMore
        .mockResolvedValueOnce(true) // There's more
        .mockResolvedValueOnce(false); // No more after scroll up
      mockElectron.X.resetThereIsMore.mockResolvedValue(undefined);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(vm.scrollUp).toHaveBeenCalledWith(2000);
      expect(vm.progress.isIndexTweetsFinished).toBe(true);
    });

    it("should stop monitoring and finish job after completion", async () => {
      // Mock empty content to complete immediately
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(mockElectron.X.indexStop).toHaveBeenCalledWith(1);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });
  });

  describe("runJobArchiveTweets", () => {
    const mockArchiveData: XArchiveStartResponse = {
      outputPath: "/output/path",
      items: [
        {
          tweetID: "1",
          url: "https://x.com/test/status/1",
          basename: "tweet_1",
          username: "testuser",
        },
        {
          tweetID: "2",
          url: "https://x.com/test/status/2",
          basename: "tweet_2",
          username: "testuser",
        },
      ],
    };

    it("should track analytics event on start", async () => {
      await IndexJobs.runJobArchiveTweets(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_ARCHIVE_TWEETS,
        navigator.userAgent,
      );
    });

    it("should get tweets to archive from electron API", async () => {
      await IndexJobs.runJobArchiveTweets(vm, 0);

      expect(mockElectron.X.archiveTweetsStart).toHaveBeenCalledWith(1);
    });

    it("should loop through all tweets to archive", async () => {
      mockElectron.X.archiveTweetsStart.mockResolvedValue(mockArchiveData);
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);

      await IndexJobs.runJobArchiveTweets(vm, 0);

      // Should load URL for each tweet
      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/test/status/1",
      );
      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/test/status/2",
      );
    });

    it("should finish job after completion", async () => {
      await IndexJobs.runJobArchiveTweets(vm, 3);

      expect(vm.finishJob).toHaveBeenCalledWith(3);
    });
  });

  describe("runJobIndexLikes", () => {
    beforeEach(() => {
      // Initialize jobs array for tests that modify jobs[jobIndex]
      vm.jobs = [
        createMockJob("indexTweets"),
        createMockJob("indexLikes"),
        createMockJob("indexBookmarks"),
        createMockJob("archiveTweets"),
      ];
    });

    it("should track analytics event on start", async () => {
      // Mock empty state to exit immediately
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexLikes(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_LIKES,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      // Mock empty state to exit immediately
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexLikes(vm, 0);

      expect(vm.instructions).toContain("I'm saving your likes");
    });

    it("should handle empty likes (emptyState selector)", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexLikes(vm, 0);

      expect(vm.progress.isIndexLikesFinished).toBe(true);
      expect(vm.progress.likesIndexed).toBe(0);
    });

    it("should handle timeout when waiting for likes", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("article"),
      );

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await IndexJobs.runJobIndexLikes(vm, 0);

      expect(vm.progress.isIndexLikesFinished).toBe(true);
      expect(vm.waitForLoadingToFinish).toHaveBeenCalled();
    });

    it("should handle URLChangedError", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new URLChangedError("https://x.com/test/likes", "https://x.com/new"),
      );

      const result = await IndexJobs.runJobIndexLikes(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle generic errors", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new Error("Generic error"),
      );

      const result = await IndexJobs.runJobIndexLikes(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle rate limits and retry", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1) // Initial check
        .mockResolvedValueOnce(5) // First iteration - before rate limit check
        .mockResolvedValueOnce(10); // After rate limit handled - more loaded
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      mockElectron.X.indexParseTweets.mockResolvedValueOnce({
        ...vm.progress,
        likesIndexed: 5,
        isIndexLikesFinished: false,
      });

      mockElectron.X.indexIsThereMore.mockResolvedValue(false);
      mockElectron.X.resetThereIsMore.mockResolvedValue(undefined);

      await IndexJobs.runJobIndexLikes(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(vm.progress.isIndexLikesFinished).toBe(true);
    });
  });

  describe("runJobIndexBookmarks", () => {
    beforeEach(() => {
      // Initialize jobs array for tests that modify jobs[jobIndex]
      vm.jobs = [
        createMockJob("indexTweets"),
        createMockJob("indexLikes"),
        createMockJob("indexBookmarks"),
        createMockJob("archiveTweets"),
      ];
    });

    it("should track analytics event on start", async () => {
      // Mock empty state to exit immediately
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_BOOKMARKS,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      // Mock empty state to exit immediately
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(vm.instructions).toContain("I'm saving your bookmarks");
    });

    it("should handle empty bookmarks (emptyState selector)", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(vm.progress.isIndexBookmarksFinished).toBe(true);
      expect(vm.progress.bookmarksIndexed).toBe(0);
    });

    it("should handle timeout when waiting for bookmarks", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("article"),
      );

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(vm.progress.isIndexBookmarksFinished).toBe(true);
      expect(vm.waitForLoadingToFinish).toHaveBeenCalled();
    });

    it("should handle URLChangedError", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new URLChangedError("https://x.com/i/bookmarks", "https://x.com/new"),
      );

      const result = await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
      expect(mockElectron.X.indexStop).toHaveBeenCalled();
    });

    it("should handle generic errors", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new Error("Generic error"),
      );

      const result = await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle ParseTweetsError", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseTweets.mockRejectedValue(
        new Error("Parse error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("response data");

      const result = await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle VerifyThereIsNoMoreError", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseTweets.mockResolvedValue({
        ...vm.progress,
        bookmarksIndexed: 5,
        isIndexBookmarksFinished: false,
      });

      mockElectron.X.indexIsThereMore.mockResolvedValue(false);
      mockElectron.X.resetThereIsMore.mockRejectedValue(
        new Error("Verify error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("response data");

      const result = await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should set failure state when handleRateLimit fails", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(1) // Initial check
        .mockResolvedValueOnce(5) // Same count - will trigger failure
        .mockResolvedValueOnce(5); // Still same
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0); // No retry button

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      mockElectron.X.indexParseTweets.mockResolvedValue({
        ...vm.progress,
        bookmarksIndexed: 5,
      });

      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "indexBookmarks_FailedToRetryAfterRateLimit",
        "true",
      );
    });

    it("should clear failure state on successful completion", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseTweets.mockResolvedValue({
        ...vm.progress,
        bookmarksIndexed: 5,
        isIndexBookmarksFinished: false,
      });

      mockElectron.X.indexIsThereMore.mockResolvedValue(false);
      mockElectron.X.resetThereIsMore.mockResolvedValue(undefined);

      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "indexBookmarks_FailedToRetryAfterRateLimit",
        "false",
      );
    });
  });
});
