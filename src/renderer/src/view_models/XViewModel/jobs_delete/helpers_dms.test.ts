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

describe("helpers_dms.ts", () => {
  let vm: XViewModel;
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    vi.spyOn(vm, "log").mockReturnValue(undefined);
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForSelectorWithinSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "scriptMouseoverElementFirst").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElementWithinElementFirst").mockResolvedValue(
      true,
    );
    vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);
    vi.spyOn(vm, "waitForRateLimit").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("deleteDMsCheckIfFinished", () => {
    it("should return false when not finished", async () => {
      vm.progress.isDeleteDMsFinished = false;

      const result = await DeleteHelpers.deleteDMsCheckIfFinished(vm);

      expect(result).toBe(false);
      expect(mockElectron.X.deleteDMsMarkAllDeleted).not.toHaveBeenCalled();
    });

    it("should return true and mark all deleted when finished", async () => {
      vm.progress.isDeleteDMsFinished = true;

      const result = await DeleteHelpers.deleteDMsCheckIfFinished(vm);

      expect(result).toBe(true);
      expect(mockElectron.X.deleteDMsMarkAllDeleted).toHaveBeenCalledWith(1);
      expect(vm.log).toHaveBeenCalledWith("deleteDMsCheckIfFinished", [
        "no more conversations, ending job",
      ]);
    });
  });

  describe("deleteDMsWaitForConversation", () => {
    it("should return success when conversation selector appears", async () => {
      const result = await DeleteHelpers.deleteDMsWaitForConversation(vm);

      expect(result).toEqual({
        success: true,
        shouldRetry: false,
        shouldReload: false,
      });
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'div[data-testid="conversation"]',
      );
    });

    it("should handle rate limit and suggest retry", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(new Error("Timeout"));
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: true,
        rateLimitReset: Date.now() + 1000,
      });

      const result = await DeleteHelpers.deleteDMsWaitForConversation(vm);

      expect(result).toEqual({
        success: false,
        shouldRetry: true,
        shouldReload: true,
      });
      expect(vm.waitForRateLimit).toHaveBeenCalled();
    });

    it("should handle non-rate-limit errors", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(new Error("Error"));
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.deleteDMsWaitForConversation(vm);

      expect(result).toEqual({
        success: false,
        shouldRetry: false,
        shouldReload: true,
      });
      expect(vm.log).toHaveBeenCalledWith("deleteDMsWaitForConversation", [
        "wait failed",
      ]);
    });
  });

  describe("deleteDMsMouseoverAndOpenMenu", () => {
    it("should successfully mouseover and open menu", async () => {
      const result = await DeleteHelpers.deleteDMsMouseoverAndOpenMenu(vm);

      expect(result).toEqual({ success: true, shouldReload: false });
      expect(vm.scriptMouseoverElementFirst).toHaveBeenCalledWith(
        'div[data-testid="conversation"]',
      );
      expect(vm.waitForSelectorWithinSelector).toHaveBeenCalledWith(
        'div[data-testid="conversation"]',
        "button",
      );
      expect(vm.scriptClickElementWithinElementFirst).toHaveBeenCalledWith(
        'div[data-testid="conversation"]',
        "button",
      );
    });

    it("should fail if mouseover fails", async () => {
      vi.spyOn(vm, "scriptMouseoverElementFirst").mockResolvedValue(false);

      const result = await DeleteHelpers.deleteDMsMouseoverAndOpenMenu(vm);

      expect(result).toEqual({ success: false, shouldReload: true });
    });

    it("should fail if wait for menu button fails", async () => {
      vi.spyOn(vm, "waitForSelectorWithinSelector").mockRejectedValue(
        new Error("Timeout"),
      );
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.deleteDMsMouseoverAndOpenMenu(vm);

      expect(result).toEqual({ success: false, shouldReload: true });
    });

    it("should fail if menu button click fails", async () => {
      vi.spyOn(vm, "scriptClickElementWithinElementFirst").mockResolvedValue(
        false,
      );

      const result = await DeleteHelpers.deleteDMsMouseoverAndOpenMenu(vm);

      expect(result).toEqual({ success: false, shouldReload: true });
    });
  });

  describe("deleteDMsClickDeleteAndConfirm", () => {
    it("should successfully click delete and confirm", async () => {
      const result = await DeleteHelpers.deleteDMsClickDeleteAndConfirm(vm);

      expect(result).toEqual({ success: true, shouldReload: false });
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
    });

    it("should fail if wait for delete button fails", async () => {
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(new Error("Timeout"));
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.deleteDMsClickDeleteAndConfirm(vm);

      expect(result).toEqual({ success: false, shouldReload: true });
    });

    it("should fail if delete button click fails", async () => {
      vi.spyOn(vm, "scriptClickElement")
        .mockResolvedValueOnce(false) // First click (delete button)
        .mockResolvedValueOnce(true); // Second click (confirm)

      const result = await DeleteHelpers.deleteDMsClickDeleteAndConfirm(vm);

      expect(result).toEqual({ success: false, shouldReload: true });
    });

    it("should fail if confirm button click fails", async () => {
      vi.spyOn(vm, "scriptClickElement")
        .mockResolvedValueOnce(true) // First click (delete button)
        .mockResolvedValueOnce(false); // Second click (confirm)

      const result = await DeleteHelpers.deleteDMsClickDeleteAndConfirm(vm);

      expect(result).toEqual({ success: false, shouldReload: true });
    });
  });

  describe("deleteDMsProcessIteration", () => {
    beforeEach(() => {
      vm.progress.conversationsDeleted = 0;
    });

    it("should return success when finished", async () => {
      vm.progress.isDeleteDMsFinished = true;

      const result = await DeleteHelpers.deleteDMsProcessIteration(vm);

      expect(result).toEqual({
        success: true,
        errorTriggered: false,
        errorType: null,
        shouldReload: false,
      });
    });

    it("should successfully delete a conversation", async () => {
      vm.progress.isDeleteDMsFinished = false;

      const result = await DeleteHelpers.deleteDMsProcessIteration(vm);

      expect(result.success).toBe(true);
      expect(result.errorTriggered).toBe(false);
      expect(vm.progress.conversationsDeleted).toBe(1);
      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "totalConversationsDeleted",
        "1",
      );
    });

    it("should handle wait for conversation failure", async () => {
      vm.progress.isDeleteDMsFinished = false;
      vi.spyOn(vm, "waitForSelector").mockRejectedValue(new Error("Error"));
      mockElectron.X.isRateLimited.mockResolvedValue({
        isRateLimited: false,
        rateLimitReset: 0,
      });

      const result = await DeleteHelpers.deleteDMsProcessIteration(vm);

      expect(result.errorTriggered).toBe(true);
      expect(result.errorType).toBe(
        AutomationErrorType.x_runJob_deleteDMs_WaitForConversationsFailed,
      );
    });

    it("should handle mouseover failure", async () => {
      vm.progress.isDeleteDMsFinished = false;
      vi.spyOn(vm, "scriptMouseoverElementFirst").mockResolvedValue(false);

      const result = await DeleteHelpers.deleteDMsProcessIteration(vm);

      expect(result.errorTriggered).toBe(true);
      expect(result.errorType).toBe(
        AutomationErrorType.x_runJob_deleteDMs_MouseoverFailed,
      );
    });

    it("should handle delete failure", async () => {
      vm.progress.isDeleteDMsFinished = false;
      vi.spyOn(vm, "scriptClickElement")
        .mockResolvedValueOnce(false) // Delete button fails
        .mockResolvedValueOnce(true);

      const result = await DeleteHelpers.deleteDMsProcessIteration(vm);

      expect(result.errorTriggered).toBe(true);
      expect(result.errorType).toBe(
        AutomationErrorType.x_runJob_deleteDMs_ClickDeleteFailed,
      );
    });
  });
});
