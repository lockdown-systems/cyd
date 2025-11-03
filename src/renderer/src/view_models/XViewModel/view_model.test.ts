import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebviewTag } from "electron";
import { XViewModel } from "./view_model";
import { State } from "./types";
import * as AuthOps from "./auth";
import * as GraphQLOps from "./graphql";
import * as RateLimitOps from "./rate_limit";
import * as Helpers from "./helpers";
import * as IndexJobs from "./jobs_index/index";
import * as DeleteJobs from "./jobs_delete/index";
import * as MigrateJobs from "./jobs_migrate_to_bluesky";
import { xHasSomeData } from "../../util_x";
import { getJobsType } from "../../util";
import type { Account, XJob } from "../../../../shared_types";

// Mock all helper modules
vi.mock("./auth");
vi.mock("./graphql");
vi.mock("./rate_limit");
vi.mock("./helpers");
vi.mock("./jobs_index/index");
vi.mock("./jobs_delete/index");
vi.mock("./jobs_migrate_to_bluesky");
vi.mock("./jobs_tombstone");
vi.mock("../../util_x");
vi.mock("../../util");

describe("XViewModel", () => {
  let vm: XViewModel;
  let mockAccount: Account;
  let mockElectronX: {
    getDatabaseStats: ReturnType<typeof vi.fn>;
    updateJob: ReturnType<typeof vi.fn>;
    createJobs: ReturnType<typeof vi.fn>;
    resetProgress: ReturnType<typeof vi.fn>;
    getConfig: ReturnType<typeof vi.fn>;
    syncProgress: ReturnType<typeof vi.fn>;
    initArchiveOnlyMode: ReturnType<typeof vi.fn>;
  };
  let mockElectronArchive: {
    getInfo: ReturnType<typeof vi.fn>;
  };
  let mockElectronDatabase: {
    getAccount: ReturnType<typeof vi.fn>;
    dismissNewErrorReports: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Create mock electron APIs
    mockElectronX = {
      getDatabaseStats: vi.fn().mockResolvedValue({
        tweetsSaved: 0,
        tweetsDeleted: 0,
        retweetsSaved: 0,
        retweetsDeleted: 0,
        likesSaved: 0,
        likesDeleted: 0,
        bookmarksSaved: 0,
        bookmarksDeleted: 0,
        conversationsSaved: 0,
        conversationsDeleted: 0,
        messagesSaved: 0,
        messagesDeleted: 0,
      }),
      updateJob: vi.fn().mockResolvedValue(undefined),
      createJobs: vi.fn().mockResolvedValue([]),
      resetProgress: vi.fn().mockResolvedValue({
        currentJob: "",
        tweetsIndexed: 0,
        tweetsDeleted: 0,
        retweetsDeleted: 0,
        likesIndexed: 0,
        likesDeleted: 0,
        bookmarksIndexed: 0,
        bookmarksDeleted: 0,
        conversationsIndexed: 0,
        conversationsDeleted: 0,
        messagesIndexed: 0,
        messagesDeleted: 0,
        tweetsArchived: 0,
        tweetsToArchive: 0,
        unfollowed: 0,
        totalFollowing: 0,
      }),
      getConfig: vi.fn().mockResolvedValue("false"),
      syncProgress: vi.fn().mockResolvedValue(undefined),
      initArchiveOnlyMode: vi.fn().mockResolvedValue(undefined),
    };

    mockElectronArchive = {
      getInfo: vi.fn().mockResolvedValue({
        path: "",
        exists: false,
        size: 0,
        createdAt: null,
        modifiedAt: null,
      }),
    };

    mockElectronDatabase = {
      getAccount: vi.fn().mockResolvedValue(null),
      dismissNewErrorReports: vi.fn().mockResolvedValue(undefined),
    };

    // Setup window.electron mock
    (global as unknown as { window: { electron: unknown } }).window = {
      electron: {
        X: mockElectronX,
        archive: mockElectronArchive,
        database: mockElectronDatabase,
        trackEvent: vi.fn().mockResolvedValue(undefined),
        onPowerMonitorSuspend: vi.fn(),
        onPowerMonitorResume: vi.fn(),
        shouldOpenDevtools: vi.fn().mockResolvedValue(false),
        getAPIURL: vi.fn().mockResolvedValue("http://localhost:3000"),
        showQuestion: vi.fn().mockResolvedValue(true),
      },
    };

    // Create mock account using test utility
    mockAccount = {
      id: 1,
      type: "X",
      sortOrder: 0,
      xAccount: {
        id: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
        username: "testuser",
        userID: "123456789",
        bio: "Test bio",
        profileImageDataURI: "data:image/png;base64,test",
        importFromArchive: false,
        saveMyData: false,
        deleteMyData: false,
        archiveOnly: false,
        archiveMyData: false,
        archiveTweets: false,
        archiveTweetsHTML: false,
        archiveLikes: false,
        archiveBookmarks: false,
        archiveDMs: false,
        deleteTweets: false,
        deleteTweetsDaysOldEnabled: false,
        deleteTweetsDaysOld: 0,
        deleteTweetsLikesThresholdEnabled: false,
        deleteTweetsLikesThreshold: 0,
        deleteTweetsRetweetsThresholdEnabled: false,
        deleteTweetsRetweetsThreshold: 0,
        deleteRetweets: false,
        deleteRetweetsDaysOldEnabled: false,
        deleteRetweetsDaysOld: 0,
        deleteLikes: false,
        deleteBookmarks: false,
        deleteDMs: false,
        unfollowEveryone: false,
        followingCount: 100,
        followersCount: 200,
        tweetsCount: 100,
        likesCount: 50,
        tombstoneUpdateBanner: false,
        tombstoneUpdateBannerBackground: "",
        tombstoneUpdateBannerSocialIcons: "",
        tombstoneUpdateBannerShowText: false,
        tombstoneBannerDataURL: "",
        tombstoneUpdateBio: false,
        tombstoneUpdateBioText: "",
        tombstoneUpdateBioCreditCyd: false,
        tombstoneLockAccount: false,
      },
      blueskyAccount: null,
      facebookAccount: null,
      uuid: "test-uuid-123",
    };

    // Create view model instance
    vm = new XViewModel(mockAccount, null);

    // Mock the base methods
    vm.log = vi.fn();
    vm.error = vi.fn().mockResolvedValue(undefined);
    vm.loadBlank = vi.fn().mockResolvedValue(undefined);
    vm.loadURL = vi.fn().mockResolvedValue(undefined);
    vm.sleep = vi.fn().mockResolvedValue(undefined);
    vm.resetLogs = vi.fn();
    vm.waitForPause = vi.fn().mockResolvedValue(undefined);
    vm.pause = vi.fn();
    vm.emitter = {
      emit: vi.fn(),
    } as unknown as XViewModel["emitter"];

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with default empty values", () => {
      expect(vm.progress).toBeDefined();
      expect(vm.rateLimitInfo).toBeDefined();
      expect(vm.progressInfo).toBeDefined();
      expect(vm.databaseStats).toBeDefined();
      expect(vm.archiveInfo).toBeDefined();
      expect(vm.jobs).toEqual([]);
      expect(vm.currentJobIndex).toBe(0);
      expect(vm.currentTweetItem).toBeNull();
      expect(vm.isDeleteReviewActive).toBe(false);
      expect(vm.debugAutopauseEndOfStep).toBe(false);
    });

    it("init() should set state to WizardPrestart when account has username", async () => {
      const mockWebview = {
        addEventListener: vi.fn(),
        getURL: vi.fn().mockReturnValue("about:blank"),
      } as unknown as WebviewTag;

      await vm.init(mockWebview);

      expect(vm.state).toBe(State.WizardPrestart);
      expect(vm.currentJobIndex).toBe(0);
      expect(mockElectronX.getDatabaseStats).toHaveBeenCalledWith(1);
      expect(mockElectronArchive.getInfo).toHaveBeenCalledWith(1);
    });

    it("init() should set state to Login when account lacks username", async () => {
      vm.account.xAccount!.username = "";
      const mockWebview = {
        addEventListener: vi.fn(),
        getURL: vi.fn().mockReturnValue("about:blank"),
      } as unknown as WebviewTag;

      await vm.init(mockWebview);

      expect(vm.state).toBe(State.Login);
      expect(vm.currentJobIndex).toBe(0);
      expect(mockElectronX.getDatabaseStats).toHaveBeenCalledWith(1);
      expect(mockElectronArchive.getInfo).toHaveBeenCalledWith(1);
    });
  });

  describe("State Persistence", () => {
    it("saveState() should return complete state object", () => {
      vm.state = State.RunJobs;
      vm.action = "test-action";
      vm.actionString = "Testing";
      vm.currentJobIndex = 2;
      vm.jobs = [
        { jobType: "login", status: "completed" } as XJob,
        { jobType: "indexTweets", status: "running" } as XJob,
      ];

      const savedState = vm.saveState();

      expect(savedState.state).toBe(State.RunJobs);
      expect(savedState.action).toBe("test-action");
      expect(savedState.actionString).toBe("Testing");
      expect(savedState.currentJobIndex).toBe(2);
      expect(savedState.jobs).toHaveLength(2);
      expect(savedState.progress).toBeDefined();
    });

    it("restoreState() should restore all properties", () => {
      const stateToRestore = {
        state: State.WizardReview,
        action: "restored-action",
        actionString: "Restored Action String",
        progress: vm.progress,
        jobs: [{ jobType: "deleteTweets", status: "pending" } as XJob],
        currentJobIndex: 5,
      };

      vm.restoreState(stateToRestore);

      expect(vm.state).toBe(State.WizardReview);
      expect(vm.action).toBe("restored-action");
      expect(vm.actionString).toBe("Restored Action String");
      expect(vm.currentJobIndex).toBe(5);
      expect(vm.jobs).toHaveLength(1);
      expect(vm.jobs[0].jobType).toBe("deleteTweets");
    });

    it("round-trip should preserve data (save then restore)", () => {
      // Set up initial state
      vm.state = State.RunJobs;
      vm.action = "round-trip-action";
      vm.actionString = "Round Trip Test";
      vm.currentJobIndex = 3;
      vm.jobs = [
        { jobType: "login", status: "completed" } as XJob,
        { jobType: "indexTweets", status: "completed" } as XJob,
        { jobType: "deleteTweets", status: "running" } as XJob,
      ];

      // Save state
      const savedState = vm.saveState();

      // Modify current state
      vm.state = State.Login;
      vm.action = "modified";
      vm.actionString = "Modified";
      vm.currentJobIndex = 0;
      vm.jobs = [];

      // Restore state
      vm.restoreState(savedState);

      // Verify restoration
      expect(vm.state).toBe(State.RunJobs);
      expect(vm.action).toBe("round-trip-action");
      expect(vm.actionString).toBe("Round Trip Test");
      expect(vm.currentJobIndex).toBe(3);
      expect(vm.jobs).toHaveLength(3);
      expect(vm.jobs[2].jobType).toBe("deleteTweets");
    });
  });

  describe("defineJobs()", () => {
    beforeEach(() => {
      vi.mocked(xHasSomeData).mockResolvedValue(true);
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
    });

    it("should create migrateBluesky + archiveBuild jobs", async () => {
      vi.mocked(getJobsType).mockReturnValue("migrateBluesky");
      const mockJobs = [
        { jobType: "migrateBluesky", status: "pending" } as XJob,
        { jobType: "archiveBuild", status: "pending" } as XJob,
      ];
      mockElectronX.createJobs.mockResolvedValue(mockJobs);

      await vm.defineJobs();

      expect(getJobsType).toHaveBeenCalledWith(1);
      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, [
        "migrateBluesky",
        "archiveBuild",
      ]);
      expect(vm.jobs).toEqual(mockJobs);
    });

    it("should create migrateBlueskyDelete + archiveBuild jobs", async () => {
      vi.mocked(getJobsType).mockReturnValue("migrateBlueskyDelete");
      const mockJobs = [
        { jobType: "migrateBlueskyDelete", status: "pending" } as XJob,
        { jobType: "archiveBuild", status: "pending" } as XJob,
      ];
      mockElectronX.createJobs.mockResolvedValue(mockJobs);

      await vm.defineJobs();

      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, [
        "migrateBlueskyDelete",
        "archiveBuild",
      ]);
      expect(vm.jobs).toEqual(mockJobs);
    });

    it("should create login + tombstone jobs (all 3 options)", async () => {
      vi.mocked(getJobsType).mockReturnValue("tombstone");
      vm.account.xAccount!.tombstoneUpdateBanner = true;
      vm.account.xAccount!.tombstoneUpdateBio = true;
      vm.account.xAccount!.tombstoneLockAccount = true;

      const mockJobs = [
        { jobType: "login", status: "pending" } as XJob,
        { jobType: "tombstoneUpdateBanner", status: "pending" } as XJob,
        { jobType: "tombstoneUpdateBio", status: "pending" } as XJob,
        { jobType: "tombstoneLockAccount", status: "pending" } as XJob,
      ];
      mockElectronX.createJobs.mockResolvedValue(mockJobs);

      await vm.defineJobs();

      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, [
        "login",
        "tombstoneUpdateBanner",
        "tombstoneUpdateBio",
        "tombstoneLockAccount",
      ]);
      expect(vm.jobs).toEqual(mockJobs);
    });

    it("should create login + tombstone jobs (only banner)", async () => {
      vi.mocked(getJobsType).mockReturnValue("tombstone");
      vm.account.xAccount!.tombstoneUpdateBanner = true;
      vm.account.xAccount!.tombstoneUpdateBio = false;
      vm.account.xAccount!.tombstoneLockAccount = false;

      await vm.defineJobs();

      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, [
        "login",
        "tombstoneUpdateBanner",
      ]);
    });

    it("should create save jobs (tweets, likes, bookmarks, DMs)", async () => {
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
      vm.account.xAccount!.saveMyData = true;
      vm.account.xAccount!.archiveTweets = true;
      vm.account.xAccount!.archiveTweetsHTML = true;
      vm.account.xAccount!.archiveLikes = true;
      vm.account.xAccount!.archiveBookmarks = true;
      vm.account.xAccount!.archiveDMs = true;

      await vm.defineJobs();

      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, [
        "login",
        "indexTweets",
        "archiveTweets",
        "indexLikes",
        "indexBookmarks",
        "indexConversations",
        "indexMessages",
        "archiveBuild",
      ]);
    });

    it("should create archive jobs (HTML tweets, bookmarks, DMs)", async () => {
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
      vm.account.xAccount!.archiveMyData = true;
      vm.account.xAccount!.archiveTweetsHTML = true;
      vm.account.xAccount!.archiveBookmarks = true;
      vm.account.xAccount!.archiveDMs = true;

      await vm.defineJobs();

      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, [
        "login",
        "archiveTweets",
        "indexBookmarks",
        "indexConversations",
        "indexMessages",
        "archiveBuild",
      ]);
    });

    it("should create delete jobs (tweets, retweets, likes, bookmarks, unfollowEveryone, DMs)", async () => {
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
      vi.mocked(xHasSomeData).mockResolvedValue(true);
      vm.account.xAccount!.deleteMyData = true;
      vm.account.xAccount!.deleteTweets = true;
      vm.account.xAccount!.deleteRetweets = true;
      vm.account.xAccount!.deleteLikes = true;
      vm.account.xAccount!.deleteBookmarks = true;
      vm.account.xAccount!.unfollowEveryone = true;
      vm.account.xAccount!.deleteDMs = true;

      await vm.defineJobs();

      expect(xHasSomeData).toHaveBeenCalledWith(1);
      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, [
        "login",
        "deleteTweets",
        "deleteRetweets",
        "deleteLikes",
        "deleteBookmarks",
        "unfollowEveryone",
        "deleteDMs",
        "archiveBuild",
      ]);
    });

    it("should NOT create delete jobs when hasSomeData is false", async () => {
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
      vi.mocked(xHasSomeData).mockResolvedValue(false);
      vm.account.xAccount!.deleteMyData = true;
      vm.account.xAccount!.deleteTweets = true;
      vm.account.xAccount!.deleteRetweets = true;
      vm.account.xAccount!.deleteLikes = true;
      vm.account.xAccount!.deleteBookmarks = true;

      await vm.defineJobs();

      // Should only have login and unfollowEveryone/deleteDMs (which don't require hasSomeData)
      expect(mockElectronX.createJobs).toHaveBeenCalledWith(1, ["login"]);
    });

    it("should add archiveBuild when needed", async () => {
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
      vm.account.xAccount!.saveMyData = true;
      vm.account.xAccount!.archiveTweets = true;

      await vm.defineJobs();

      const jobTypes = mockElectronX.createJobs.mock.calls[0][1];
      expect(jobTypes).toContain("archiveBuild");
    });

    it("should NOT add archiveBuild when not needed", async () => {
      vi.mocked(getJobsType).mockReturnValue("tombstone");
      vm.account.xAccount!.tombstoneUpdateBio = true;

      await vm.defineJobs();

      const jobTypes = mockElectronX.createJobs.mock.calls[0][1];
      expect(jobTypes).not.toContain("archiveBuild");
    });

    it("should handle errors from createJobs", async () => {
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
      const testError = new Error("Failed to create jobs");
      mockElectronX.createJobs.mockRejectedValue(testError);

      await vm.defineJobs();

      expect(vm.error).toHaveBeenCalled();
      const errorCall = vi.mocked(vm.error).mock.calls[0];
      // x_unknownError enum value is "x_unknown"
      expect(errorCall[0]).toBe("x_unknown");
    });

    it("should combine saveMyData, archiveMyData, and deleteMyData correctly", async () => {
      vi.mocked(getJobsType).mockReturnValue("saveDeleteData");
      vi.mocked(xHasSomeData).mockResolvedValue(true);

      // Enable all three modes with overlapping options
      vm.account.xAccount!.saveMyData = true;
      vm.account.xAccount!.archiveTweets = true;
      vm.account.xAccount!.archiveTweetsHTML = true;

      vm.account.xAccount!.archiveMyData = true;
      vm.account.xAccount!.archiveBookmarks = true;

      vm.account.xAccount!.deleteMyData = true;
      vm.account.xAccount!.deleteTweets = true;

      await vm.defineJobs();

      const jobTypes = mockElectronX.createJobs.mock.calls[0][1];

      // Should have login
      expect(jobTypes).toContain("login");

      // Should have indexTweets (from saveMyData)
      expect(jobTypes).toContain("indexTweets");

      // Should have archiveTweets (can appear twice when both saveMyData and archiveMyData are enabled)
      expect(jobTypes).toContain("archiveTweets");

      // Should have indexBookmarks (from archiveMyData)
      expect(jobTypes).toContain("indexBookmarks");

      // Should have deleteTweets (from deleteMyData)
      expect(jobTypes).toContain("deleteTweets");

      // Should have archiveBuild
      expect(jobTypes).toContain("archiveBuild");
    });
  });

  describe("runJob()", () => {
    beforeEach(() => {
      vm.jobs = [
        { jobType: "login", status: "pending", startedAt: null } as XJob,
        { jobType: "indexTweets", status: "pending", startedAt: null } as XJob,
        { jobType: "deleteTweets", status: "pending", startedAt: null } as XJob,
        {
          jobType: "migrateBluesky",
          status: "pending",
          startedAt: null,
        } as XJob,
      ];

      // Mock helper methods
      vi.mocked(Helpers.syncProgress).mockResolvedValue(undefined);
      vi.mocked(Helpers.runJobLogin).mockResolvedValue(true);
      vi.mocked(IndexJobs.runJobIndexTweets).mockResolvedValue(true);
      vi.mocked(DeleteJobs.runJobDeleteTweets).mockResolvedValue(undefined);
      vi.mocked(MigrateJobs.runJobMigrateBluesky).mockResolvedValue(true);
    });

    it("should route to correct job function based on jobType", async () => {
      // Test login
      await vm.runJob(0);
      expect(Helpers.runJobLogin).toHaveBeenCalledWith(vm, 0);

      // Test indexTweets
      await vm.runJob(1);
      expect(IndexJobs.runJobIndexTweets).toHaveBeenCalledWith(vm, 1);

      // Test deleteTweets
      await vm.runJob(2);
      expect(DeleteJobs.runJobDeleteTweets).toHaveBeenCalledWith(vm, 2);

      // Test migrateBluesky
      await vm.runJob(3);
      expect(MigrateJobs.runJobMigrateBluesky).toHaveBeenCalledWith(vm, 3);
    });

    it("should set job metadata (startedAt, status, currentJob)", async () => {
      const beforeRunJob = new Date();

      await vm.runJob(0);

      // Check that startedAt was set
      expect(vm.jobs[0].startedAt).toBeDefined();
      expect(vm.jobs[0].startedAt).toBeInstanceOf(Date);
      expect(vm.jobs[0].startedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeRunJob.getTime(),
      );

      // Check that status was set to running
      expect(vm.jobs[0].status).toBe("running");

      // Check that currentJob was set
      expect(vm.progress.currentJob).toBe("login");
    });

    it("should call syncProgress and updateJob", async () => {
      await vm.runJob(0);

      expect(Helpers.syncProgress).toHaveBeenCalledWith(vm);
      expect(mockElectronX.updateJob).toHaveBeenCalledWith(
        1,
        expect.stringContaining('"jobType":"login"'),
      );
    });

    it("should reset logs and wait for pause before running", async () => {
      await vm.runJob(0);

      expect(vm.resetLogs).toHaveBeenCalled();
      expect(vm.waitForPause).toHaveBeenCalled();
    });
  });

  describe("run() - State Machine", () => {
    beforeEach(() => {
      // Mock helper methods
      vi.mocked(AuthOps.login).mockResolvedValue(undefined);
      vi.mocked(AuthOps.loadUserStats).mockResolvedValue(undefined);
      vi.mocked(Helpers.getDatabaseStatsString).mockResolvedValue(
        "100 tweets, 50 likes",
      );
    });

    it("State.Login - sets up login flow, transitions to WizardPrestart", async () => {
      vm.state = State.Login;

      await vm.run();

      expect(vm.instructions).toContain("log in to your X account");
      expect(vm.showBrowser).toBe(true);
      expect(vm.showAutomationNotice).toBe(false);
      expect(AuthOps.login).toHaveBeenCalledWith(vm);
      expect(vm.state).toBe(State.WizardPrestart);
    });

    it("State.WizardPrestart - conditional user stats loading", async () => {
      vm.state = State.WizardPrestart;
      vm.account.xAccount!.tweetsCount = -1;
      vm.account.xAccount!.likesCount = -1;
      vm.account.xAccount!.archiveOnly = false;
      mockElectronX.getConfig.mockResolvedValue("false");

      await vm.run();

      expect(AuthOps.loadUserStats).toHaveBeenCalledWith(vm);
      expect(vm.showBrowser).toBe(false);
      expect(vm.state).toBe(State.WizardStart);
    });

    it("State.WizardPrestart - should skip stats loading when archiveOnly is true", async () => {
      vm.state = State.WizardPrestart;
      vm.account.xAccount!.tweetsCount = -1;
      vm.account.xAccount!.likesCount = -1;
      vm.account.xAccount!.archiveOnly = true;

      await vm.run();

      expect(AuthOps.loadUserStats).not.toHaveBeenCalled();
      expect(vm.state).toBe(State.WizardStart);
    });

    it("State.WizardPrestart - should skip stats loading when counts are already loaded", async () => {
      vm.state = State.WizardPrestart;
      vm.account.xAccount!.tweetsCount = 100;
      vm.account.xAccount!.likesCount = 50;
      mockElectronX.getConfig.mockResolvedValue("false");

      await vm.run();

      expect(AuthOps.loadUserStats).not.toHaveBeenCalled();
      expect(vm.state).toBe(State.WizardStart);
    });

    it("State.WizardArchiveOnly - calls initArchiveOnlyMode, updates account", async () => {
      vm.state = State.WizardArchiveOnly;
      const updatedAccount = {
        ...mockAccount,
        xAccount: { ...mockAccount.xAccount!, archiveOnly: true },
      };
      mockElectronDatabase.getAccount.mockResolvedValue(updatedAccount);

      await vm.run();

      expect(mockElectronX.initArchiveOnlyMode).toHaveBeenCalledWith(1);
      expect(mockElectronDatabase.getAccount).toHaveBeenCalledWith(1);
      expect(vm.account.xAccount!.archiveOnly).toBe(true);
      expect(vm.showBrowser).toBe(false);
      expect(vm.instructions).toContain("pre-existing X archive");
      expect(vm.loadBlank).toHaveBeenCalled();
      expect(vm.state).toBe(State.WizardArchiveOnlyDisplay);
    });

    it("State.RunJobs - job execution loop", async () => {
      vm.state = State.RunJobs;
      vm.jobs = [
        { jobType: "login", status: "pending" } as XJob,
        { jobType: "indexTweets", status: "pending" } as XJob,
      ];
      vm.currentJobIndex = 0;

      vi.mocked(Helpers.runJobLogin).mockResolvedValue(true);
      vi.mocked(IndexJobs.runJobIndexTweets).mockResolvedValue(true);
      vi.mocked(Helpers.syncProgress).mockResolvedValue(undefined);

      // Mock runJob to track calls
      const originalRunJob = vm.runJob.bind(vm);
      vm.runJob = vi.fn().mockImplementation(originalRunJob);

      await vm.run();

      expect(mockElectronX.resetProgress).toHaveBeenCalledWith(1);
      expect(mockElectronDatabase.dismissNewErrorReports).toHaveBeenCalledWith(
        1,
      );
      expect(vm.runJob).toHaveBeenCalledTimes(2);
      expect(vm.currentJobIndex).toBe(0); // Reset after jobs complete
      expect(mockElectronX.getDatabaseStats).toHaveBeenCalled(); // refreshDatabaseStats
      expect(vm.state).toBe(State.FinishedRunningJobs);
      expect(vm.showBrowser).toBe(false);
    });

    it("State.RunJobs - error handling", async () => {
      vm.state = State.RunJobs;
      vm.jobs = [{ jobType: "login", status: "pending" } as XJob];

      const testError = new Error("Job execution failed");
      vi.mocked(Helpers.runJobLogin).mockRejectedValue(testError);
      vi.mocked(Helpers.syncProgress).mockResolvedValue(undefined);

      await vm.run();

      expect(vm.error).toHaveBeenCalled();
      const errorCall = vi.mocked(vm.error).mock.calls[0];
      expect(errorCall[0]).toMatch(/runJob.*UnknownError/i);
    });

    it("State.RunJobs - progress reset", async () => {
      vm.state = State.RunJobs;
      vm.jobs = [];

      await vm.run();

      expect(mockElectronX.resetProgress).toHaveBeenCalledWith(1);
      expect(vm.progress).toBeDefined();
    });

    it("State.Debug - loop behavior", async () => {
      vm.state = State.Debug;

      // Mock sleep to change state after first iteration
      let sleepCallCount = 0;
      vi.mocked(vm.sleep).mockImplementation(async () => {
        sleepCallCount++;
        if (sleepCallCount >= 3) {
          vm.state = State.WizardStart; // Exit debug loop
        }
      });

      await vm.run();

      expect(vm.showBrowser).toBe(false);
      expect(vm.loadBlank).toHaveBeenCalled();
      expect(vm.instructions).toContain("debug state");
      expect(vm.sleep).toHaveBeenCalledWith(1000);
      expect(sleepCallCount).toBeGreaterThanOrEqual(3);
    });

    it("showBrowser/instructions are set correctly (WizardDashboard)", async () => {
      vm.state = State.WizardDashboard;

      await vm.run();

      expect(vm.showBrowser).toBe(false);
      expect(vm.instructions.toLowerCase()).toContain("your");
      expect(vm.instructions.toLowerCase()).toContain("data");
      expect(vm.state).toBe(State.WizardDashboardDisplay);
      expect(vm.loadBlank).toHaveBeenCalled();
    });

    it("showBrowser/instructions are set correctly (WizardDeleteReview)", async () => {
      vm.state = State.WizardDeleteReview;
      vi.mocked(Helpers.getDatabaseStatsString).mockResolvedValue(
        "100 tweets, 50 likes",
      );

      await vm.run();

      expect(vm.showBrowser).toBe(false);
      expect(vm.instructions).toContain("finished saving");
      expect(vm.instructions).toContain("100 tweets, 50 likes");
      expect(vm.state).toBe(State.WizardDeleteReviewDisplay);
      expect(vm.loadBlank).toHaveBeenCalled();
    });

    it("error handling in run() catches and logs errors", async () => {
      vm.state = State.WizardPrestart;
      const testError = new Error("Unexpected error in run()");
      vi.mocked(AuthOps.loadUserStats).mockRejectedValue(testError);
      vm.account.xAccount!.tweetsCount = -1;
      vm.account.xAccount!.likesCount = -1;
      vm.account.xAccount!.archiveOnly = false;

      await vm.run();

      // Verify error was called with correct error type
      expect(vm.error).toHaveBeenCalled();
      const errorCall = vi.mocked(vm.error).mock.calls[0];
      expect(errorCall[0]).toBe("x_runError");

      // Verify error data structure exists and has expected properties
      expect(errorCall[1]).toBeDefined();
      expect(errorCall[1]).toHaveProperty("state");
      expect((errorCall[1] as { state: State }).state).toBe(
        State.WizardPrestart,
      );
    });
  });

  describe("Helper Method Delegation", () => {
    it("should verify delegation methods exist and call helpers", async () => {
      // Test a few delegation methods as smoke tests

      // graphqlDelete
      vi.mocked(GraphQLOps.graphqlDelete).mockResolvedValue(200);
      const result1 = await vm.graphqlDelete("ct0", "url", "referrer", "body");
      expect(GraphQLOps.graphqlDelete).toHaveBeenCalledWith(
        vm,
        "ct0",
        "url",
        "referrer",
        "body",
      );
      expect(result1).toBe(200);

      // waitForRateLimit
      vi.mocked(RateLimitOps.waitForRateLimit).mockResolvedValue(undefined);
      await vm.waitForRateLimit();
      expect(RateLimitOps.waitForRateLimit).toHaveBeenCalledWith(vm);

      // syncProgress
      vi.mocked(Helpers.syncProgress).mockResolvedValue(undefined);
      await vm.syncProgress();
      expect(Helpers.syncProgress).toHaveBeenCalledWith(vm);
    });
  });
});
