import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as DeleteHelpers from "./index";
import type { XViewModel } from "../view_model";
import { TimeoutError, URLChangedError } from "../../BaseViewModel";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../../test_util";
import { createMockXViewModel } from "../test_util";

describe("helpers_pages.ts", () => {
  let vm: XViewModel;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    vi.spyOn(vm, "log").mockReturnValue(undefined);
    vi.spyOn(vm, "loadURLWithRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "syncProgress").mockResolvedValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("deleteDMsLoadDMsPage", () => {
    it("should load messages page", async () => {
      await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/messages",
      );
    });

    it("should wait for search text field with 30 second timeout", async () => {
      await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'section input[type="text"]',
        "https://x.com/messages",
        30000,
      );
    });

    it("should wait for conversation list", async () => {
      await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'section div div[role="tablist"] div[data-testid="cellInnerDiv"]',
        "https://x.com/messages",
      );
    });

    it("should return false and mark as finished when no conversations exist (no search field)", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValueOnce(
        new TimeoutError("test-selector"),
      );

      const result = await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(result).toBe(false);
      expect(vm.progress.isDeleteDMsFinished).toBe(true);
      expect(vm.syncProgress).toHaveBeenCalled();
    });

    it("should return false and mark as finished when selector times out (no conversations)", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // Search field exists
        .mockRejectedValueOnce(new TimeoutError("test-selector")); // No conversations

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(result).toBe(false);
      expect(vm.progress.isDeleteDMsFinished).toBe(true);
    });

    it("should handle rate limits and retry", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // Search field exists
        .mockRejectedValueOnce(new TimeoutError("test-selector")) // Timeout (rate limited)
        .mockResolvedValueOnce(undefined); // Retry succeeds

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 60000,
      });

      const result = await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle URL changed error and retry", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockResolvedValueOnce(undefined) // Search field exists
        .mockRejectedValueOnce(
          new URLChangedError("https://x.com/old", "https://x.com/new"),
        )
        .mockResolvedValueOnce(undefined) // Retry succeeds
        .mockResolvedValueOnce(undefined);

      const result = await DeleteHelpers.deleteDMsLoadDMsPage(vm);

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

      const result = await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(result).toBe(true);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should reset rate limit info before waiting for conversations", async () => {
      await DeleteHelpers.deleteDMsLoadDMsPage(vm);

      expect(mockElectron.X.resetRateLimitInfo).toHaveBeenCalledWith(1);
    });
  });

  describe("unfollowEveryoneLoadPage", () => {
    it("should load following page with correct username", async () => {
      await DeleteHelpers.unfollowEveryoneLoadPage(vm);

      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/testuser/following",
      );
    });

    it("should wait for following users to appear with 2 second timeout", async () => {
      await DeleteHelpers.unfollowEveryoneLoadPage(vm);

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

      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.unfollowEveryoneLoadPage(vm);

      expect(result).toBe(false);
      expect(vm.progress.isUnfollowEveryoneFinished).toBe(true);
      expect(vm.syncProgress).toHaveBeenCalled();
    });

    it("should handle rate limits and retry", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockRejectedValueOnce(new TimeoutError("test-selector"))
        .mockResolvedValueOnce(undefined);

      mockElectron.X.isRateLimited.mockResolvedValueOnce({
        isRateLimited: true,
        rateLimitReset: Date.now() + 60000,
      });

      const result = await DeleteHelpers.unfollowEveryoneLoadPage(vm);

      expect(vm.waitForRateLimit).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle URL changed error and retry", async () => {
      vi.spyOn(vm, "waitForSelector")
        .mockRejectedValueOnce(
          new URLChangedError("https://x.com/old", "https://x.com/new"),
        )
        .mockResolvedValueOnce(undefined);

      const result = await DeleteHelpers.unfollowEveryoneLoadPage(vm);

      expect(vm.sleep).toHaveBeenCalledWith(1000);
      expect(result).toBe(false);
    });

    it("should return true and log error after 3 failed attempts", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(
        new Error("Test error"),
      );

      const result = await DeleteHelpers.unfollowEveryoneLoadPage(vm);

      expect(result).toBe(true);
      expect(vm.error).toHaveBeenCalled();
    });

    it("should return false on success", async () => {
      vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);

      const result = await DeleteHelpers.unfollowEveryoneLoadPage(vm);

      expect(result).toBe(false);
    });
  });
});
