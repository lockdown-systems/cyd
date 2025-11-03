import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as IndexJobs from "./jobs_index";
import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { TimeoutError, URLChangedError } from "../BaseViewModel";
import { AutomationErrorType } from "../../automation_errors";
import type {
  XArchiveStartResponse,
  XIndexMessagesStartResponse,
  XTweetItemArchive,
} from "../../../../shared_types";
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

  describe("indexTweetsHandleRateLimit", () => {
    it("should return true when more tweets load after scrolling", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(5) // Before scroll
        .mockResolvedValueOnce(10); // After scroll

      const result = await IndexJobs.indexTweetsHandleRateLimit(vm);

      expect(result).toBe(true);
      expect(vm.scrollUp).toHaveBeenCalled();
      expect(vm.scrollToBottom).toHaveBeenCalled();
    });

    it("should return false when retry button does not exist", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(5); // Same count
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0); // No button

      const result = await IndexJobs.indexTweetsHandleRateLimit(vm);

      expect(result).toBe(false);
    });

    it("should click retry button when it exists", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(5) // Before
        .mockResolvedValueOnce(5) // After scroll (no change)
        .mockResolvedValueOnce(5) // Before click
        .mockResolvedValueOnce(10); // After click
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(1); // Button exists

      const result = await IndexJobs.indexTweetsHandleRateLimit(vm);

      expect(vm.scriptClickElementWithinElementLast).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should handle case when no tweets have loaded", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      const result = await IndexJobs.indexTweetsHandleRateLimit(vm);

      expect(vm.scriptClickElement).toHaveBeenCalled();
      expect(result).toBe(false); // No tweets loaded
    });
  });

  describe("indexTweetsCheckForSomethingWrong", () => {
    it("should click retry button when something went wrong message exists", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(1);

      await IndexJobs.indexTweetsCheckForSomethingWrong(vm);

      expect(vm.scriptClickElementWithinElementLast).toHaveBeenCalled();
      expect(vm.sleep).toHaveBeenCalledWith(2000);
    });

    it("should do nothing when everything is fine", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);

      await IndexJobs.indexTweetsCheckForSomethingWrong(vm);

      expect(vm.scriptClickElementWithinElementLast).not.toHaveBeenCalled();
    });
  });

  describe("indexTweetsVerifyThereIsNoMore", () => {
    it("should return true when final API response is received again", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(false);

      const result = await IndexJobs.indexTweetsVerifyThereIsNoMore(vm);

      expect(result).toBe(true);
      expect(mockElectron.X.resetThereIsMore).toHaveBeenCalled();
      expect(vm.scrollUp).toHaveBeenCalled();
      expect(vm.scrollToBottom).toHaveBeenCalled();
    });

    it("should return true when progress was not updated", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);
      vm.progress.tweetsIndexed = 10;
      vm.progress.retweetsIndexed = 5;
      vm.progress.likesIndexed = 3;
      vm.progress.unknownIndexed = 0;

      mockElectron.X.indexParseTweets.mockResolvedValue({
        tweetsIndexed: 10,
        retweetsIndexed: 5,
        likesIndexed: 3,
        unknownIndexed: 0,
      });

      const result = await IndexJobs.indexTweetsVerifyThereIsNoMore(vm);

      expect(result).toBe(true);
    });

    it("should return false when there is more to load", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);
      vm.progress.tweetsIndexed = 10;

      mockElectron.X.indexParseTweets.mockResolvedValue({
        tweetsIndexed: 15, // Increased
        retweetsIndexed: 0,
        likesIndexed: 0,
        unknownIndexed: 0,
      });

      const result = await IndexJobs.indexTweetsVerifyThereIsNoMore(vm);

      expect(result).toBe(false);
    });
  });

  describe("archiveSaveTweet", () => {
    const mockTweetItem: XTweetItemArchive = {
      tweetID: "123",
      url: "https://x.com/test/status/123",
      basename: "tweet_123",
      username: "testuser",
    };

    it("should return true and skip if tweet is already archived", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(true);

      const result = await IndexJobs.archiveSaveTweet(
        vm,
        "/output/path",
        mockTweetItem,
      );

      expect(result).toBe(true);
      expect(mockElectron.archive.isPageAlreadySaved).toHaveBeenCalledWith(
        "/output/path",
        "tweet_123",
      );
      expect(mockElectron.X.archiveTweetCheckDate).toHaveBeenCalledWith(
        1,
        "123",
      );
      expect(vm.progress.tweetsArchived).toBe(1);
    });

    it("should load URL and save page for new tweet", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);

      await IndexJobs.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/test/status/123",
      );
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'article[tabindex="-1"]',
        "https://x.com/test/status/123",
        10000,
      );
      expect(mockElectron.archive.savePage).toHaveBeenCalledWith(
        1, // webContentsID
        "/output/path",
        "tweet_123",
      );
    });

    it("should handle already deleted tweets", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);

      await IndexJobs.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      expect(vm.doesSelectorExist).toHaveBeenCalledWith(
        'div[data-testid="primaryColumn"] div[data-testid="error-detail"]',
      );
      expect(mockElectron.archive.savePage).toHaveBeenCalled();
    });

    it("should handle timeout when waiting for selector", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("test-selector"),
      );

      await IndexJobs.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      // Should still save the page even if selector times out
      expect(mockElectron.archive.savePage).toHaveBeenCalled();
    });

    it("should return false and log error when webContentsID is null", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);
      vm.webContentsID = null;

      const result = await IndexJobs.archiveSaveTweet(
        vm,
        "/output/path",
        mockTweetItem,
      );

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should update archiveTweet in database", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);

      await IndexJobs.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      expect(mockElectron.X.archiveTweet).toHaveBeenCalledWith(1, "123");
    });

    it("should handle errors when updating database", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);
      mockElectron.X.archiveTweet.mockRejectedValue(
        new Error("Database error"),
      );

      await IndexJobs.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      expect(vm.error).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Shared Index Helper Functions Tests
  // ============================================================================

  describe("indexContentCheckIfEmpty", () => {
    it("should return true and update progress when empty state selector exists", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);

      const result = await IndexJobs.indexContentCheckIfEmpty(
        vm,
        'div[data-testid="emptyState"]',
        "article",
        "isIndexTweetsFinished",
        "tweetsIndexed",
      );

      expect(result).toBe(true);
      expect(vm.progress.isIndexTweetsFinished).toBe(true);
      expect(vm.progress.tweetsIndexed).toBe(0);
      expect(vm.syncProgress).toHaveBeenCalled();
    });

    it("should return true when section exists but no articles found", async () => {
      vi.spyOn(vm, "doesSelectorExist")
        .mockResolvedValueOnce(false) // No empty state
        .mockResolvedValueOnce(true); // Section exists
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      const result = await IndexJobs.indexContentCheckIfEmpty(
        vm,
        'div[data-testid="emptyState"]',
        "section article",
        "isIndexLikesFinished",
        "likesIndexed",
      );

      expect(result).toBe(true);
      expect(vm.progress.isIndexLikesFinished).toBe(true);
      expect(vm.progress.likesIndexed).toBe(0);
    });

    it("should return false when content exists", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(5);

      const result = await IndexJobs.indexContentCheckIfEmpty(
        vm,
        null,
        "section article",
        "isIndexBookmarksFinished",
        "bookmarksIndexed",
      );

      expect(result).toBe(false);
    });
  });

  describe("indexContentWaitForInitialLoad", () => {
    it("should return success when selector appears", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);

      const result = await IndexJobs.indexContentWaitForInitialLoad(
        vm,
        "article",
        "https://x.com/testuser/tweets",
        "isIndexTweetsFinished",
        "tweetsIndexed",
        AutomationErrorType.x_runJob_indexTweets_URLChanged,
        AutomationErrorType.x_runJob_indexTweets_OtherError,
      );

      expect(result).toEqual({ success: true, errorTriggered: false });
    });

    it("should handle rate limit timeout", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("article"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      const result = await IndexJobs.indexContentWaitForInitialLoad(
        vm,
        "article",
        "https://x.com/testuser/likes",
        "isIndexLikesFinished",
        "likesIndexed",
        AutomationErrorType.x_runJob_indexLikes_URLChanged,
        AutomationErrorType.x_runJob_indexLikes_OtherError,
      );

      expect(result).toEqual({ success: false, errorTriggered: false });
      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should set finished state when no content and not rate limited", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("article"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await IndexJobs.indexContentWaitForInitialLoad(
        vm,
        "article",
        "https://x.com/testuser/bookmarks",
        "isIndexBookmarksFinished",
        "bookmarksIndexed",
        AutomationErrorType.x_runJob_indexBookmarks_URLChanged,
        AutomationErrorType.x_runJob_indexBookmarks_OtherError,
      );

      expect(result).toEqual({ success: false, errorTriggered: false });
      expect(vm.progress.isIndexBookmarksFinished).toBe(true);
      expect(vm.progress.bookmarksIndexed).toBe(0);
      expect(vm.waitForLoadingToFinish).toHaveBeenCalled();
    });

    it("should trigger error on URL changed", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new URLChangedError(
          "https://x.com/testuser/tweets",
          "https://x.com/other",
        ),
      );

      const result = await IndexJobs.indexContentWaitForInitialLoad(
        vm,
        "article",
        "https://x.com/testuser/tweets",
        "isIndexTweetsFinished",
        "tweetsIndexed",
        AutomationErrorType.x_runJob_indexTweets_URLChanged,
        AutomationErrorType.x_runJob_indexTweets_OtherError,
      );

      expect(result).toEqual({ success: false, errorTriggered: true });
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_indexTweets_URLChanged,
        expect.objectContaining({ newURL: expect.any(String) }),
        expect.any(Object),
      );
    });

    it("should trigger error on other errors", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new Error("Unknown error"),
      );

      const result = await IndexJobs.indexContentWaitForInitialLoad(
        vm,
        "article",
        "https://x.com/testuser/tweets",
        "isIndexTweetsFinished",
        "tweetsIndexed",
        AutomationErrorType.x_runJob_indexTweets_URLChanged,
        AutomationErrorType.x_runJob_indexTweets_OtherError,
      );

      expect(result).toEqual({ success: false, errorTriggered: true });
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_indexTweets_OtherError,
        expect.objectContaining({ error: expect.any(String) }),
        expect.any(Object),
      );
    });
  });

  describe("indexContentProcessRateLimit", () => {
    it("should return shouldContinue=true when rate limit handled successfully", async () => {
      // Set up mocks so indexTweetsHandleRateLimit returns true
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(5) // Before scroll
        .mockResolvedValueOnce(10); // After scroll - more loaded

      const result = await IndexJobs.indexContentProcessRateLimit(
        vm,
        "someFailureState",
      );

      expect(result).toEqual({ shouldContinue: true, shouldBreak: false });
      expect(vm.scrollToBottom).toHaveBeenCalled();
      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should return shouldBreak=true when rate limit handling fails", async () => {
      // Set up mocks so indexTweetsHandleRateLimit returns false
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(5); // Same count (no progress)
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0); // No retry button

      const result = await IndexJobs.indexContentProcessRateLimit(
        vm,
        "indexTweets_FailedToRetryAfterRateLimit",
      );

      expect(result).toEqual({ shouldContinue: false, shouldBreak: true });
      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "indexTweets_FailedToRetryAfterRateLimit",
        "true",
      );
    });
  });

  describe("indexContentParsePage", () => {
    it("should successfully parse content and update job", async () => {
      mockElectron.X.indexParseTweets.mockResolvedValue({
        tweetsIndexed: 10,
        isIndexTweetsFinished: false,
      });
      vm.jobs = [createMockJob("indexTweets")];

      const result = await IndexJobs.indexContentParsePage(
        vm,
        0,
        AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
      );

      expect(result).toEqual({ success: true, errorTriggered: false });
      expect(mockElectron.X.indexParseTweets).toHaveBeenCalled();
      expect(vm.jobs[0].progressJSON).toBeTruthy();
      expect(mockElectron.X.updateJob).toHaveBeenCalled();
    });

    it("should trigger error when parsing fails", async () => {
      mockElectron.X.indexParseTweets.mockRejectedValue(
        new Error("Parse error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("{}");
      vm.jobs = [createMockJob("indexTweets")];

      const result = await IndexJobs.indexContentParsePage(
        vm,
        0,
        AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
      );

      expect(result).toEqual({ success: false, errorTriggered: true });
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
        expect.objectContaining({ error: expect.any(String) }),
        expect.objectContaining({ latestResponseData: expect.any(String) }),
      );
    });
  });

  describe("indexContentCheckCompletion", () => {
    beforeEach(() => {
      vm.jobs = [createMockJob("indexTweets")];
    });

    it("should continue when there is more content", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);

      const result = await IndexJobs.indexContentCheckCompletion(
        vm,
        0,
        true,
        "isIndexTweetsFinished",
        "indexTweets_FailedToRetryAfterRateLimit",
        AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
      );

      expect(result).toEqual({
        isComplete: false,
        errorTriggered: false,
        shouldContinue: true,
      });
    });

    it("should scroll up when there is more but no more to scroll", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);

      await IndexJobs.indexContentCheckCompletion(
        vm,
        0,
        false, // moreToScroll = false
        "isIndexTweetsFinished",
        "indexTweets_FailedToRetryAfterRateLimit",
        AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
      );

      expect(vm.scrollUp).toHaveBeenCalledWith(2000);
    });

    it("should complete when verified as done", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(false);
      vi.spyOn(IndexJobs, "indexTweetsVerifyThereIsNoMore").mockResolvedValue(
        true,
      );

      const result = await IndexJobs.indexContentCheckCompletion(
        vm,
        0,
        true,
        "isIndexLikesFinished",
        "indexLikes_FailedToRetryAfterRateLimit",
        AutomationErrorType.x_runJob_indexLikes_VerifyThereIsNoMoreError,
      );

      expect(result).toEqual({
        isComplete: true,
        errorTriggered: false,
        shouldContinue: false,
      });
      expect(vm.progress.isIndexLikesFinished).toBe(true);
      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "indexLikes_FailedToRetryAfterRateLimit",
        "false",
      );
    });
  });

  describe("indexContentProcessIteration", () => {
    beforeEach(() => {
      vm.jobs = [createMockJob("indexTweets")];
      mockElectron.X.resetRateLimitInfo.mockResolvedValue(undefined);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });
    });

    it("should complete full iteration successfully", async () => {
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);
      mockElectron.X.indexParseTweets.mockResolvedValue({
        tweetsIndexed: 10,
      });
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);

      const result = await IndexJobs.indexContentProcessIteration(vm, 0, {
        failureStateKey: "test_failure",
        parseErrorType:
          AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
        verifyErrorType:
          AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
        progressKey: "isIndexTweetsFinished",
      });

      expect(result).toEqual({ shouldContinue: true, errorTriggered: false });
      expect(vm.waitForPause).toHaveBeenCalled();
      expect(vm.scrollToBottom).toHaveBeenCalled();
    });

    it("should handle rate limit and continue", async () => {
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });
      // Set up mocks so indexTweetsHandleRateLimit returns true (via indexContentProcessRateLimit)
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(5) // Before scroll
        .mockResolvedValueOnce(10); // After scroll - more loaded

      const result = await IndexJobs.indexContentProcessIteration(vm, 0, {
        failureStateKey: "test_failure",
        parseErrorType:
          AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
        verifyErrorType:
          AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
        progressKey: "isIndexTweetsFinished",
      });

      expect(result).toEqual({ shouldContinue: true, errorTriggered: false });
    });

    it("should stop when rate limit handling fails", async () => {
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });
      // Set up mocks so indexTweetsHandleRateLimit returns false
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(5); // Same count (no progress)
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0); // No retry button

      const result = await IndexJobs.indexContentProcessIteration(vm, 0, {
        failureStateKey: "test_failure",
        parseErrorType:
          AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
        verifyErrorType:
          AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
        progressKey: "isIndexTweetsFinished",
      });

      expect(result).toEqual({ shouldContinue: false, errorTriggered: false });
    });

    it("should stop when parsing fails", async () => {
      mockElectron.X.indexParseTweets.mockRejectedValue(
        new Error("Parse error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("{}");

      const result = await IndexJobs.indexContentProcessIteration(vm, 0, {
        failureStateKey: "test_failure",
        parseErrorType:
          AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
        verifyErrorType:
          AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
        progressKey: "isIndexTweetsFinished",
      });

      expect(result).toEqual({ shouldContinue: false, errorTriggered: true });
    });

    it("should check for something wrong message", async () => {
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);
      mockElectron.X.indexParseTweets.mockResolvedValue({
        tweetsIndexed: 10,
      });
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);

      // Mock doesSelectorExist to ensure indexTweetsCheckForSomethingWrong gets called
      const checkSpy = vi
        .spyOn(vm, "doesSelectorExist")
        .mockResolvedValue(false);

      await IndexJobs.indexContentProcessIteration(vm, 0, {
        failureStateKey: "test_failure",
        parseErrorType:
          AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
        verifyErrorType:
          AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
        progressKey: "isIndexTweetsFinished",
      });

      // indexTweetsCheckForSomethingWrong calls doesSelectorExist
      // We just need to verify the function runs, which it does when completion doesn't stop iteration
      expect(checkSpy).toHaveBeenCalled();
    });
  });

  describe("runJobIndexTweets", () => {
    beforeEach(() => {
      // Initialize jobs array for tests that modify jobs[jobIndex]
      vm.jobs = [
        createMockJob("indexTweets"),
        createMockJob("indexLikes"),
        createMockJob("indexBookmarks"),
        createMockJob("indexConversations"),
        createMockJob("indexMessages"),
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

  describe("runJobIndexConversations", () => {
    beforeEach(() => {
      // Initialize jobs array for tests that modify jobs[jobIndex]
      vm.jobs = [
        createMockJob("indexTweets"),
        createMockJob("indexLikes"),
        createMockJob("indexBookmarks"),
        createMockJob("indexConversations"),
        createMockJob("indexMessages"),
        createMockJob("archiveTweets"),
      ];
    });

    it("should track analytics event on start", async () => {
      await IndexJobs.runJobIndexConversations(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_CONVERSATIONS,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      await IndexJobs.runJobIndexConversations(vm, 0);

      expect(vm.instructions).toContain(
        "I'm saving your direct message conversations",
      );
    });

    it("should handle no conversations (no search field)", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("section input"),
      );

      await IndexJobs.runJobIndexConversations(vm, 0);

      expect(vm.progress.isIndexConversationsFinished).toBe(true);
      expect(vm.progress.conversationsIndexed).toBe(0);
      expect(vm.waitForLoadingToFinish).toHaveBeenCalled();
    });

    it("should handle rate limits when loading conversations", async () => {
      // First call to conversation list selector fails with timeout, second succeeds
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // search field succeeds
        .mockRejectedValueOnce(new TimeoutError("cellInnerDiv")) // conversation list fails
        .mockResolvedValueOnce(undefined) // search field succeeds on retry
        .mockResolvedValueOnce(undefined); // conversation list succeeds on retry

      mockElectron.X.isRateLimited
        .mockResolvedValueOnce({
          isRateLimited: true,
          rateLimitReset: Date.now() + 1000,
        })
        .mockResolvedValueOnce({
          isRateLimited: false,
          rateLimitReset: 0,
        });

      await IndexJobs.runJobIndexConversations(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should handle URLChangedError", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // search field
        .mockRejectedValueOnce(
          new URLChangedError("https://x.com/messages", "https://x.com/other"),
        );

      const result = await IndexJobs.runJobIndexConversations(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle generic errors", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // search field
        .mockRejectedValueOnce(new Error("Generic error"));

      const result = await IndexJobs.runJobIndexConversations(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should parse conversations and update progress", async () => {
      vi.spyOn(vm, "scrollToBottom")
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseConversations
        .mockResolvedValueOnce({
          ...vm.progress,
          conversationsIndexed: 5,
          isIndexConversationsFinished: false,
        })
        .mockResolvedValueOnce({
          ...vm.progress,
          conversationsIndexed: 5,
          isIndexConversationsFinished: false,
        });

      mockElectron.X.indexIsThereMore
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await IndexJobs.runJobIndexConversations(vm, 0);

      expect(mockElectron.X.indexParseConversations).toHaveBeenCalled();
      expect(vm.progress.isIndexConversationsFinished).toBe(true);
    });

    it("should handle ParseConversationsError", async () => {
      vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseConversations.mockRejectedValue(
        new Error("Parse error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("response data");

      const result = await IndexJobs.runJobIndexConversations(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should scroll up when not finished but at bottom", async () => {
      vi.spyOn(vm, "scrollToBottom")
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseConversations.mockResolvedValue({
        ...vm.progress,
        conversationsIndexed: 5,
        isIndexConversationsFinished: false,
      });

      mockElectron.X.indexIsThereMore
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await IndexJobs.runJobIndexConversations(vm, 0);

      expect(vm.scrollUp).toHaveBeenCalledWith(1000);
    });
  });

  describe("runJobIndexMessages", () => {
    beforeEach(() => {
      // Initialize jobs array for tests that modify jobs[jobIndex]
      vm.jobs = [
        createMockJob("indexTweets"),
        createMockJob("indexLikes"),
        createMockJob("indexBookmarks"),
        createMockJob("indexConversations"),
        createMockJob("indexMessages"),
        createMockJob("archiveTweets"),
      ];
    });

    it("should track analytics event on start", async () => {
      const mockMessagesData: XIndexMessagesStartResponse = {
        conversationIDs: [],
        totalConversations: 0,
      };

      mockElectron.X.indexMessagesStart.mockResolvedValue(mockMessagesData);

      await IndexJobs.runJobIndexMessages(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_MESSAGES,
        navigator.userAgent,
      );
    });

    it("should handle error when indexMessagesStart fails", async () => {
      mockElectron.X.indexMessagesStart.mockRejectedValue(
        new Error("Failed to start"),
      );

      const result = await IndexJobs.runJobIndexMessages(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should process multiple conversations", async () => {
      const mockMessagesData: XIndexMessagesStartResponse = {
        conversationIDs: ["conv1", "conv2"],
        totalConversations: 2,
      };

      mockElectron.X.indexMessagesStart.mockResolvedValue(mockMessagesData);
      vi.spyOn(vm, "scrollToTop").mockResolvedValue(false);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseMessages.mockResolvedValue({
        ...vm.progress,
        isIndexMessagesFinished: false,
      });

      await IndexJobs.runJobIndexMessages(vm, 0);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/messages/conv1",
      );
      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/messages/conv2",
      );
      expect(mockElectron.X.indexConversationFinished).toHaveBeenCalledTimes(2);
    });

    it("should handle timeout when loading conversation", async () => {
      const mockMessagesData: XIndexMessagesStartResponse = {
        conversationIDs: ["conv1"],
        totalConversations: 1,
      };

      mockElectron.X.indexMessagesStart.mockResolvedValue(mockMessagesData);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new TimeoutError("DmActivityContainer"),
      );

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      await IndexJobs.runJobIndexMessages(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle URLChangedError and skip inaccessible conversation", async () => {
      const mockMessagesData: XIndexMessagesStartResponse = {
        conversationIDs: ["conv1"],
        totalConversations: 1,
      };

      mockElectron.X.indexMessagesStart.mockResolvedValue(mockMessagesData);
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new URLChangedError(
          "https://x.com/messages/conv1",
          "https://x.com/i/verified-get-verified",
        ),
      );

      await IndexJobs.runJobIndexMessages(vm, 0);

      expect(vm.progress.conversationMessagesIndexed).toBe(1);
      expect(mockElectron.X.indexConversationFinished).toHaveBeenCalledWith(
        1,
        "conv1",
      );
    });

    it("should handle ParseMessagesError", async () => {
      const mockMessagesData: XIndexMessagesStartResponse = {
        conversationIDs: ["conv1"],
        totalConversations: 1,
      };

      mockElectron.X.indexMessagesStart.mockResolvedValue(mockMessagesData);
      vi.spyOn(vm, "scrollToTop").mockResolvedValue(true);

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      mockElectron.X.indexParseMessages.mockRejectedValue(
        new Error("Parse error"),
      );
      mockElectron.X.getLatestResponseData.mockResolvedValue("response data");

      await IndexJobs.runJobIndexMessages(vm, 0);

      expect(vm.error).toHaveBeenCalled();
    });

    it("should handle rate limits during message loading", async () => {
      const mockMessagesData: XIndexMessagesStartResponse = {
        conversationIDs: ["conv1"],
        totalConversations: 1,
      };

      mockElectron.X.indexMessagesStart.mockResolvedValue(mockMessagesData);
      vi.spyOn(vm, "waitForSelector")
        .mockRejectedValueOnce(new TimeoutError("DmActivityContainer"))
        .mockResolvedValueOnce(undefined);

      mockElectron.X.isRateLimited
        .mockResolvedValueOnce({
          isRateLimited: true,
          rateLimitReset: Date.now() + 1000,
        })
        .mockResolvedValueOnce({
          isRateLimited: false,
          rateLimitReset: 0,
        });

      vi.spyOn(vm, "scrollToTop").mockResolvedValue(false);
      mockElectron.X.indexParseMessages.mockResolvedValue({
        ...vm.progress,
        isIndexMessagesFinished: false,
      });

      await IndexJobs.runJobIndexMessages(vm, 0);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });
  });

  describe("runJobIndexLikes", () => {
    beforeEach(() => {
      // Initialize jobs array for tests that modify jobs[jobIndex]
      vm.jobs = [
        createMockJob("indexTweets"),
        createMockJob("indexLikes"),
        createMockJob("indexBookmarks"),
        createMockJob("indexConversations"),
        createMockJob("indexMessages"),
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
        createMockJob("indexConversations"),
        createMockJob("indexMessages"),
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
