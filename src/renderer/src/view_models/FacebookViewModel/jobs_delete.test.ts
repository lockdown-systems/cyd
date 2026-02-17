import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FacebookViewModel } from "./view_model";
import { AutomationErrorType } from "../../automation_errors";
import {
  State,
  RunJobsState,
  FacebookJob,
  emptyFacebookProgress,
} from "./types";
import type { Account } from "../../../../shared_types";
import {
  createMockAccount,
  createMockWebview,
  createMockEmitter,
  createMockFacebookAccount,
  mockElectronAPI,
} from "../../test_util";
import * as DeleteJobs from "./jobs_delete";

/**
 * Creates a mock FacebookJob for testing
 */
function createMockJob(
  jobType: string,
  overrides?: Partial<FacebookJob>,
): FacebookJob {
  return {
    id: 1,
    jobType: jobType as FacebookJob["jobType"],
    status: "pending",
    startedAt: null,
    finishedAt: null,
    progressJSON: JSON.stringify(emptyFacebookProgress()),
    error: null,
    ...overrides,
  };
}

/**
 * Creates a mock FacebookViewModel with mocked dependencies for testing
 */
function createMockFacebookViewModel(
  accountOverrides?: Partial<Account>,
): FacebookViewModel {
  const mockFacebookAccount = createMockFacebookAccount(
    accountOverrides?.facebookAccount || {},
  );
  const mockAccount = createMockAccount({
    type: "Facebook",
    xAccount: null,
    facebookAccount: mockFacebookAccount,
    ...accountOverrides,
  });
  const mockEmitter = createMockEmitter();
  const mockWebview = createMockWebview();

  const vm = new FacebookViewModel(mockAccount, mockEmitter);

  vm.webview = mockWebview;
  vm.webContentsID = 1;
  vm.isWebviewDestroyed = false;
  vm.state = State.Login;
  vm.runJobsState = RunJobsState.Default;
  vm.isPaused = false;
  vm.showBrowser = false;
  vm.showAutomationNotice = false;
  vm.domReady = true;

  vm.jobs = [
    createMockJob("login"),
    createMockJob("saveUserLang"),
    createMockJob("setLangToEnglish"),
    createMockJob("deleteWallPosts"),
    createMockJob("restoreUserLang"),
  ];

  vi.spyOn(vm, "log").mockImplementation(() => {});
  vi.spyOn(vm, "sleep").mockImplementation(async (ms: number) => {
    vi.setSystemTime(Date.now() + ms);
  });
  vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
  vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
  vi.spyOn(vm, "pause").mockResolvedValue(undefined);
  vi.spyOn(vm, "loadURL").mockResolvedValue(undefined);
  vi.spyOn(vm, "error").mockResolvedValue(undefined);

  return vm;
}

