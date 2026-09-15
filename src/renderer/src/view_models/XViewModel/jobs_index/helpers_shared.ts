import type { XViewModel } from "../view_model";
import { TimeoutError, URLChangedError } from "../../BaseViewModel";
import { AutomationErrorType } from "../../../automation_errors";
import { formatError } from "../../../util";
import {
  indexTweetsHandleRateLimit,
  indexTweetsCheckForSomethingWrong,
  indexTweetsVerifyThereIsNoMore,
} from "./helpers_tweets";

// Shared helpers for indexing content

/**
 * What the parser made of the responses X returned for a timeline.
 *
 * - `saved`: tweets arrived and were saved.
 * - `empty`: X answered with a timeline that carries no tweets. The account
 *   really is empty, and the run should finish quietly.
 * - `unreadable`: X never answered with a timeline Cyd recognizes, or the
 *   tweets in it were in a shape Cyd could not read. Indistinguishable from
 *   success to the user, so it has to be reported.
 */
export type IndexContentOutcome = "saved" | "empty" | "unreadable";

export async function indexContentCheckOutcome(
  vm: XViewModel,
): Promise<IndexContentOutcome> {
  const stats = await window.electron.X.indexTimelineStats(vm.account.id);
  vm.log("indexContentCheckOutcome", stats);

  if (stats.recognizedResponses == 0) {
    return "unreadable";
  }
  if (stats.tweetEntries == 0) {
    return "empty";
  }
  if (stats.tweetsSaved == 0) {
    return "unreadable";
  }
  return "saved";
}

export interface IndexContentLoadResult {
  // Content appeared on the page
  loaded: boolean;
  // An automation error was raised, so the job is over
  errorTriggered: boolean;
  // A rate limit was waited out, so the route is worth another try
  rateLimited: boolean;
}

/**
 * Wait for content to appear on the timeline that is already loaded.
 * @param vm - XViewModel instance
 * @param selector - Selector to wait for
 * @param errorTypeURLChanged - Error type for URL changed
 * @param errorTypeOther - Error type for other errors
 */
export async function indexContentWaitForInitialLoad(
  vm: XViewModel,
  selector: string,
  errorTypeURLChanged: AutomationErrorType,
  errorTypeOther: AutomationErrorType,
): Promise<IndexContentLoadResult> {
  try {
    await vm.waitForSelector(selector);
    return { loaded: true, errorTriggered: false, rateLimited: false };
  } catch (e) {
    vm.log("indexContentWaitForInitialLoad", [`selector never appeared`, e]);
    if (e instanceof TimeoutError) {
      // Were we rate limited?
      vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
      if (vm.rateLimitInfo.isRateLimited) {
        await vm.waitForRateLimit();
        return { loaded: false, errorTriggered: false, rateLimited: true };
      }

      // Nothing rendered. Whether that means the account is empty or that
      // something is wrong is for the caller to decide, from what X returned.
      await vm.waitForLoadingToFinish();
      return { loaded: false, errorTriggered: false, rateLimited: false };
    } else if (e instanceof URLChangedError) {
      const newURL = vm.webview?.getURL();
      await vm.error(
        errorTypeURLChanged,
        {
          newURL: newURL,
          error: formatError(e as Error),
        },
        {
          currentURL: vm.webview?.getURL(),
        },
      );
      return { loaded: false, errorTriggered: true, rateLimited: false };
    } else {
      await vm.error(
        errorTypeOther,
        {
          error: formatError(e as Error),
        },
        {
          currentURL: vm.webview?.getURL(),
        },
      );
      return { loaded: false, errorTriggered: true, rateLimited: false };
    }
  }
}

/**
 * Handle rate limit during scrolling
 * @param vm - XViewModel instance
 * @param failureStateKey - Key in FailureState enum
 * @returns {shouldContinue, shouldBreak}
 */
export async function indexContentProcessRateLimit(
  vm: XViewModel,
  failureStateKey: string,
): Promise<{ shouldContinue: boolean; shouldBreak: boolean }> {
  vm.log("indexContentProcessRateLimit", ["rate limited", vm.progress]);

  await vm.sleep(500);
  await vm.scrollToBottom();
  await vm.waitForRateLimit();

  if (!(await indexTweetsHandleRateLimit(vm))) {
    await window.electron.X.setConfig(vm.account.id, failureStateKey, "true");
    return { shouldContinue: false, shouldBreak: true };
  }

  await vm.sleep(500);
  vm.log("indexContentProcessRateLimit", ["finished waiting for rate limit"]);
  return { shouldContinue: true, shouldBreak: false };
}

/**
 * Parse content from the current page
 * @param vm - XViewModel instance
 * @param jobIndex - Current job index
 * @param errorType - Error type to use if parsing fails
 * @returns {success, errorTriggered}
 */
