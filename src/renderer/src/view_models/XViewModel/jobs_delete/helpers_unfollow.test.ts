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
    vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
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
      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm, 0);

      expect(result).toEqual({ success: true, shouldReload: false });
      expect(vm.scriptMouseoverElementNth).toHaveBeenCalledWith(
        'div[data-testid="cellInnerDiv"] button button',
        0,
      );
      expect(vm.scriptClickElementNth).toHaveBeenCalledWith(
        'div[data-testid="cellInnerDiv"] button button',
        0,
      );
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
    });

    it("should fail if mouseover fails", async () => {
      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(false);

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm, 0);

      expect(result).toEqual({ success: false, shouldReload: true });
    });

    it("should fail if click following button fails", async () => {
      vi.spyOn(vm, "scriptClickElementNth").mockResolvedValue(false);

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm, 0);

      expect(result).toEqual({ success: false, shouldReload: true });
    });

    it("should handle errors during confirmation", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(new Error("Error"));
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.unfollowEveryoneUnfollowAccount(vm, 0);

      expect(result).toEqual({ success: false, shouldReload: true });
    });
  });

  describe("unfollowEveryoneProcessIteration", () => {
    beforeEach(() => {
      vm.progress.accountsUnfollowed = 0;
    });

    it("should return success when finished", async () => {
      vm.progress.isUnfollowEveryoneFinished = true;

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(
        vm,
        0,
        100,
      );

      expect(result).toEqual({
        success: true,
        errorTriggered: false,
        errorType: null,
        shouldReload: false,
        newAccountIndex: 0,
      });
    });

    it("should successfully unfollow an account and increment index", async () => {
      vm.progress.isUnfollowEveryoneFinished = false;

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(
        vm,
        5,
        100,
      );

      expect(result.success).toBe(true);
      expect(result.errorTriggered).toBe(false);
      expect(result.newAccountIndex).toBe(6); // Should increment after successful unfollow
      expect(vm.progress.accountsUnfollowed).toBe(1);
      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "totalAccountsUnfollowed",
        "1",
      );
    });

    it("should reload and reset index when reaching end", async () => {
      vm.progress.isUnfollowEveryoneFinished = false;

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(
        vm,
        99,
        100,
      );

      expect(result.shouldReload).toBe(true);
      expect(result.newAccountIndex).toBe(0);
    });

    it("should handle unfollow failure", async () => {
      vm.progress.isUnfollowEveryoneFinished = false;
      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(false);

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(
        vm,
        0,
        100,
      );

      expect(result.errorTriggered).toBe(true);
      expect(result.errorType).toBe(
        AutomationErrorType.x_runJob_unfollowEveryone_MouseoverFailed,
      );
    });

    it("should keep same index when reload needed on error", async () => {
      vm.progress.isUnfollowEveryoneFinished = false;
      vi.spyOn(vm, "scriptMouseoverElementNth").mockResolvedValue(false);

      const result = await DeleteHelpers.unfollowEveryoneProcessIteration(
        vm,
        10,
        100,
      );

      expect(result.newAccountIndex).toBe(10); // Index stays the same on failure
      expect(result.shouldReload).toBe(true);
    });
  });
});
