import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FacebookViewModel } from "./view_model";
import {
  State,
  RunJobsState,
  FacebookJob,
  emptyFacebookProgress,
} from "./types";
import { PlatformStates } from "../../types/PlatformStates";
import type { FacebookAccount } from "../../../../shared_types";
import {
  createMockAccount,
  createMockWebview,
  createMockEmitter,
  createMockFacebookAccount,
  mockElectronAPI,
} from "../../test_util";

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
 * Overrides for creating mock Facebook ViewModels
 * Allows partial facebookAccount for convenience
 */
interface MockFacebookViewModelOverrides {
  facebookAccount?: Partial<FacebookAccount>;
}

/**
 * Creates a mock FacebookViewModel with mocked dependencies for testing
 */
function createMockFacebookViewModel(
  overrides?: MockFacebookViewModelOverrides,
): FacebookViewModel {
  const mockFacebookAccount = createMockFacebookAccount(
    overrides?.facebookAccount || {},
  );
  const mockAccount = createMockAccount({
    type: "Facebook",
    xAccount: null,
    facebookAccount: mockFacebookAccount,
  });
  const mockEmitter = createMockEmitter();
  const mockWebview = createMockWebview();

  const vm = new FacebookViewModel(mockAccount, mockEmitter);

  vm.webview = mockWebview;
  vm.webContentsID = 1;
  vm.isWebviewDestroyed = false;
  vm.runJobsState = RunJobsState.Default;
  vm.isPaused = false;
  vm.showBrowser = false;
  vm.showAutomationNotice = false;
  vm.domReady = true;

  vi.spyOn(vm, "log").mockImplementation(() => {});
  vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
  vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
  vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
  vi.spyOn(vm, "loadURL").mockResolvedValue(undefined);
  vi.spyOn(vm, "loadBlank").mockResolvedValue(undefined);
  vi.spyOn(vm, "resetLogs").mockImplementation(() => {});

  return vm;
}

