import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Helpers from "./helpers";
import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import * as AuthOps from "./auth";
import type { Account, XAccount } from "../../../../shared_types";

// Mock the auth module
vi.mock("./auth", () => ({
  login: vi.fn(),
}));

interface MockElectronX {
  syncProgress: ReturnType<typeof vi.fn>;
  updateJob: ReturnType<typeof vi.fn>;
  setConfig: ReturnType<typeof vi.fn>;
  archiveBuild: ReturnType<typeof vi.fn>;
}

describe("helpers.ts", () => {
  let mockVM: Partial<XViewModel>;
  let mockElectronX: MockElectronX;

  beforeEach(() => {
    // Create mock Electron API
    mockElectronX = {
      syncProgress: vi.fn().mockResolvedValue(undefined),
      updateJob: vi.fn().mockResolvedValue(undefined),
      setConfig: vi.fn().mockResolvedValue(undefined),
      archiveBuild: vi.fn().mockResolvedValue(undefined),
    };

    // Setup window.electron mock
    (global as unknown as { window: { electron: unknown } }).window = {
      electron: {
        X: mockElectronX,
        trackEvent: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Create mock view model
    mockVM = {
      account: {
        id: 1,
        xAccount: {
          deleteTweets: true,
          deleteRetweets: true,
          deleteLikes: true,
        } as Partial<XAccount> as XAccount,
      } as Partial<Account> as Account,
      progress: {
        tweetsDeleted: 10,
        retweetsDeleted: 5,
        likesDeleted: 3,
      } as Partial<XViewModel["progress"]> as XViewModel["progress"],
      jobs: [
        {
          jobType: "deleteTweets",
          status: "running",
          finishedAt: null,
          progressJSON: "",
        },
      ] as Partial<XViewModel["jobs"][0]>[] as XViewModel["jobs"],
      databaseStats: {
        tweetsSaved: 100,
        tweetsDeleted: 10,
        retweetsSaved: 50,
        retweetsDeleted: 5,
        likesSaved: 30,
        likesDeleted: 3,
      } as Partial<XViewModel["databaseStats"]> as XViewModel["databaseStats"],
      log: vi.fn(),
      error: vi.fn().mockResolvedValue(undefined),
      refreshDatabaseStats: vi.fn().mockResolvedValue(undefined),
      finishJob: vi.fn(),
      showBrowser: false,
      instructions: "",
      showAutomationNotice: false,
      emitter: {
        emit: vi.fn(),
      } as Partial<XViewModel["emitter"]> as XViewModel["emitter"],
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("syncProgress", () => {
    it("should call electron API with account ID and stringified progress", async () => {
      await Helpers.syncProgress(mockVM as XViewModel);

      expect(mockElectronX.syncProgress).toHaveBeenCalledWith(
        1,
        JSON.stringify(mockVM.progress),
      );
    });

    it("should handle different progress values", async () => {
      mockVM.progress = {
        tweetsDeleted: 100,
        retweetsDeleted: 50,
      } as Partial<XViewModel["progress"]> as XViewModel["progress"];

      await Helpers.syncProgress(mockVM as XViewModel);

      expect(mockElectronX.syncProgress).toHaveBeenCalledWith(
        1,
        JSON.stringify({ tweetsDeleted: 100, retweetsDeleted: 50 }),
      );
    });
  });

  describe("finishJob", () => {
    it("should mark job as finished with timestamp", async () => {
      const beforeTime = Date.now();
      await Helpers.finishJob(mockVM as XViewModel, 0);
      const afterTime = Date.now();

      expect(mockVM.jobs![0].status).toBe("finished");
      expect(mockVM.jobs![0].finishedAt).toBeDefined();
      const finishedTime = (mockVM.jobs![0].finishedAt as Date).getTime();
      expect(finishedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(finishedTime).toBeLessThanOrEqual(afterTime);
    });

    it("should update job progressJSON", async () => {
      await Helpers.finishJob(mockVM as XViewModel, 0);

      expect(mockVM.jobs![0].progressJSON).toBe(
        JSON.stringify(mockVM.progress),
      );
    });

    it("should call electron updateJob with stringified job", async () => {
      await Helpers.finishJob(mockVM as XViewModel, 0);

      expect(mockElectronX.updateJob).toHaveBeenCalledWith(
        1,
        expect.stringContaining('"status":"finished"'),
      );
      expect(mockElectronX.updateJob).toHaveBeenCalledWith(
        1,
        expect.stringContaining('"jobType":"deleteTweets"'),
      );
    });

    it("should set lastFinishedJob config", async () => {
      await Helpers.finishJob(mockVM as XViewModel, 0);

      expect(mockElectronX.setConfig).toHaveBeenCalledWith(
        1,
        "lastFinishedJob_deleteTweets",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO 8601 format
      );
    });

    it("should log the finished job", async () => {
      await Helpers.finishJob(mockVM as XViewModel, 0);

      expect(mockVM.log).toHaveBeenCalledWith("finishJob", "deleteTweets");
    });
  });

  describe("errorJob", () => {
    it("should mark job as error with timestamp", async () => {
      const beforeTime = Date.now();
      await Helpers.errorJob(mockVM as XViewModel, 0);
      const afterTime = Date.now();

      expect(mockVM.jobs![0].status).toBe("error");
      expect(mockVM.jobs![0].finishedAt).toBeDefined();
      const finishedTime = (mockVM.jobs![0].finishedAt as Date).getTime();
      expect(finishedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(finishedTime).toBeLessThanOrEqual(afterTime);
    });

    it("should update job progressJSON", async () => {
      await Helpers.errorJob(mockVM as XViewModel, 0);

      expect(mockVM.jobs![0].progressJSON).toBe(
        JSON.stringify(mockVM.progress),
      );
    });

    it("should call electron updateJob with stringified job", async () => {
      await Helpers.errorJob(mockVM as XViewModel, 0);

      expect(mockElectronX.updateJob).toHaveBeenCalledWith(
        1,
        expect.stringContaining('"status":"error"'),
      );
    });

    it("should log the errored job", async () => {
      await Helpers.errorJob(mockVM as XViewModel, 0);

      expect(mockVM.log).toHaveBeenCalledWith("errorJob", "deleteTweets");
    });
  });

  describe("getDatabaseStatsString", () => {
    it("should refresh database stats before calculating", async () => {
      await Helpers.getDatabaseStatsString(mockVM as XViewModel);

      expect(mockVM.refreshDatabaseStats).toHaveBeenCalled();
    });

    it("should calculate correct stats for all enabled options", async () => {
      const result = await Helpers.getDatabaseStatsString(mockVM as XViewModel);

      expect(result).toBe("90 tweets, 45 retweets and 27 likes");
    });

    it("should format stats with only tweets enabled", async () => {
      mockVM.account!.xAccount!.deleteRetweets = false;
      mockVM.account!.xAccount!.deleteLikes = false;

      const result = await Helpers.getDatabaseStatsString(mockVM as XViewModel);

      expect(result).toBe("90 tweets");
    });

    it("should format stats with tweets and retweets enabled", async () => {
      mockVM.account!.xAccount!.deleteLikes = false;

      const result = await Helpers.getDatabaseStatsString(mockVM as XViewModel);

      expect(result).toBe("90 tweets and 45 retweets");
    });

    it("should format stats with tweets and likes enabled", async () => {
      mockVM.account!.xAccount!.deleteRetweets = false;

      const result = await Helpers.getDatabaseStatsString(mockVM as XViewModel);

      expect(result).toBe("90 tweets and 27 likes");
    });

    it("should use correct locale formatting for large numbers", async () => {
      mockVM.databaseStats!.tweetsSaved = 1000000;
      mockVM.databaseStats!.tweetsDeleted = 0;
      mockVM.account!.xAccount!.deleteRetweets = false;
      mockVM.account!.xAccount!.deleteLikes = false;

      const result = await Helpers.getDatabaseStatsString(mockVM as XViewModel);

      // Note: toLocaleString() output varies by locale, but should contain commas
      expect(result).toMatch(/1[,\s]000[,\s]000/);
    });
  });

  describe("runJobLogin", () => {
    it("should track login event", async () => {
      await Helpers.runJobLogin(mockVM as XViewModel, 0);

      expect(window.electron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_LOGIN,
        navigator.userAgent,
      );
    });

    it("should show browser and set instructions", async () => {
      await Helpers.runJobLogin(mockVM as XViewModel, 0);

      expect(mockVM.showBrowser).toBe(true);
      expect(mockVM.instructions).toContain("logged in");
    });

    it("should hide automation notice", async () => {
      mockVM.showAutomationNotice = true;

      await Helpers.runJobLogin(mockVM as XViewModel, 0);

      expect(mockVM.showAutomationNotice).toBe(false);
    });

    it("should call auth login", async () => {
      await Helpers.runJobLogin(mockVM as XViewModel, 0);

      expect(AuthOps.login).toHaveBeenCalledWith(mockVM);
    });

    it("should finish job and return true", async () => {
      const result = await Helpers.runJobLogin(mockVM as XViewModel, 0);

      // runJobLogin calls the helper finishJob, not vm.finishJob
      expect(mockElectronX.updateJob).toHaveBeenCalled();
      expect(mockVM.jobs![0].status).toBe("finished");
      expect(result).toBe(true);
    });
  });

  describe("runJobArchiveBuild", () => {
    it("should track archive build event", async () => {
      await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(window.electron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_ARCHIVE_BUILD,
        navigator.userAgent,
      );
    });

    it("should hide browser and set instructions", async () => {
      mockVM.showBrowser = true;

      await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockVM.showBrowser).toBe(false);
      expect(mockVM.instructions).toContain("archive");
    });

    it("should show automation notice", async () => {
      await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockVM.showAutomationNotice).toBe(true);
    });

    it("should call electron archiveBuild", async () => {
      await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockElectronX.archiveBuild).toHaveBeenCalledWith(1);
    });

    it("should emit update-archive-info event", async () => {
      await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockVM.emitter?.emit).toHaveBeenCalledWith(
        "x-update-archive-info-1",
      );
    });

    it("should emit submit-progress event", async () => {
      await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockVM.emitter?.emit).toHaveBeenCalledWith("x-submit-progress-1");
    });

    it("should finish job and return true on success", async () => {
      mockVM.finishJob = vi.fn().mockResolvedValue(undefined);

      const result = await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockVM.finishJob).toHaveBeenCalledWith(0);
      expect(result).toBe(true);
    });

    it("should handle archiveBuild errors", async () => {
      const testError = new Error("Archive build failed");
      mockElectronX.archiveBuild.mockRejectedValueOnce(testError);

      const result = await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockVM.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_archiveBuild_ArchiveBuildError,
        expect.objectContaining({
          error: expect.stringContaining("Archive build failed"),
        }),
      );
      expect(result).toBe(false);
    });

    it("should not finish job on error", async () => {
      mockVM.finishJob = vi.fn().mockResolvedValue(undefined);
      mockElectronX.archiveBuild.mockRejectedValueOnce(new Error("Failed"));

      await Helpers.runJobArchiveBuild(mockVM as XViewModel, 0);

      expect(mockVM.finishJob).not.toHaveBeenCalled();
    });
  });
});
