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
        '[data-testid$="-unfollow"]',
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