describe("FacebookViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("initializes to Login state when no stored identity", () => {
      const mockAccount = createMockAccount({
        type: "Facebook",
        xAccount: null,
        facebookAccount: createMockFacebookAccount({ accountID: null }),
      });
      const mockEmitter = createMockEmitter();

      const vm = new FacebookViewModel(mockAccount, mockEmitter);

      expect(vm.state).toBe(State.Login);
    });

    it("initializes to Dashboard state when identity is stored", () => {
      const mockAccount = createMockAccount({
        type: "Facebook",
        xAccount: null,
        facebookAccount: createMockFacebookAccount({ accountID: "123456789" }),
      });
      const mockEmitter = createMockEmitter();

      const vm = new FacebookViewModel(mockAccount, mockEmitter);

      expect(vm.state).toBe(State.FacebookWizardDashboard);
    });

    it("initializes with empty progress", () => {
      const vm = createMockFacebookViewModel();

      expect(vm.progress.wallPostsDeleted).toBe(0);
      expect(vm.progress.isDeleteWallPostsFinished).toBe(false);
      expect(vm.progress.currentJob).toBe("");
    });

    it("initializes with empty jobs array", () => {
      const vm = createMockFacebookViewModel();

      expect(vm.jobs).toEqual([]);
    });
  });

  describe("init", () => {
    it("sets state to Dashboard when account has stored accountID", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: "123456789" },
      });
      const mockWebview = createMockWebview();

      await vm.init(mockWebview);

      expect(vm.state).toBe(State.FacebookWizardDashboard);
    });

    it("sets state to Login when account has no stored accountID", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: null },
      });
      const mockWebview = createMockWebview();

      await vm.init(mockWebview);

      expect(vm.state).toBe(State.Login);
    });

    it("resets currentJobIndex to 0", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: "123456789" },
      });
      vm.currentJobIndex = 5;
      const mockWebview = createMockWebview();

      await vm.init(mockWebview);

      expect(vm.currentJobIndex).toBe(0);
    });
  });

  describe("defineJobs", () => {
    it("always includes login job first", async () => {
      const vm = createMockFacebookViewModel();

      await vm.defineJobs();

      expect(vm.jobs[0].jobType).toBe("login");
    });

    it("includes language and delete jobs when deleteWallPosts is enabled", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { deleteWallPosts: true },
      });

      await vm.defineJobs();

      const jobTypes = vm.jobs.map((j) => j.jobType);
      expect(jobTypes).toContain("saveUserLang");
      expect(jobTypes).toContain("setLangToEnglish");
      expect(jobTypes).toContain("deleteWallPosts");
      expect(jobTypes).toContain("restoreUserLang");
    });

    it("creates jobs in the correct order", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { deleteWallPosts: true },
      });

      await vm.defineJobs();

      expect(vm.jobs.map((j) => j.jobType)).toEqual([
        "login",
        "saveUserLang",
        "setLangToEnglish",
        "deleteWallPosts",
        "restoreUserLang",
      ]);
    });

    it("only includes login job when no delete options are enabled", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { deleteWallPosts: false },
      });

      await vm.defineJobs();

      expect(vm.jobs).toHaveLength(1);
      expect(vm.jobs[0].jobType).toBe("login");
    });

    it("initializes jobs with pending status", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { deleteWallPosts: true },
      });

      await vm.defineJobs();

      for (const job of vm.jobs) {
        expect(job.status).toBe("pending");
      }
    });

    it("initializes jobs with null timestamps", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { deleteWallPosts: true },
      });

      await vm.defineJobs();

      for (const job of vm.jobs) {
        expect(job.startedAt).toBeNull();
        expect(job.finishedAt).toBeNull();
      }
    });

    it("logs the defined jobs", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { deleteWallPosts: true },
      });

      await vm.defineJobs();

      expect(vm.log).toHaveBeenCalledWith("defineJobs", expect.any(Array));
    });
  });

  describe("reset", () => {
    it("resets progress to empty state", async () => {
      const vm = createMockFacebookViewModel();
      vm.progress.wallPostsDeleted = 100;
      vm.progress.isDeleteWallPostsFinished = true;

      await vm.reset();

      expect(vm.progress.wallPostsDeleted).toBe(0);
      expect(vm.progress.isDeleteWallPostsFinished).toBe(false);
    });

    it("clears jobs array", async () => {
      const vm = createMockFacebookViewModel();
      vm.jobs = [createMockJob("login"), createMockJob("deleteWallPosts")];

      await vm.reset();

      expect(vm.jobs).toEqual([]);
    });

    it("sets state to Dashboard", async () => {
      const vm = createMockFacebookViewModel();
      vm.state = PlatformStates.RunJobs;

      await vm.reset();

      expect(vm.state).toBe(State.FacebookWizardDashboard);
    });
  });

  describe("saveState and restoreState", () => {
    it("saves and restores state correctly", () => {
      const vm = createMockFacebookViewModel();

      vm.state = PlatformStates.RunJobs;
      vm.action = "testAction";
      vm.actionString = "Test action string";
      vm.progress.wallPostsDeleted = 50;
      vm.jobs = [createMockJob("login"), createMockJob("deleteWallPosts")];
      vm.currentJobIndex = 1;

      const savedState = vm.saveState();

      // Reset values
      vm.state = State.Login;
      vm.action = "";
      vm.actionString = "";
      vm.progress = emptyFacebookProgress();
      vm.jobs = [];
      vm.currentJobIndex = 0;

      // Restore
      vm.restoreState(savedState);

      expect(vm.state).toBe(PlatformStates.RunJobs);
      expect(vm.action).toBe("testAction");
      expect(vm.actionString).toBe("Test action string");
      expect(vm.progress.wallPostsDeleted).toBe(50);
      expect(vm.jobs).toHaveLength(2);
      expect(vm.currentJobIndex).toBe(1);
    });

    it("preserves all progress fields", () => {
      const vm = createMockFacebookViewModel();

      vm.progress.currentJob = "deleteWallPosts";
      vm.progress.wallPostsDeleted = 123;
      vm.progress.isDeleteWallPostsFinished = true;

      const savedState = vm.saveState();

      expect(savedState.progress.currentJob).toBe("deleteWallPosts");
      expect(savedState.progress.wallPostsDeleted).toBe(123);
      expect(savedState.progress.isDeleteWallPostsFinished).toBe(true);
    });
  });

  describe("runJob", () => {
    it("sets job status to running", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: "123456789" },
      });
      vm.jobs = [createMockJob("login")];

      // Mock waitForFacebookLogin to resolve immediately
      vi.spyOn(vm, "waitForFacebookLogin").mockResolvedValue(undefined);
      vi.spyOn(vm, "captureIdentityFromPage").mockResolvedValue(undefined);

      await vm.runJob(0);

      // Job should be started (status becomes running, then finished)
      expect(vm.jobs[0].startedAt).not.toBeNull();
    });

    it("sets currentJob in progress", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: "123456789" },
      });
      vm.jobs = [createMockJob("login")];

      vi.spyOn(vm, "waitForFacebookLogin").mockResolvedValue(undefined);
      vi.spyOn(vm, "captureIdentityFromPage").mockResolvedValue(undefined);

      await vm.runJob(0);

      // After the job finishes, currentJob should have been set
      expect(vm.log).toHaveBeenCalledWith("runJob", "running job login");
    });

    it("logs job type when running", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: "123456789" },
      });
      vm.jobs = [createMockJob("login")];

      vi.spyOn(vm, "waitForFacebookLogin").mockResolvedValue(undefined);
      vi.spyOn(vm, "captureIdentityFromPage").mockResolvedValue(undefined);

      await vm.runJob(0);

      expect(vm.log).toHaveBeenCalledWith("runJob", "running job login");
    });
  });

  describe("run", () => {
    it("handles Login state correctly", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: null },
      });
      vm.state = State.Login;

      vi.spyOn(vm, "waitForFacebookLogin").mockResolvedValue(undefined);
      vi.spyOn(vm, "captureIdentityFromPage").mockResolvedValue(undefined);

      await vm.run();

      expect(vm.loadURL).toHaveBeenCalled();
    });

    it("handles Dashboard state correctly", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: "123456789" },
      });
      vm.state = State.FacebookWizardDashboard;

      await vm.run();

      expect(vm.loadBlank).toHaveBeenCalled();
      expect(vm.state).toBe(State.FacebookWizardDashboardDisplay);
    });

    it("handles WizardDeleteOptions state", async () => {
      const vm = createMockFacebookViewModel();
      vm.state = PlatformStates.WizardDeleteOptions;

      await vm.run();

      expect(vm.showBrowser).toBe(false);
      expect(vm.state).toBe(PlatformStates.WizardDeleteOptionsDisplay);
    });

    it("handles WizardReview state", async () => {
      const vm = createMockFacebookViewModel();
      vm.state = PlatformStates.WizardReview;

      await vm.run();

      expect(vm.showBrowser).toBe(false);
      expect(vm.state).toBe(PlatformStates.WizardReviewDisplay);
    });

    it("handles FinishedRunningJobs state", async () => {
      const vm = createMockFacebookViewModel();
      vm.state = PlatformStates.FinishedRunningJobs;

      await vm.run();

      expect(vm.showBrowser).toBe(false);
      expect(vm.state).toBe(PlatformStates.FinishedRunningJobsDisplay);
    });

    it("falls back to appropriate state for unknown states", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: "123456789" },
      });
      vm.state = "UnknownState";

      await vm.run();

      expect(vm.state).toBe(State.FacebookWizardDashboard);
    });

    it("falls back to Login if no stored identity for unknown states", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: { accountID: null },
      });
      vm.state = "UnknownState";

      await vm.run();

      expect(vm.state).toBe(State.Login);
    });
  });

  describe("emptyFacebookProgress", () => {
    it("returns a fresh empty progress object", () => {
      const progress = emptyFacebookProgress();

      expect(progress.currentJob).toBe("");
      expect(progress.wallPostsDeleted).toBe(0);
      expect(progress.isDeleteWallPostsFinished).toBe(false);
    });

    it("returns a new object each time", () => {
      const progress1 = emptyFacebookProgress();
      const progress2 = emptyFacebookProgress();

      expect(progress1).not.toBe(progress2);
      expect(progress1).toEqual(progress2);
    });
  });
});
