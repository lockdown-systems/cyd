import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as IndexJobs from "./jobs_index";
import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { TimeoutError } from "../BaseViewModel";
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
      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_TWEETS,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
      expect(vm.instructions).toContain("I'm saving your tweets");
    });

    it("should start indexing", async () => {
      await IndexJobs.runJobIndexTweets(vm, 0);

      expect(mockElectron.X.indexStart).toHaveBeenCalledWith(1);
    });

    it("should finish job after completion", async () => {
      await IndexJobs.runJobIndexTweets(vm, 5);

      expect(vm.finishJob).toHaveBeenCalledWith(5);
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
  });

  describe("runJobIndexMessages", () => {
    it("should track analytics event on start", async () => {
      const mockMessagesData: XIndexMessagesStartResponse = {
        conversationIDs: [],
        totalConversations: 0,
      };

      mockElectron.X.indexStart.mockResolvedValue(mockMessagesData);

      await IndexJobs.runJobIndexMessages(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_MESSAGES,
        navigator.userAgent,
      );
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
      await IndexJobs.runJobIndexLikes(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_LIKES,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      await IndexJobs.runJobIndexLikes(vm, 0);

      expect(vm.instructions).toContain("I'm saving your likes");
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
      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_INDEX_BOOKMARKS,
        navigator.userAgent,
      );
    });

    it("should set correct UI state", async () => {
      await IndexJobs.runJobIndexBookmarks(vm, 0);

      expect(vm.instructions).toContain("I'm saving your bookmarks");
    });
  });
});
