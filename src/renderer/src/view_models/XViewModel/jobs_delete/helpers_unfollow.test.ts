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

describe("helpers_unfollow.ts", () => {
  let vm: XViewModel;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    vi.spyOn(vm, "log").mockReturnValue(undefined);
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "scriptMouseoverElementFirst").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElementFirst").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(1);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("unfollowEveryoneCheckIfFinished", () => {
    it("should return false when not finished", async () => {
      vm.progress.isUnfollowEveryoneFinished = false;

      const result = await DeleteHelpers.unfollowEveryoneCheckIfFinished(vm);

      expect(result).toBe(false);
    });

    it("should return true when finished", async () => {
      vm.progress.isUnfollowEveryoneFinished = true;

      const result = await DeleteHelpers.unfollowEveryoneCheckIfFinished(vm);

      expect(result).toBe(true);
      expect(vm.log).toHaveBeenCalledWith("unfollowEveryoneCheckIfFinished", [
        "no more following users, ending job",
      ]);
    });
  });

  describe("unfollowEveryoneUnfollowAccount", () => {
    it("should successfully unfollow an account", async () => {
      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm);

      expect(result).toEqual({
        success: true,
        shouldRetry: false,
        shouldReload: false,
      });
      expect(vm.scriptMouseoverElementFirst).toHaveBeenCalledWith(
        '[data-testid$="-unfollow"]',
      );
      expect(vm.scriptClickElementFirst).toHaveBeenCalledWith(
        '[data-testid$="-unfollow"]',
      );
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
      expect(mockElectron.X.isRateLimited).toHaveBeenCalled();
      expect(vm.waitForRateLimit).not.toHaveBeenCalled();
    });

    it("should fail if mouseover fails", async () => {
      vi.spyOn(vm, "scriptMouseoverElementFirst").mockResolvedValue(false);

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm);

      expect(result).toEqual({
        success: false,
        shouldRetry: false,
        shouldReload: true,
      });
    });

    it("should fail if click following button fails", async () => {
      vi.spyOn(vm, "scriptClickElementFirst").mockResolvedValue(false);

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm);

      expect(result).toEqual({
        success: false,
        shouldRetry: false,
        shouldReload: true,
      });
    });

    it("should handle errors during confirmation", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(new Error("Error"));
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm);

      expect(result).toEqual({
        success: false,
        shouldRetry: false,
        shouldReload: true,
      });
      expect(vm.waitForRateLimit).not.toHaveBeenCalled();
    });

    it("should wait and retry when the confirm button never appears due to a rate limit", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(new Error("Error"));
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm);

      expect(result).toEqual({
        success: false,
        shouldRetry: true,
        shouldReload: true,
      });
      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should wait and retry when rate limited after clicking confirm", async () => {
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm);

      expect(result).toEqual({
        success: false,
        shouldRetry: true,
        shouldReload: true,
      });
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });
  });

  describe("unfollowEveryoneProcessIteration", () => {
    beforeEach(() => {
      vm.progress.accountsUnfollowed = 0;
    });

    it("should return success when finished", async () => {
      vm.progress.isUnfollowEveryoneFinished = true;

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(vm);

      expect(result).toEqual({
        success: true,
        errorTriggered: false,
        errorType: null,
        shouldReload: false,
      });
    });

    it("should always unfollow the first account in the list", async () => {
      // X swaps the unfollowed account's button from "-unfollow" to "-follow",
      // so the rest of the list shifts up. Walking an index would skip every
      // other account.
      vm.progress.isUnfollowEveryoneFinished = false;

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(vm);

      expect(result.success).toBe(true);
      expect(result.errorTriggered).toBe(false);
      expect(result.shouldReload).toBe(false);
      expect(vm.scriptMouseoverElementFirst).toHaveBeenCalledWith(
        '[data-testid$="-unfollow"]',
      );
      expect(vm.scriptClickElementFirst).toHaveBeenCalledWith(
        '[data-testid$="-unfollow"]',
      );
      expect(vm.progress.accountsUnfollowed).toBe(1);
      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "totalAccountsUnfollowed",
        "1",
      );
    });

    it("should reload when no accounts are left on the page", async () => {
      vm.progress.isUnfollowEveryoneFinished = false;
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(vm);

      expect(result.success).toBe(true);
      expect(result.shouldReload).toBe(true);
    });

    it("should handle unfollow failure", async () => {
      vm.progress.isUnfollowEveryoneFinished = false;
      vi.spyOn(vm, "scriptMouseoverElementFirst").mockResolvedValue(false);

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(vm);

      expect(result.errorTriggered).toBe(true);
      expect(result.errorType).toBe(
        AutomationErrorType.x_runJob_unfollowEveryone_MouseoverFailed,
      );
      expect(result.shouldReload).toBe(true);
    });

    it("should not trigger an error when rate limited", async () => {
      // Rate limited after clicking confirm: the account wasn't actually unfollowed,
      // so the job must retry it rather than report an error or move on.
      vm.progress.isUnfollowEveryoneFinished = false;
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(vm);

      expect(result.success).toBe(false);
      expect(result.errorTriggered).toBe(false);
      expect(result.errorType).toBe(null);
      expect(result.shouldReload).toBe(true);
      expect(vm.waitForRateLimit).toHaveBeenCalled();
      // The account should not be counted as unfollowed
      expect(vm.progress.accountsUnfollowed).toBe(0);
    });
  });
});
