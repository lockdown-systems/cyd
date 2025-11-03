import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as IndexHelpers from "./index";
import type { XViewModel } from "../view_model";
import { TimeoutError } from "../../BaseViewModel";
import type { XTweetItemArchive } from "../../../../../shared_types";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../../test_util";
import { createMockXViewModel } from "../test_util";

describe("helpers_archive.ts", () => {
  let vm: XViewModel;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    // Setup default mock implementations
    vi.spyOn(vm, "loadURLWithRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
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

      const result = await IndexHelpers.archiveSaveTweet(
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

      await IndexHelpers.archiveSaveTweet(vm, "/output/path", mockTweetItem);

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

      await IndexHelpers.archiveSaveTweet(vm, "/output/path", mockTweetItem);

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

      await IndexHelpers.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      // Should still save the page even if selector times out
      expect(mockElectron.archive.savePage).toHaveBeenCalled();
    });

    it("should return false and log error when webContentsID is null", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);
      vm.webContentsID = null;

      const result = await IndexHelpers.archiveSaveTweet(
        vm,
        "/output/path",
        mockTweetItem,
      );

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should update archiveTweet in database", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);

      await IndexHelpers.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      expect(mockElectron.X.archiveTweet).toHaveBeenCalledWith(1, "123");
    });

    it("should handle errors when updating database", async () => {
      mockElectron.archive.isPageAlreadySaved.mockResolvedValue(false);
      mockElectron.X.archiveTweet.mockRejectedValue(
        new Error("Database error"),
      );

      await IndexHelpers.archiveSaveTweet(vm, "/output/path", mockTweetItem);

      expect(vm.error).toHaveBeenCalled();
    });
  });
});
