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
    createMockJob("deleteActivity"),
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

function mockSafeExecuteJavaScript(
  vm: FacebookViewModel,
  opts: {
    batchesPerCategory?: number;
    itemsPerBatch?: number;
    clickTrashSuccess?: boolean;
    batchCompletes?: boolean;
  } = {},
) {
  const {
    batchesPerCategory = 1,
    itemsPerBatch = 5,
    clickTrashSuccess = true,
    batchCompletes = true,
  } = opts;

  // Loading the activity log refills the available batches for the category.
  let remainingBatches = 0;
  vi.mocked(vm.loadURL).mockImplementation(async () => {
    remainingBatches = batchesPerCategory;
  });

  vi.spyOn(vm, "safeExecuteJavaScript").mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (_code: string, label?: string): Promise<any> => {
      switch (label) {
        case "toggleSelectAllCheckbox":
          if (remainingBatches > 0) {
            remainingBatches--;
            return { success: true, value: true };
          }
          return { success: true, value: false };
        case "countSelectableItems":
          return { success: true, value: itemsPerBatch };
        case "clickDeletePostsOption":
          return { success: true, value: clickTrashSuccess };
        case "confirmDeletion":
          return { success: true, value: true };
        case "waitForBatchToComplete":
          return { success: true, value: batchCompletes };
        default:
          return { success: true, value: false };
      }
    },
  );
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

  describe("runJobDeleteActivity", () => {
    it("sets runJobsState, showBrowser, and showAutomationNotice", async () => {
      const vm = createMockFacebookViewModel();
      mockSafeExecuteJavaScript(vm);

      await DeleteJobs.runJobDeleteActivity(vm, 3);

      expect(vm.runJobsState).toBe(RunJobsState.DeleteActivity);
      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(true);
    });

    it("finishes without deleting anything when no categories are selected", async () => {
      const vm = createMockFacebookViewModel();
      mockSafeExecuteJavaScript(vm);

      await DeleteJobs.runJobDeleteActivity(vm, 3);

      // No category was selected, so the activity log is never loaded
      expect(vm.loadURL).not.toHaveBeenCalled();
      expect(vm.safeExecuteJavaScript).not.toHaveBeenCalled();
      expect(vm.progress.isDeleteActivityFinished).toBe(true);
      expect(vm.jobs[3].status).toBe("finished");
      expect(vm.jobs[3].finishedAt).not.toBeNull();
    });

    it("deletes a single selected category and increments its counter", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ deleteWallPosts: true }),
      });
      mockSafeExecuteJavaScript(vm, {
        batchesPerCategory: 1,
        itemsPerBatch: 5,
      });

      await DeleteJobs.runJobDeleteActivity(vm, 3);

      // Loaded the activity log for the one selected category
      expect(vm.loadURL).toHaveBeenCalledTimes(1);
      expect(vm.loadURL).toHaveBeenCalledWith(
        expect.stringContaining("category_key=MANAGEPOSTSPHOTOSANDVIDEOS"),
      );

      // Toggled select-all and clicked the Trash button
      const labels = vi
        .mocked(vm.safeExecuteJavaScript)
        .mock.calls.map((call) => call[1]);
      expect(labels).toContain("toggleSelectAllCheckbox");
      expect(labels).toContain("clickDeletePostsOption");

      // Incremented the correct counter and finished cleanly
      expect(vm.progress.wallPostsDeleted).toBe(5);
      expect(vm.progress.isDeleteActivityFinished).toBe(true);
      expect(vm.progress.currentCategory).toBe("");
      expect(vm.jobs[3].status).toBe("finished");
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("exits the category loop cleanly when no items are selectable", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ deleteWallPosts: true }),
      });
      // toggleSelectAllCheckbox immediately reports no checkbox => no items
      mockSafeExecuteJavaScript(vm, { batchesPerCategory: 0 });

      await DeleteJobs.runJobDeleteActivity(vm, 3);

      const labels = vi
        .mocked(vm.safeExecuteJavaScript)
        .mock.calls.map((call) => call[1]);
      // We checked the select-all checkbox but never tried to delete
      expect(labels).toContain("toggleSelectAllCheckbox");
      expect(labels).not.toContain("clickDeletePostsOption");

      expect(vm.progress.wallPostsDeleted).toBe(0);
      expect(vm.progress.isDeleteActivityFinished).toBe(true);
      expect(vm.jobs[3].status).toBe("finished");
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("processes multiple selected categories and increments each counter", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({
          deleteWallPosts: true,
          deleteComments: true,
        }),
      });
      mockSafeExecuteJavaScript(vm, {
        batchesPerCategory: 1,
        itemsPerBatch: 3,
      });

      await DeleteJobs.runJobDeleteActivity(vm, 3);

      // One activity-log load per selected category
      expect(vm.loadURL).toHaveBeenCalledTimes(2);
      expect(vm.loadURL).toHaveBeenCalledWith(
        expect.stringContaining("category_key=MANAGEPOSTSPHOTOSANDVIDEOS"),
      );
      expect(vm.loadURL).toHaveBeenCalledWith(
        expect.stringContaining("category_key=COMMENTSCLUSTER"),
      );

      expect(vm.progress.wallPostsDeleted).toBe(3);
      expect(vm.progress.commentsDeleted).toBe(3);
      expect(vm.progress.isDeleteActivityFinished).toBe(true);
      expect(vm.jobs[3].status).toBe("finished");
    });

    it("errors the job when clicking the Trash button fails", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ deleteWallPosts: true }),
      });
      mockSafeExecuteJavaScript(vm, {
        batchesPerCategory: 1,
        clickTrashSuccess: false,
      });

      await DeleteJobs.runJobDeleteActivity(vm, 3);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed,
        expect.objectContaining({
          message: "Failed to click Trash button",
        }),
        expect.objectContaining({ currentURL: expect.any(String) }),
      );
      expect(vm.jobs[3].status).toBe("error");
      // The job errored before completing, so it is never marked finished
      expect(vm.progress.isDeleteActivityFinished).toBe(false);
    });
  });
});
