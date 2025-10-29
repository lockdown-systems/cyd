import { vi } from "vitest";
import { XViewModel } from "./view_model";
import { State, RunJobsState } from "./types";
import type {
  Account,
  XJob,
  XProgress,
  XRateLimitInfo,
  XTweetItem,
} from "../../../../shared_types";
import { emptyXProgress } from "../../../../shared_types";
import {
  createMockAccount,
  createMockWebview,
  createMockEmitter,
} from "../../test_util";

/**
 * XViewModel-specific test utilities
 * These utilities are specific to testing XViewModel and build upon the general test utilities
 */

/**
 * Creates a mock XViewModel with mocked dependencies
 * This is the main factory for testing XViewModel
 *
 * @param accountOverrides Optional overrides for the account
 * @param vmOverrides Optional overrides for the view model instance
 * @returns A fully mocked XViewModel instance ready for testing
 *
 * @example
 * const vm = createMockXViewModel({
 *   xAccount: { username: 'testuser', tweetsCount: 100 }
 * });
 */
export function createMockXViewModel(
  accountOverrides?: Partial<Account>,
  vmOverrides?: Partial<XViewModel>,
): XViewModel {
  const mockAccount = createMockAccount(accountOverrides);
  const mockEmitter = createMockEmitter();
  const mockWebview = createMockWebview();

  // Create the XViewModel instance
  const vm = new XViewModel(mockAccount, mockEmitter);

  // Mock the webview
  vm.webview = mockWebview;
  vm.webContentsID = 1;
  vm.isWebviewDestroyed = false;

  // Set some sensible defaults for testing
  vm.state = State.Login;
  vm.runJobsState = RunJobsState.Default;
  vm.isPaused = false;
  vm.showBrowser = false;
  vm.showAutomationNotice = false;
  vm.domReady = true;

  // Mock common methods that are called frequently
  vi.spyOn(vm, "log").mockImplementation(() => {});
  vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
  vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
  vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);

  // Apply any overrides
  if (vmOverrides) {
    Object.assign(vm, vmOverrides);
  }

  return vm;
}

/**
 * Creates a mock XJob with default values that can be overridden
 *
 * @param jobType The type of job to create
 * @param overrides Optional overrides for specific job properties
 * @returns A mock XJob
 *
 * @example
 * const job = createMockJob('indexTweets', { status: 'running' });
 */
export function createMockJob(
  jobType: string,
  overrides?: Partial<XJob>,
): XJob {
  const now = new Date();
  return {
    id: 1,
    jobType,
    status: "pending",
    scheduledAt: now,
    startedAt: null,
    finishedAt: null,
    progressJSON: JSON.stringify(emptyXProgress()),
    error: null,
    ...overrides,
  };
}

/**
 * Creates mock XProgress with specific values
 *
 * @param overrides Optional overrides for specific progress fields
 * @returns A mock XProgress object
 *
 * @example
 * const progress = createMockProgress({ tweetsIndexed: 100, likesIndexed: 50 });
 */
export function createMockProgress(overrides?: Partial<XProgress>): XProgress {
  return {
    ...emptyXProgress(),
    ...overrides,
  };
}

/**
 * Creates mock XRateLimitInfo
 *
 * @param isRateLimited Whether the account is rate limited
 * @param rateLimitReset Unix timestamp when the rate limit resets
 * @returns A mock XRateLimitInfo object
 *
 * @example
 * const rateLimitInfo = createMockRateLimitInfo(true, Date.now() / 1000 + 900);
 */
export function createMockRateLimitInfo(
  isRateLimited: boolean = false,
  rateLimitReset: number = 0,
): XRateLimitInfo {
  return {
    isRateLimited,
    rateLimitReset,
  };
}

/**
 * Creates a mock XTweetItem for testing
 *
 * @param overrides Optional overrides for specific tweet properties
 * @returns A mock XTweetItem
 *
 * @example
 * const tweet = createMockTweetItem({ t: 'Hello world!', l: 100 });
 */
export function createMockTweetItem(
  overrides?: Partial<XTweetItem>,
): XTweetItem {
  return {
    id: "123456789",
    t: "Test tweet text",
    l: 10,
    r: 5,
    d: new Date().toISOString(),
    i: [],
    v: [],
    ...overrides,
  };
}

/**
 * Creates a batch of mock tweets for testing lists
 *
 * @param count Number of tweets to create
 * @param baseOverrides Base overrides to apply to all tweets
 * @returns An array of mock XTweetItem objects
 *
 * @example
 * const tweets = createMockTweetBatch(10, { l: 5 });
 */
export function createMockTweetBatch(
  count: number,
  baseOverrides?: Partial<XTweetItem>,
): XTweetItem[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTweetItem({
      id: `${1000000000 + i}`,
      t: `Test tweet ${i + 1}`,
      ...baseOverrides,
    }),
  );
}

/**
 * Creates a batch of mock jobs for testing job queues
 *
 * @param jobTypes Array of job types to create
 * @param baseOverrides Base overrides to apply to all jobs
 * @returns An array of mock XJob objects
 *
 * @example
 * const jobs = createMockJobBatch(['login', 'indexTweets', 'deleteTweets']);
 */
export function createMockJobBatch(
  jobTypes: string[],
  baseOverrides?: Partial<XJob>,
): XJob[] {
  return jobTypes.map((jobType, i) =>
    createMockJob(jobType, {
      id: i + 1,
      ...baseOverrides,
    }),
  );
}
