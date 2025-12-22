import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FacebookViewModel } from "./view_model";
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
import * as Helpers from "./helpers";

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
    createMockJob("deleteWallPosts"),
  ];

  vi.spyOn(vm, "log").mockImplementation(() => {});
  vi.spyOn(vm, "sleep").mockResolvedValue(undefined);

  return vm;
}

describe("FacebookViewModel Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("finishJob", () => {
    it("sets job status to finished and records timestamp", async () => {
      const vm = createMockFacebookViewModel();
      const jobIndex = 0;

      // Set some progress to be serialized
      vm.progress.wallPostsDeleted = 10;

      const beforeTime = new Date();
      await Helpers.finishJob(vm, jobIndex);
      const afterTime = new Date();

      expect(vm.jobs[jobIndex].status).toBe("finished");
      expect(vm.jobs[jobIndex].finishedAt).not.toBeNull();
      expect(vm.jobs[jobIndex].finishedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(vm.jobs[jobIndex].finishedAt!.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });

    it("serializes progress to progressJSON", async () => {
      const vm = createMockFacebookViewModel();
      const jobIndex = 1;

      vm.progress.wallPostsDeleted = 42;
      vm.progress.isDeleteWallPostsFinished = true;

      await Helpers.finishJob(vm, jobIndex);

      const serializedProgress = JSON.parse(vm.jobs[jobIndex].progressJSON);
      expect(serializedProgress.wallPostsDeleted).toBe(42);
      expect(serializedProgress.isDeleteWallPostsFinished).toBe(true);
    });

    it("logs the job type", async () => {
      const vm = createMockFacebookViewModel();
      const jobIndex = 2;

      await Helpers.finishJob(vm, jobIndex);

      expect(vm.log).toHaveBeenCalledWith(
        "finishJob",
        vm.jobs[jobIndex].jobType,
      );
    });

    it("works for different job indexes", async () => {
      const vm = createMockFacebookViewModel();

      await Helpers.finishJob(vm, 0);
      await Helpers.finishJob(vm, 1);
      await Helpers.finishJob(vm, 2);

      expect(vm.jobs[0].status).toBe("finished");
      expect(vm.jobs[1].status).toBe("finished");
      expect(vm.jobs[2].status).toBe("finished");
    });
  });

  describe("errorJob", () => {
    it("sets job status to error and records timestamp", async () => {
      const vm = createMockFacebookViewModel();
      const jobIndex = 0;

      const beforeTime = new Date();
      await Helpers.errorJob(vm, jobIndex);
      const afterTime = new Date();

      expect(vm.jobs[jobIndex].status).toBe("error");
      expect(vm.jobs[jobIndex].finishedAt).not.toBeNull();
      expect(vm.jobs[jobIndex].finishedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(vm.jobs[jobIndex].finishedAt!.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });

    it("serializes progress to progressJSON", async () => {
      const vm = createMockFacebookViewModel();
      const jobIndex = 1;

      vm.progress.wallPostsDeleted = 5;

      await Helpers.errorJob(vm, jobIndex);

      const serializedProgress = JSON.parse(vm.jobs[jobIndex].progressJSON);
      expect(serializedProgress.wallPostsDeleted).toBe(5);
    });

    it("logs the job type with error context", async () => {
      const vm = createMockFacebookViewModel();
      const jobIndex = 1;

      await Helpers.errorJob(vm, jobIndex);

      expect(vm.log).toHaveBeenCalledWith(
        "errorJob",
        vm.jobs[jobIndex].jobType,
      );
    });
  });

  describe("syncProgress", () => {
    it("logs the current progress", async () => {
      const vm = createMockFacebookViewModel();

      vm.progress.wallPostsDeleted = 25;
      vm.progress.isDeleteWallPostsFinished = false;

      await Helpers.syncProgress(vm);

      expect(vm.log).toHaveBeenCalledWith(
        "syncProgress",
        expect.stringContaining("25"),
      );
    });

    it("serializes all progress fields", async () => {
      const vm = createMockFacebookViewModel();

      vm.progress.currentJob = "deleteWallPosts";
      vm.progress.wallPostsDeleted = 100;
      vm.progress.isDeleteWallPostsFinished = true;

      await Helpers.syncProgress(vm);

      const logCall = (vm.log as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0] === "syncProgress",
      );
      expect(logCall).toBeDefined();

      const loggedProgress = JSON.parse(logCall![1]);
      expect(loggedProgress.currentJob).toBe("deleteWallPosts");
      expect(loggedProgress.wallPostsDeleted).toBe(100);
      expect(loggedProgress.isDeleteWallPostsFinished).toBe(true);
    });
  });
});