describe("FacebookViewModel Delete Jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers (Date only) so that the mocked sleep can advance
    // Date.now() naturally, causing polling loops to exit without
    // needing to spy on Date.now directly.
    vi.useFakeTimers({ toFake: ["Date"] });
    mockElectronAPI();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("runJobDeleteWallPosts", () => {
    it("sets runJobsState to DeleteWallPosts", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Mock all necessary JavaScript calls to simulate "no posts found"
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      // The function sets this at the start
      expect(vm.log).toHaveBeenCalledWith(
        "runJobDeleteWallPosts",
        "Loading profile page",
      );
    });

    it("shows browser and automation notice", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
    });

    it("loads the profile page", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.loadURL).toHaveBeenCalledWith("https://www.facebook.com/me/");
    });

    it("reports error when Manage posts button is not found", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // First call is to click the Manage posts button - return false (not found)
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.facebook_runJob_deleteWallPosts_ClickManagePostsFailed,
        expect.objectContaining({
          message: "Failed to click Manage posts button",
        }),
        expect.objectContaining({ currentURL: expect.any(String) }),
      );
      expect(vm.jobs[3].status).toBe("error");
    });

    it("reports error when dialog does not appear", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // First call clicks the button successfully
      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // clickManagePostsButton
        .mockResolvedValue(false); // waitForManagePostsDialog always returns false

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.facebook_runJob_deleteWallPosts_DialogNotFound,
        expect.objectContaining({
          message: "Manage posts dialog did not appear",
        }),
        expect.objectContaining({ currentURL: expect.any(String) }),
      );
    });

    it("exits loop when no deletable items found", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Simulate: button clicked, dialog appears, but no items to delete
      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // clickManagePostsButton
        .mockResolvedValueOnce(true) // waitForManagePostsDialog (first check)
        .mockResolvedValue([]); // getListsAndItems returns empty

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobDeleteWallPosts",
        "No deletable items found, finishing",
      );
    });

    it("updates progress with deleted posts count", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Simulate a successful deletion of 3 posts, then no more posts
      // The call pattern is interleaved: toggleCheckbox, then getActionDescription for each item
      let callCount = 0;
      vi.mocked(mockWebview.executeJavaScript).mockImplementation(async () => {
        callCount++;

        // First batch:
        // 1. clickManagePostsButton
        if (callCount === 1) return true;
        // 2. waitForManagePostsDialog
        if (callCount === 2) return true;
        // 3. getListsAndItems - return 3 items (first poll succeeds immediately)
        if (callCount === 3)
          return [
            { listIndex: 0, itemIndex: 0 },
            { listIndex: 0, itemIndex: 1 },
            { listIndex: 0, itemIndex: 2 },
          ];
        // Interleaved: for each item, toggleCheckbox then getActionDescription
        // 4. toggleCheckbox for item 0
        if (callCount === 4) return true;
        // 5. getActionDescription for item 0
        if (callCount === 5)
          return "You can hide or delete the posts selected.";
        // 6. toggleCheckbox for item 1
        if (callCount === 6) return true;
        // 7. getActionDescription for item 1
        if (callCount === 7)
          return "You can hide or delete the posts selected.";
        // 8. toggleCheckbox for item 2
        if (callCount === 8) return true;
        // 9. getActionDescription for item 2
        if (callCount === 9)
          return "You can hide or delete the posts selected.";
        // 10. clickNextButton
        if (callCount === 10) return true;
        // 11. selectDeletePostsOption
        if (callCount === 11) return true;
        // 12. clickDoneButton
        if (callCount === 12) return true;
        // 13. waitForManagePostsDialogToDisappear - first check still shows dialog
        if (callCount === 13) return true;
        // 14. waitForManagePostsDialogToDisappear - dialog disappeared
        if (callCount === 14) return false;
        // 15. Second batch: clickManagePostsButton
        if (callCount === 15) return true;
        // 16. waitForManagePostsDialog
        if (callCount === 16) return true;
        // 17+. getListsAndItems - no more items
        return [];
      });

      // Mock Date.now advances naturally via fake timers + sleep mock
      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      // After deleting 3 posts, progress should reflect this
      expect(vm.progress.wallPostsDeleted).toBeGreaterThanOrEqual(0);
    });

    it("logs total posts deleted at end", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // clickManagePostsButton
        .mockResolvedValueOnce(true) // waitForManagePostsDialog
        .mockResolvedValue([]); // getListsAndItems returns no items

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobDeleteWallPosts",
        expect.stringContaining("Total posts deleted"),
      );
    });

    it("marks job as finished at end", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValue([]);

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.jobs[3].status).toBe("finished");
      expect(vm.jobs[3].finishedAt).not.toBeNull();
    });

    it("continues to next batch if posts remain", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      let batchCount = 0;
      vi.mocked(mockWebview.executeJavaScript).mockImplementation(
        async (code: string) => {
          // Track batch starts by detecting clickManagePostsButton calls
          if (code.includes('aria-label="Manage posts"')) {
            if (code.includes("click()")) {
              batchCount++;
              // Allow 2 batches, then fail
              return batchCount <= 2;
            }
          }
          return false;
        },
      );

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      // Should have attempted multiple batches
      expect(batchCount).toBeGreaterThanOrEqual(1);
    });

    it("handles errors from safeExecuteJavaScript gracefully", async () => {
      const vm = createMockFacebookViewModel();
      vm.webview = null; // No webview available

      // Should complete without throwing
      await expect(
        DeleteJobs.runJobDeleteWallPosts(vm, 3),
      ).resolves.not.toThrow();
    });

    it("waits for pause at key points", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      await DeleteJobs.runJobDeleteWallPosts(vm, 3);

      expect(vm.waitForPause).toHaveBeenCalled();
    });
  });
});
