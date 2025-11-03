import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as IndexHelpers from "./index";
import type { XViewModel } from "../view_model";
import { TimeoutError, URLChangedError } from "../../BaseViewModel";
import { AutomationErrorType } from "../../../automation_errors";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../../test_util";
import { createMockXViewModel, createMockJob } from "../test_util";

describe("helpers_shared.ts", () => {
  let vm: XViewModel;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    // Setup default mock implementations
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
    vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "scrollUp").mockResolvedValue(undefined);
    vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);
    vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
    vi.spyOn(vm, "syncProgress").mockResolvedValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("indexContentCheckIfEmpty", () => {
    it("should return true and update progress when empty state selector exists", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);

      const result = await IndexHelpers.indexContentCheckIfEmpty(
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

      const result = await IndexHelpers.indexContentCheckIfEmpty(
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

      const result = await IndexHelpers.indexContentCheckIfEmpty(
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

      const result = await IndexHelpers.indexContentWaitForInitialLoad(
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

      const result = await IndexHelpers.indexContentWaitForInitialLoad(
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

      const result = await IndexHelpers.indexContentWaitForInitialLoad(
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

      const result = await IndexHelpers.indexContentWaitForInitialLoad(
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

      const result = await IndexHelpers.indexContentWaitForInitialLoad(
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

      const result = await IndexHelpers.indexContentProcessRateLimit(
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

      const result = await IndexHelpers.indexContentProcessRateLimit(
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

      const result = await IndexHelpers.indexContentParsePage(
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

      const result = await IndexHelpers.indexContentParsePage(
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

      const result = await IndexHelpers.indexContentCheckCompletion(
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

      await IndexHelpers.indexContentCheckCompletion(
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
      vi.spyOn(
        IndexHelpers,
        "indexTweetsVerifyThereIsNoMore",
      ).mockResolvedValue(true);

      const result = await IndexHelpers.indexContentCheckCompletion(
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

      const result = await IndexHelpers.indexContentProcessIteration(vm, 0, {
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

      const result = await IndexHelpers.indexContentProcessIteration(vm, 0, {
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

      const result = await IndexHelpers.indexContentProcessIteration(vm, 0, {
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

      const result = await IndexHelpers.indexContentProcessIteration(vm, 0, {
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

      await IndexHelpers.indexContentProcessIteration(vm, 0, {
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
});
