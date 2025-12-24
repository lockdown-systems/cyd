import { vi } from "vitest";
import type { WebviewTag } from "electron";
import type { Emitter, EventType } from "mitt";
import mitt from "mitt";
import type { Account, XAccount, FacebookAccount } from "../../shared_types";
import type { VueWrapper } from "@vue/test-utils";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import CydAPIClient from "../../cyd-api-client";
import type { DeviceInfo } from "./types";
import type { TranslatorFn, TranslatorParams } from "./i18n/translator";
import en from "./i18n/locales/en.json";

/**
 * General test utilities for all view models
 * These mocks can be used across X, Bluesky, and other view models
 */

/**
 * Creates a mock XAccount with default values that can be overridden
 */
export function createMockXAccount(overrides?: Partial<XAccount>): XAccount {
  const now = new Date();
  return {
    id: 1,
    createdAt: now,
    updatedAt: now,
    accessedAt: now,
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
    tweetsCount: 500,
    likesCount: 300,
    tombstoneUpdateBanner: false,
    tombstoneUpdateBannerBackground: "",
    tombstoneUpdateBannerSocialIcons: "",
    tombstoneUpdateBannerShowText: false,
    tombstoneBannerDataURL: "",
    tombstoneUpdateBio: false,
    tombstoneUpdateBioText: "",
    tombstoneUpdateBioCreditCyd: false,
    tombstoneLockAccount: false,
    ...overrides,
  };
}

export function createMockFacebookAccount(
  overrides?: Partial<FacebookAccount>,
): FacebookAccount {
  const now = new Date();
  return {
    id: 1,
    createdAt: now,
    updatedAt: now,
    accessedAt: now,
    username: "facebook-user",
    profileImageDataURI: "",
    accountID: null,
    deleteWallPosts: false,
    userLang: "English (US)",
    ...overrides,
  };
}

/**
 * Creates a mock Account with default values that can be overridden
 * By default creates an X account, but can be customized for other types
 */
export function createMockAccount(overrides?: Partial<Account>): Account {
  return {
    id: 1,
    type: "X",
    sortOrder: 0,
    xAccount: createMockXAccount(),
    blueskyAccount: null,
    facebookAccount: null,
    uuid: "test-uuid-123",
    ...overrides,
  };
}

/**
 * Creates a mock WebviewTag for testing
 * This can be used by any view model that uses Electron's WebviewTag
 */
export function createMockWebview(): WebviewTag {
  const mockWebview = {
    loadURL: vi.fn().mockResolvedValue(undefined),
    getURL: vi.fn().mockReturnValue("about:blank"),
    getWebContentsId: vi.fn().mockReturnValue(1),
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    isLoading: vi.fn().mockReturnValue(false),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    sendInputEvent: vi.fn(),
    openDevTools: vi.fn(),
    capturePage: vi.fn().mockReturnValue({
      toDataURL: vi.fn().mockReturnValue("data:image/png;base64,test"),
    }),
  } as unknown as WebviewTag;

  return mockWebview;
}

/**
 * Creates a mock mitt emitter for testing
 * Used by view models for event emission
 */
export function createMockEmitter(): Emitter<Record<EventType, unknown>> {
  return mitt();
}

/**
 * Mock the global window.electron API
 * Call this in beforeEach() to set up the electron API
 * This provides mocks for all electron IPC calls used across view models
 */