export async function indexContentParsePage(
  vm: XViewModel,
  jobIndex: number,
  errorType: AutomationErrorType,
): Promise<{ success: boolean; errorTriggered: boolean }> {
  try {
    vm.progress = await window.electron.X.indexParseTweets(vm.account.id);
    vm.log("indexContentParsePage", ["parsed content", vm.progress]);
  } catch (e) {
    const latestResponseData = await window.electron.X.getLatestResponseData(
      vm.account.id,
    );
    await vm.error(
      errorType,
      {
        error: formatError(e as Error),
      },
      {
        latestResponseData: latestResponseData,
        currentURL: vm.webview?.getURL(),
      },
    );
    return { success: false, errorTriggered: true };
  }
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  await window.electron.X.updateJob(
    vm.account.id,
    JSON.stringify(vm.jobs[jobIndex]),
  );
  return { success: true, errorTriggered: false };
}

/**
 * Check if content indexing is complete
 * @param vm - XViewModel instance
 * @param jobIndex - Current job index
 * @param moreToScroll - Whether there's more to scroll
 * @param progressKey - Key to update in progress
 * @param failureStateKey - Key in FailureState enum
 * @param errorTypeVerify - Error type for verification errors
 * @returns {isComplete, errorTriggered, shouldContinue}
 */
export async function indexContentCheckCompletion(
  vm: XViewModel,
  jobIndex: number,
  moreToScroll: boolean,
  progressKey: string,
  failureStateKey: string,
  errorTypeVerify: AutomationErrorType,
): Promise<{
  isComplete: boolean;
  errorTriggered: boolean;
  shouldContinue: boolean;
}> {
  if (await window.electron.X.indexIsThereMore(vm.account.id)) {
    // More content to index
    if (!moreToScroll) {
      await vm.sleep(500);
      await vm.scrollUp(2000);
    }
    return { isComplete: false, errorTriggered: false, shouldContinue: true };
  }

  // Verify we're actually done
  let verifyResult = true;
  try {
    verifyResult = await indexTweetsVerifyThereIsNoMore(vm);
  } catch (e) {
    const latestResponseData = await window.electron.X.getLatestResponseData(
      vm.account.id,
    );
    await vm.error(
      errorTypeVerify,
      {
        error: formatError(e as Error),
      },
      {
        latestResponseData: latestResponseData,
        currentURL: vm.webview?.getURL(),
      },
    );
    return { isComplete: false, errorTriggered: true, shouldContinue: false };
  }

  if (verifyResult) {
    // Truly done
    (vm.progress as Record<string, unknown>)[progressKey] = true;
    await vm.syncProgress();
    await window.electron.X.setConfig(vm.account.id, failureStateKey, "false");
    return { isComplete: true, errorTriggered: false, shouldContinue: false };
  }

  // Not done yet, update and continue
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  await window.electron.X.updateJob(
    vm.account.id,
    JSON.stringify(vm.jobs[jobIndex]),
  );
  return { isComplete: false, errorTriggered: false, shouldContinue: true };
}

/**
 * Process a single iteration of the content indexing loop
 * @param vm - XViewModel instance
 * @param jobIndex - Current job index
 * @param config - Configuration object with keys for progress, errors, etc.
 * @returns {shouldContinue, errorTriggered}
 */
export async function indexContentProcessIteration(
  vm: XViewModel,
  jobIndex: number,
  config: {
    failureStateKey: string;
    parseErrorType: AutomationErrorType;
    verifyErrorType: AutomationErrorType;
    progressKey: string;
  },
): Promise<{ shouldContinue: boolean; errorTriggered: boolean }> {
  await vm.waitForPause();

  // Scroll to bottom
  await window.electron.X.resetRateLimitInfo(vm.account.id);
  let moreToScroll = await vm.scrollToBottom();

  // Check for rate limit
  vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
  if (vm.rateLimitInfo.isRateLimited) {
    const rateResult = await indexContentProcessRateLimit(
      vm,
      config.failureStateKey,
    );
    if (!rateResult.shouldContinue) {
      return { shouldContinue: false, errorTriggered: false };
    }
    moreToScroll = true;
    return { shouldContinue: true, errorTriggered: false };
  }

  // Parse content
  const parseResult = await indexContentParsePage(
    vm,
    jobIndex,
    config.parseErrorType,
  );
  if (!parseResult.success) {
    return { shouldContinue: false, errorTriggered: true };
  }

  // X also reports rate limits inside responses that look successful, which
  // the parser notices rather than the status code. Back off for those too.
  vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
  if (vm.rateLimitInfo.isRateLimited) {
    const rateResult = await indexContentProcessRateLimit(
      vm,
      config.failureStateKey,
    );
    if (!rateResult.shouldContinue) {
      return { shouldContinue: false, errorTriggered: false };
    }
    return { shouldContinue: true, errorTriggered: false };
  }

  // Check if we're done
  const completionResult = await indexContentCheckCompletion(
    vm,
    jobIndex,
    moreToScroll,
    config.progressKey,
    config.failureStateKey,
    config.verifyErrorType,
  );
  if (!completionResult.shouldContinue) {
    return {
      shouldContinue: false,
      errorTriggered: completionResult.errorTriggered,
    };
  }

  // Check for "Something went wrong" message
  await indexTweetsCheckForSomethingWrong(vm);

  return { shouldContinue: true, errorTriggered: false };
}
