import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as DeleteHelpers from "./index";
import type { XViewModel } from "../view_model";
import { AutomationErrorType } from "../../../automation_errors";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../../test_util";
import { createMockXViewModel } from "../test_util";

describe("helpers_shared.ts", () => {
  let vm: XViewModel;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    vi.spyOn(vm, "log").mockReturnValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("deleteContentGetCookie", () => {
    it("should return ct0 cookie when it exists", async () => {
      mockElectron.X.getCookie.mockResolvedValue("test-ct0-cookie");

      const result = await DeleteHelpers.deleteContentGetCookie(
        vm,
        AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
      );

      expect(result).toBe("test-ct0-cookie");
      expect(mockElectron.X.getCookie).toHaveBeenCalledWith(1, "x.com", "ct0");
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should return null and trigger error when cookie is not found", async () => {
      mockElectron.X.getCookie.mockResolvedValue(null);

      const result = await DeleteHelpers.deleteContentGetCookie(
        vm,
        AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
      );

      expect(result).toBeNull();
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
        {},
      );
    });
  });

  describe("deleteContentRetryLoop", () => {
    it("should return success on first try with status 200", async () => {
      const mockDeleteFn = vi.fn().mockResolvedValue(200);

      const result = await DeleteHelpers.deleteContentRetryLoop(
        vm,
        mockDeleteFn,
      );

      expect(result).toEqual({ success: true, statusCode: 200 });
      expect(mockDeleteFn).toHaveBeenCalledTimes(1);
    });

    it("should retry on non-200, non-429 status codes", async () => {
      const mockDeleteFn = vi
        .fn()
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(200);
      vi.spyOn(vm, "sleep").mockResolvedValue(undefined);

      const result = await DeleteHelpers.deleteContentRetryLoop(
        vm,
        mockDeleteFn,
      );

      expect(result).toEqual({ success: true, statusCode: 200 });
      expect(mockDeleteFn).toHaveBeenCalledTimes(3);
      expect(vm.sleep).toHaveBeenCalledTimes(2);
      expect(vm.sleep).toHaveBeenCalledWith(1000);
    });

    it("should handle rate limit (429) and reset tries", async () => {
      const mockDeleteFn = vi
        .fn()
        .mockResolvedValueOnce(429)
        .mockResolvedValueOnce(200);
      vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      const result = await DeleteHelpers.deleteContentRetryLoop(
        vm,
        mockDeleteFn,
      );

      expect(result).toEqual({ success: true, statusCode: 200 });
      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should return failure after 3 unsuccessful tries", async () => {
      const mockDeleteFn = vi.fn().mockResolvedValue(500);
      vi.spyOn(vm, "sleep").mockResolvedValue(undefined);

      const result = await DeleteHelpers.deleteContentRetryLoop(
        vm,
        mockDeleteFn,
      );

      expect(result).toEqual({ success: false, statusCode: 500 });
      expect(mockDeleteFn).toHaveBeenCalledTimes(3);
    });
  });

  describe("deleteContentUpdateDatabase", () => {
    it("should return true when update succeeds", async () => {
      const mockUpdateFn = vi.fn().mockResolvedValue(undefined);

      const result = await DeleteHelpers.deleteContentUpdateDatabase(
        vm,
        mockUpdateFn,
        AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp,
        { id: "123" },
        0,
      );

      expect(result).toBe(true);
      expect(mockUpdateFn).toHaveBeenCalled();
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should return false and trigger error when update fails", async () => {
      const mockUpdateFn = vi.fn().mockRejectedValue(new Error("DB error"));

      const result = await DeleteHelpers.deleteContentUpdateDatabase(
        vm,
        mockUpdateFn,
        AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp,
        { id: "123" },
        0,
      );

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp,
        { error: expect.stringContaining("DB error") },
        { item: { id: "123" }, index: 0 },
        true,
      );
    });
  });

  describe("deleteContentHandleFailure", () => {
    it("should trigger error and update error count", async () => {
      vi.spyOn(vm, "syncProgress").mockResolvedValue(undefined);
      vm.progress.errorsOccured = 0;

      await DeleteHelpers.deleteContentHandleFailure(
        vm,
        AutomationErrorType.x_runJob_deleteTweets_FailedToDelete,
        500,
        { id: "123" },
        0,
      );

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_FailedToDelete,
        { statusCode: 500 },
        { item: { id: "123" }, index: 0 },
        true,
      );
      expect(vm.progress.errorsOccured).toBe(1);
      expect(vm.syncProgress).toHaveBeenCalled();
    });
  });
});