export function mockElectronAPI() {
  const mockElectron = {
    // Database operations (used by all view models)
    database: {
      getAccount: vi.fn().mockResolvedValue(createMockAccount()),
      getAccounts: vi.fn().mockResolvedValue([]),
      createAccount: vi.fn().mockResolvedValue(createMockAccount()),
      saveAccount: vi.fn().mockResolvedValue(undefined),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
      selectAccountType: vi.fn().mockResolvedValue(createMockAccount()),
      getConfig: vi.fn().mockResolvedValue(null),
      setConfig: vi.fn().mockResolvedValue(undefined),
      createErrorReport: vi.fn().mockResolvedValue(undefined),
      dismissNewErrorReports: vi.fn().mockResolvedValue(undefined),
    },

    // X operations
    X: {
      getDatabaseStats: vi.fn().mockResolvedValue({
        tweetsSaved: 0,
        tweetsDeleted: 0,
        retweetsSaved: 0,
        retweetsDeleted: 0,
        likesSaved: 0,
        likesDeleted: 0,
        bookmarksSaved: 0,
        bookmarksDeleted: 0,
        conversationsDeleted: 0,
        accountsUnfollowed: 0,
        tweetsMigratedToBluesky: 0,
      }),
      syncProgress: vi.fn().mockResolvedValue(undefined),
      resetProgress: vi.fn().mockResolvedValue({
        currentJob: "",
        isIndexTweetsFinished: false,
        isIndexConversationsFinished: false,
        isIndexMessagesFinished: false,
        isIndexLikesFinished: false,
        isArchiveTweetsFinished: false,
        isArchiveLikesFinished: false,
        isIndexBookmarksFinished: false,
        isDeleteDMsFinished: false,
        isUnfollowEveryoneFinished: false,
        tweetsIndexed: 0,
        retweetsIndexed: 0,
        usersIndexed: 0,
        conversationsIndexed: 0,
        messagesIndexed: 0,
        likesIndexed: 0,
        unknownIndexed: 0,
        totalTweetsToArchive: 0,
        tweetsArchived: 0,
        newTweetsArchived: 0,
        totalLikesToArchive: 0,
        likesArchived: 0,
        totalBookmarksToIndex: 0,
        bookmarksIndexed: 0,
        totalConversations: 0,
        conversationMessagesIndexed: 0,
        totalTweetsToDelete: 0,
        tweetsDeleted: 0,
        totalRetweetsToDelete: 0,
        retweetsDeleted: 0,
        totalLikesToDelete: 0,
        likesDeleted: 0,
        totalBookmarksToDelete: 0,
        bookmarksDeleted: 0,
        conversationsDeleted: 0,
        accountsUnfollowed: 0,
        totalTweetsToMigrate: 0,
        migrateTweetsCount: 0,
        migrateSkippedTweetsCount: 0,
        migrateSkippedTweetsErrors: {},
        totalMigratedPostsToDelete: 0,
        migrateDeletePostsCount: 0,
        migrateDeleteSkippedPostsCount: 0,
        errorsOccured: 0,
      }),
      createJobs: vi.fn().mockResolvedValue([]),
      updateJob: vi.fn().mockResolvedValue(undefined),
      setConfig: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn().mockResolvedValue("false"),
      getCookie: vi.fn().mockResolvedValue("test-cookie"),
      getImageDataURI: vi.fn().mockResolvedValue("data:image/png;base64,test"),
      resetRateLimitInfo: vi.fn().mockResolvedValue(undefined),
      isRateLimited: vi
        .fn()
        .mockResolvedValue({ isRateLimited: false, rateLimitReset: 0 }),
      indexStart: vi.fn().mockResolvedValue(undefined),
      indexStop: vi.fn().mockResolvedValue(undefined),
      indexParseTweets: vi.fn().mockResolvedValue({
        currentJob: "",
        tweetsIndexed: 0,
        retweetsIndexed: 0,
      }),
      indexParseConversations: vi.fn().mockResolvedValue({
        currentJob: "",
        conversationsIndexed: 0,
      }),
      indexParseMessages: vi.fn().mockResolvedValue({
        currentJob: "",
        messagesIndexed: 0,
      }),
      indexIsThereMore: vi.fn().mockResolvedValue(false),
      indexMessagesStart: vi.fn().mockResolvedValue({
        conversationIDs: [],
        totalConversations: 0,
      }),
      indexConversationFinished: vi.fn().mockResolvedValue(undefined),
      resetThereIsMore: vi.fn().mockResolvedValue(undefined),
      getLatestResponseData: vi.fn().mockResolvedValue(""),
      archiveTweetsStart: vi.fn().mockResolvedValue({
        outputPath: "/test/path",
        items: [],
      }),
      archiveTweet: vi.fn().mockResolvedValue(undefined),
      archiveTweetCheckDate: vi.fn().mockResolvedValue(undefined),
      archiveBuild: vi.fn().mockResolvedValue(undefined),
      deleteTweetsStart: vi.fn().mockResolvedValue({ tweets: [] }),
      deleteRetweetsStart: vi.fn().mockResolvedValue({ tweets: [] }),
      deleteLikesStart: vi.fn().mockResolvedValue({ tweets: [] }),
      deleteBookmarksStart: vi.fn().mockResolvedValue({ tweets: [] }),
      deleteTweet: vi.fn().mockResolvedValue(undefined),
      deleteDMsMarkAllDeleted: vi.fn().mockResolvedValue(undefined),
      blueskyGetTweetCounts: vi.fn().mockResolvedValue({
        toMigrateTweets: [],
        alreadyMigratedTweets: [],
      }),
      blueskyMigrateTweet: vi.fn().mockResolvedValue(true),
      blueskyDeleteMigratedTweet: vi.fn().mockResolvedValue(true),
      initArchiveOnlyMode: vi.fn().mockResolvedValue(undefined),
      getMediaPath: vi.fn().mockResolvedValue("/test/media/path"),
    },

    // Archive operations (used by multiple view models)
    archive: {
      getInfo: vi.fn().mockResolvedValue({
        folderEmpty: true,
        indexHTMLExists: false,
      }),
      isPageAlreadySaved: vi.fn().mockResolvedValue(false),
      savePage: vi.fn().mockResolvedValue(undefined),
    },

    // Facebook operations
    Facebook: {
      createJobs: vi.fn().mockImplementation((_accountID, jobTypes: string[]) =>
        Promise.resolve(
          jobTypes.map((jobType, index) => ({
            id: index + 1,
            jobType,
            status: "pending",
            scheduledAt: new Date(),
            startedAt: null,
            finishedAt: null,
            progressJSON: "",
            error: null,
          })),
        ),
      ),
      getLastFinishedJob: vi.fn().mockResolvedValue(null),
      updateJob: vi.fn().mockResolvedValue(undefined),
      getProgressInfo: vi.fn().mockResolvedValue({
        accountUUID: "test-uuid-123",
        totalWallPostsDeleted: 0,
      }),
      getConfig: vi.fn().mockResolvedValue(null),
      setConfig: vi.fn().mockResolvedValue(undefined),
      deleteConfig: vi.fn().mockResolvedValue(undefined),
      deleteConfigLike: vi.fn().mockResolvedValue(undefined),
      incrementTotalWallPostsDeleted: vi.fn().mockResolvedValue(undefined),
    },

    // Analytics (used by all view models)
    trackEvent: vi.fn().mockResolvedValue(undefined),

    // Utility (used by all view models)
    shouldOpenDevtools: vi.fn().mockResolvedValue(false),
    getAPIURL: vi.fn().mockResolvedValue("https://api.test.com"),
    getMode: vi.fn().mockResolvedValue("prod"),
    getVersion: vi.fn().mockResolvedValue("1.0.0"),
    getPlatform: vi.fn().mockResolvedValue("darwin"),
    openURL: vi.fn().mockResolvedValue(undefined),
    isFeatureEnabled: vi.fn().mockResolvedValue(false),
    showQuestion: vi.fn().mockResolvedValue(true),
    showError: vi.fn(),

    // Power monitor (used by all view models)
    onPowerMonitorSuspend: vi.fn(),
    onPowerMonitorResume: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).window = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(global as any).window,
    electron: mockElectron,
  };

  return mockElectron;
}

/**
 * Helper to spy on all electron API methods
 * Returns an object with all spies for easy verification
 * This is useful for verifying that view models call the correct electron methods
 */
export function spyOnElectronAPI() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const electron = (global as any).window.electron;
  if (!electron) {
    throw new Error(
      "window.electron not found. Did you call mockElectronAPI()?",
    );
  }

  return {
    database: {
      getAccount: vi.spyOn(electron.database, "getAccount"),
      saveAccount: vi.spyOn(electron.database, "saveAccount"),
      createErrorReport: vi.spyOn(electron.database, "createErrorReport"),
    },
    X: {
      getDatabaseStats: vi.spyOn(electron.X, "getDatabaseStats"),
      syncProgress: vi.spyOn(electron.X, "syncProgress"),
      resetProgress: vi.spyOn(electron.X, "resetProgress"),
      createJobs: vi.spyOn(electron.X, "createJobs"),
      updateJob: vi.spyOn(electron.X, "updateJob"),
      setConfig: vi.spyOn(electron.X, "setConfig"),
      getConfig: vi.spyOn(electron.X, "getConfig"),
      getCookie: vi.spyOn(electron.X, "getCookie"),
      indexParseTweets: vi.spyOn(electron.X, "indexParseTweets"),
      deleteTweet: vi.spyOn(electron.X, "deleteTweet"),
    },
    archive: {
      getInfo: vi.spyOn(electron.archive, "getInfo"),
      savePage: vi.spyOn(electron.archive, "savePage"),
    },
    trackEvent: vi.spyOn(electron, "trackEvent"),
  };
}

/**
 * Resets all mocks created by mockElectronAPI
 * Call this in afterEach() to clean up between tests
 */
export function resetElectronAPIMocks() {
  vi.clearAllMocks();
}

/**
 * Helper to wait for async operations in tests
 * Useful for testing async state changes
 *
 * @param fn Function that returns true when the condition is met
 * @param timeout Maximum time to wait in milliseconds
 */
export async function waitForAsync(
  fn: () => boolean,
  timeout: number = 1000,
): Promise<void> {
  const startTime = Date.now();
  while (!fn()) {
    if (Date.now() - startTime > timeout) {
      throw new Error("waitForAsync timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Creates a mock DeviceInfo object for testing
 */
export function createMockDeviceInfo(
  overrides?: Partial<DeviceInfo>,
): DeviceInfo {
  return {
    userEmail: "test@example.com",
    deviceDescription: "Test Device",
    deviceToken: "test-device-token",
    deviceUUID: "test-device-uuid",
    apiToken: "test-api-token",
    valid: true,
    ...overrides,
  };
}

/**
 * Creates a mock CydAPIClient for testing
 */
export function createMockApiClient(): CydAPIClient {
  const client = new CydAPIClient();

  // Mock the authenticate method
  vi.spyOn(client, "authenticate").mockResolvedValue({
    success: true,
    deviceInfo: createMockDeviceInfo(),
  } as never);

  return client;
}

/**
 * Helper function to mount Vue components with common providers
 * This ensures consistent setup across all component tests
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountWithProviders<T = any>(
  component: T,
  options: {
    props?: Record<string, unknown>;
    provide?: Record<string, unknown>;
    global?: Record<string, unknown>;
  } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): VueWrapper<any> {
  const defaultProvide = {
    apiClient: ref(createMockApiClient()),
    deviceInfo: ref(createMockDeviceInfo()),
    userEmail: ref("test@example.com"),
    emitter: createMockEmitter(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mount(component as any, {
    global: {
      provide: {
        ...defaultProvide,
        ...options.provide,
      },
      ...options.global,
    },
    props: options.props,
  });
}

function lookupTranslation(key: string): string | undefined {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, en) as string | undefined;
}

function interpolateParams(template: string, params: TranslatorParams): string {
  return Object.entries(params).reduce((result, [paramKey, value]) => {
    return result.split(`{${paramKey}}`).join(String(value));
  }, template);
}

export function createTestTranslator(): TranslatorFn {
  return (key, params: TranslatorParams = {}) => {
    const message = lookupTranslation(key);
    const template = typeof message === "string" ? message : key;
    return interpolateParams(template, params);
  };
}

export function createTestTranslatorModule() {
  const translator = createTestTranslator();
  return {
    translate: translator,
    getTranslator: () => translator,
  };
}
