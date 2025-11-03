import type { XViewModel } from "./view_model";
import { TimeoutError, URLChangedError } from "../BaseViewModel";
import {
  XArchiveStartResponse,
  XIndexMessagesStartResponse,
  XTweetItemArchive,
} from "../../../../shared_types";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import { FailureState } from "./types";

export async function indexTweetsHandleRateLimit(
  vm: XViewModel,
): Promise<boolean> {
  vm.log("indexTweetsHandleRateLimit", vm.progress);

  await vm.waitForPause();

  if (await vm.doesSelectorExist('section [data-testid="cellInnerDiv"]')) {
    vm.log("indexTweetsHandleRateLimit", "tweets have loaded");
    // Tweets have loaded. If there are tweets, the HTML looks like of like this:
    // <section>
    //     <div>
    //         <div>
    //             <div data-testid="cellInnerDiv"></div>
    //             <div data-testid="cellInnerDiv"></div>
    //             <div data-testid="cellInnerDiv>...</div>
    //                 <div>...</div>
    //                 <button>...</button>
    //             </div>
    //         </div>
    //     </div>
    // </section>

    // Check if we get more tweets by scrolling down, even without clicking any buttons
    let numberOfDivsBefore = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );
    await vm.sleep(2000);
    await vm.scrollUp(2000);
    await vm.sleep(2000);
    await vm.scrollToBottom();
    await vm.sleep(2000);
    let numberOfDivsAfter = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );
    if (numberOfDivsAfter > numberOfDivsBefore) {
      // More tweets loaded
      return true;
    }

    // If the retry button does not exist, try scrolling up and down again to trigger it
    // The retry button should be in the last cellInnerDiv, and it should have only 1 button in it
    if (
      (await vm.countSelectorsWithinElementLastFound(
        'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
        "button",
      )) != 1
    ) {
      await vm.scrollUp(2000);
      await vm.sleep(2000);
      await vm.scrollToBottom();
      await vm.sleep(2000);
      if (
        (await vm.countSelectorsWithinElementLastFound(
          'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
          "button",
        )) != 1
      ) {
        vm.log("indexTweetsHandleRateLimit", "retry button does not exist");
        return false;
      }
    }

    // Count divs before clicking retry button
    numberOfDivsBefore = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );
    if (numberOfDivsBefore > 0) {
      // The last one is the one with the button
      numberOfDivsBefore--;
    }

    // Click the retry button
    await vm.scriptClickElementWithinElementLast(
      'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
      "button",
    );
    await vm.sleep(2000);

    // Count divs after clicking retry button
    numberOfDivsAfter = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );

    // If there are more divs after, it means more tweets loaded
    return numberOfDivsAfter > numberOfDivsBefore;
  } else {
    vm.log("indexTweetsHandleRateLimit", "no tweets have loaded");
    // No tweets have loaded. If there are no tweets, the HTML looks kind of like this:
    // <main role="main">
    //     <div>
    //         <div>
    //             <div>
    //                 <div>
    //                     <div>
    //                         <nav role="navigation">
    //                         <div>
    //                             <div>...</div>
    //                             <button>...</button>
    //                         </div>
    //                     </div>
    //                 </div>
    //             </div>
    //         </div>
    //     </div>
    // </main>

    // Click retry button
    await vm.scriptClickElement(
      'main[role="main"] nav[role="navigation"] + div > button',
    );

    // Count divs after clicking retry button
    const numberOfDivsAfter = await vm.countSelectorsFound(
      "section div[data-testid=cellInnerDiv]",
    );

    // If there are more divs after, it means more tweets loaded
    return numberOfDivsAfter > 0;
  }
}

// Check if there is a "Something went wrong" message, and click retry if there is
export async function indexTweetsCheckForSomethingWrong(
  vm: XViewModel,
): Promise<void> {
  // X might show a "Something went wrong" message if an AJAX request fails for a reason other than
  // being rate limited. If this happens, we need to click the retry button to try again.
  if (
    (await vm.doesSelectorExist('section div[data-testid="cellInnerDiv"]')) &&
    // If the last cellInnerDiv has just one button, that should be the retry button
    (await vm.countSelectorsWithinElementLastFound(
      'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
      "button",
    )) == 1
  ) {
    // Click retry
    await vm.scriptClickElementWithinElementLast(
      'main[role="main"] nav[role="navigation"] + section div[data-testid=cellInnerDiv]',
      "button",
    );
    await vm.sleep(2000);
  }
}

// When we get to the bottom of a tweets or likes feed, verify that we're actually
// at the bottom. Do this by scrolling up, then down again, and making sure we still got the
// final API response.
// Returns true if we're actually at the bottom, false if we're not.
export async function indexTweetsVerifyThereIsNoMore(
  vm: XViewModel,
): Promise<boolean> {
  vm.log("indexTweetsVerifyThereIsNoMore", "verifying there is no more tweets");
  await vm.scrollToBottom();

  // Record the current number of tweets, retweets, and likes
  const currentTweetsIndexed = vm.progress.tweetsIndexed;
  const currentRetweetsIndexed = vm.progress.retweetsIndexed;
  const currentLikesIndexed = vm.progress.likesIndexed;
  const currentUnknownIndex = vm.progress.unknownIndexed;

  // Reset the thereIsMore flag
  await window.electron.X.resetThereIsMore(vm.account.id);

  // Try to trigger more API requests by scrolling up and down
  await vm.sleep(500);
  await vm.scrollUp(2000);
  await vm.sleep(1500);
  await vm.scrollToBottom();
  await vm.sleep(1500);

  // Parse so far
  vm.progress = await window.electron.X.indexParseTweets(vm.account.id);
  vm.log("indexTweetsVerifyThereIsNoMore", ["parsed tweets", vm.progress]);

  // Check if we're done again
  if (!(await window.electron.X.indexIsThereMore(vm.account.id))) {
    vm.log(
      "indexTweetsVerifyThereIsNoMore",
      "got the final API response again, so we are done",
    );
    return true;
  }

  // It's also possible that the final API response did not load, in which case we can see if the
  // progress was updated. If it was not, we're done.
  if (
    vm.progress.tweetsIndexed == currentTweetsIndexed &&
    vm.progress.retweetsIndexed == currentRetweetsIndexed &&
    vm.progress.likesIndexed == currentLikesIndexed &&
    vm.progress.unknownIndexed == currentUnknownIndex
  ) {
    vm.log(
      "indexTweetsVerifyThereIsNoMore",
      "the progress was not updated, we are done",
    );
    return true;
  }

  vm.log(
    "indexTweetsVerifyThereIsNoMore",
    "we are not done, good thing we checked",
  );
  return false;
}

export async function archiveSaveTweet(
  vm: XViewModel,
  outputPath: string,
  tweetItem: XTweetItemArchive,
): Promise<boolean> {
  vm.log("archiveSaveTweet", `Archiving ${tweetItem.basename}`);

  // Check if the tweet is already archived
  if (
    await window.electron.archive.isPageAlreadySaved(
      outputPath,
      tweetItem.basename,
    )
  ) {
    vm.log("archiveSaveTweet", `Already archived ${tweetItem.basename}`);
    await window.electron.X.archiveTweetCheckDate(
      vm.account.id,
      tweetItem.tweetID,
    );
    vm.progress.tweetsArchived += 1;
    return true;
  }

  // Load the URL
  await vm.loadURLWithRateLimit(tweetItem.url);

  // Check if tweet is already deleted
  let alreadyDeleted = false;
  await vm.sleep(200);
  if (
    await vm.doesSelectorExist(
      'div[data-testid="primaryColumn"] div[data-testid="error-detail"]',
    )
  ) {
    vm.log("archiveSaveTweet", "tweet is already deleted");
    alreadyDeleted = true;
  }

  // Wait for the tweet to appear
  if (!alreadyDeleted) {
    try {
      await vm.waitForSelector('article[tabindex="-1"]', tweetItem.url, 10000);
      // Wait another second for replies, etc. to load
      await vm.sleep(1000);
    } catch (e) {
      vm.log("archiveSaveTweet", [
        "selector never appeared, but saving anyway",
        e,
      ]);
    }
  }

  // Save the page
  if (vm.webContentsID) {
    await window.electron.archive.savePage(
      vm.webContentsID,
      outputPath,
      tweetItem.basename,
    );
  } else {
    vm.error(
      AutomationErrorType.x_runJob_archiveTweets_FailedToArchive,
      {
        message: "webContentsID is null",
      },
      {
        currentURL: vm.webview?.getURL(),
      },
      true,
    );
    return false;
  }

  // Update tweet's archivedAt date
  try {
    await window.electron.X.archiveTweet(vm.account.id, tweetItem.tweetID);
  } catch (e) {
    await vm.error(
      AutomationErrorType.x_runJob_archiveTweets_FailedToArchive,
      {
        error: formatError(e as Error),
      },
      {
        tweetItem: tweetItem,
        currentURL: vm.webview?.getURL(),
      },
      true,
    );
    return false;
  }

  // Update progress
  vm.progress.tweetsArchived += 1;
  vm.progress.newTweetsArchived += 1;
  return true;
}

// ============================================================================
// Shared helpers for indexing content (tweets, likes, bookmarks)
// ============================================================================

/**
 * Check if the content list is empty
 * @param vm - XViewModel instance
 * @param emptySelector - Selector to check for empty state
 * @param articleSelector - Selector for article elements
 * @param progressKey - Key to update in progress (e.g., 'isIndexTweetsFinished')
 * @param countKey - Key to update count in progress (e.g., 'tweetsIndexed')
 * @returns true if empty, false otherwise
 */
export async function indexContentCheckIfEmpty(
  vm: XViewModel,
  emptySelector: string | null,
  articleSelector: string,
  progressKey: string,
  countKey: string,
): Promise<boolean> {
  // Check for explicit empty state selector
  if (emptySelector && (await vm.doesSelectorExist(emptySelector))) {
    vm.log("indexContentCheckIfEmpty", `found empty state: ${emptySelector}`);
    (vm.progress as Record<string, unknown>)[progressKey] = true;
    (vm.progress as Record<string, unknown>)[countKey] = 0;
    await vm.syncProgress();
    return true;
  }

  // Check if there's a section but no articles
  if (await vm.doesSelectorExist("section")) {
    if ((await vm.countSelectorsFound(articleSelector)) == 0) {
      vm.log("indexContentCheckIfEmpty", `no content found`);
      (vm.progress as Record<string, unknown>)[progressKey] = true;
      (vm.progress as Record<string, unknown>)[countKey] = 0;
      await vm.syncProgress();
      return true;
    }
  }

  return false;
}

/**
 * Wait for initial content to load
 * @param vm - XViewModel instance
 * @param selector - Selector to wait for
 * @param url - URL being loaded
 * @param progressKey - Key to update in progress
 * @param countKey - Key to update count in progress
 * @param errorTypeURLChanged - Error type for URL changed
 * @param errorTypeOther - Error type for other errors
 * @returns {success, errorTriggered}
 */
export async function indexContentWaitForInitialLoad(
  vm: XViewModel,
  selector: string,
  url: string,
  progressKey: string,
  countKey: string,
  errorTypeURLChanged: AutomationErrorType,
  errorTypeOther: AutomationErrorType,
): Promise<{ success: boolean; errorTriggered: boolean }> {
  try {
    await vm.waitForSelector(selector, url);
    return { success: true, errorTriggered: false };
  } catch (e) {
    vm.log("indexContentWaitForInitialLoad", [`selector never appeared`, e]);
    if (e instanceof TimeoutError) {
      // Were we rate limited?
      vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
      if (vm.rateLimitInfo.isRateLimited) {
        await vm.waitForRateLimit();
      } else {
        // If the page isn't loading, assume there's no content yet
        await vm.waitForLoadingToFinish();
        (vm.progress as Record<string, unknown>)[progressKey] = true;
        (vm.progress as Record<string, unknown>)[countKey] = 0;
        await vm.syncProgress();
      }
      return { success: false, errorTriggered: false };
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
      return { success: false, errorTriggered: true };
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
      return { success: false, errorTriggered: true };
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

export async function runJobIndexTweets(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_INDEX_TWEETS,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = `# I'm saving your tweets.

Hang on while I scroll down to your earliest tweets.`;
  vm.showAutomationNotice = true;

  // Start monitoring network requests
  await vm.loadBlank();
  await window.electron.X.indexStart(vm.account.id);
  await vm.sleep(2000);

  // Start the progress
  vm.progress.isIndexTweetsFinished = false;
  vm.progress.tweetsIndexed = 0;
  await vm.syncProgress();
  await window.electron.X.resetRateLimitInfo(vm.account.id);

  // Load the timeline
  const username = vm.account.xAccount?.username || "";
  const url = `https://x.com/${username}/with_replies`;
  await vm.loadURLWithRateLimit(url);
  await vm.sleep(500);

  // Check if tweets list is empty
  if (
    await indexContentCheckIfEmpty(
      vm,
      null,
      "section article",
      "isIndexTweetsFinished",
      "tweetsIndexed",
    )
  ) {
    await window.electron.X.indexStop(vm.account.id);
    await vm.finishJob(jobIndex);
    return true;
  }

  // Wait for tweets to appear
  if (!vm.progress.isIndexTweetsFinished) {
    const loadResult = await indexContentWaitForInitialLoad(
      vm,
      "article",
      url,
      "isIndexTweetsFinished",
      "tweetsIndexed",
      AutomationErrorType.x_runJob_indexTweets_URLChanged,
      AutomationErrorType.x_runJob_indexTweets_OtherError,
    );

    if (loadResult.errorTriggered) {
      await window.electron.X.indexStop(vm.account.id);
      return false;
    }

    if (!loadResult.success) {
      await window.electron.X.indexStop(vm.account.id);
      await vm.finishJob(jobIndex);
      return true;
    }
  }

  // Main indexing loop
  let errorTriggered = false;
  while (vm.progress.isIndexTweetsFinished === false) {
    const iterationResult = await indexContentProcessIteration(vm, jobIndex, {
      failureStateKey: FailureState.indexTweets_FailedToRetryAfterRateLimit,
      parseErrorType: AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
      verifyErrorType:
        AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
      progressKey: "isIndexTweetsFinished",
    });

    if (!iterationResult.shouldContinue) {
      errorTriggered = iterationResult.errorTriggered;
      break;
    }
  }

  // Stop monitoring network requests
  await window.electron.X.indexStop(vm.account.id);

  if (errorTriggered) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobArchiveTweets(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_ARCHIVE_TWEETS,
    navigator.userAgent,
  );

  let archiveStartResponse: XArchiveStartResponse;

  vm.showBrowser = true;
  vm.instructions = `# I'm downloading HTML copies of your tweets, starting with the oldest.

This may take a while...`;
  vm.showAutomationNotice = true;

  // Initialize archiving of tweets
  try {
    archiveStartResponse = await window.electron.X.archiveTweetsStart(
      vm.account.id,
    );
  } catch (e) {
    await vm.error(AutomationErrorType.x_runJob_archiveTweets_FailedToStart, {
      error: formatError(e as Error),
    });
    return false;
  }
  vm.log("runJob", [
    "jobType=archiveTweets",
    "archiveStartResponse",
    archiveStartResponse,
  ]);

  // Start the progress
  vm.progress.totalTweetsToArchive = archiveStartResponse.items.length;
  vm.progress.tweetsArchived = 0;
  vm.progress.newTweetsArchived = 0;

  // Archive the tweets
  for (let i = 0; i < archiveStartResponse.items.length; i++) {
    await vm.waitForPause();

    // Save the tweet
    if (
      !(await archiveSaveTweet(
        vm,
        archiveStartResponse.outputPath,
        archiveStartResponse.items[i],
      ))
    ) {
      vm.log("runJobArchiveTweets", [
        "failed to save tweet",
        archiveStartResponse.items[i].tweetID,
      ]);
    }
  }

  await vm.syncProgress();
  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobIndexConversations(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_INDEX_CONVERSATIONS,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = `# I'm saving your direct message conversations.

Hang on while I scroll down to your earliest direct message conversations...`;
  vm.showAutomationNotice = true;

  // Start monitoring network requests
  await vm.loadBlank();
  await window.electron.X.indexStart(vm.account.id);
  await vm.sleep(2000);

  let errorTriggered = false;
  while (true) {
    await vm.waitForPause();
    await window.electron.X.resetRateLimitInfo(vm.account.id);

    // Load the messages page
    await vm.loadURLWithRateLimit("https://x.com/messages");
    vm.log(
      "runJobIndexConversations",
      "loaded messages page, waiting for conversations to load",
    );

    // Just for good measure, scroll down, wait, and scroll back up, to encourage the web page to load conversations
    await vm.sleep(1000);
    await vm.scrollToBottom();
    await vm.sleep(1000);
    await vm.scrollUp(2000);
    await vm.sleep(1000);

    // If the conversations list is empty, there is no search text field
    try {
      // Wait for the search text field to appear with a 30 second timeout
      await vm.waitForSelector(
        'section input[type="text"]',
        "https://x.com/messages",
        30000,
      );
    } catch (e) {
      // There are no conversations
      vm.log("runJobIndexConversations", ["no conversations found", e]);
      await vm.waitForLoadingToFinish();
      vm.progress.isIndexConversationsFinished = true;
      vm.progress.conversationsIndexed = 0;
      await vm.syncProgress();
      break;
    }

    // Wait for conversations to appear
    try {
      await vm.waitForSelector(
        'section div div[role="tablist"] div[data-testid="cellInnerDiv"]',
        "https://x.com/messages",
      );
      break;
    } catch (e) {
      vm.log("runJobIndexConversations", ["selector never appeared", e]);
      if (e instanceof TimeoutError) {
        // Were we rate limited?
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
        } else {
          // Assume that there are no conversations
          await vm.waitForLoadingToFinish();
          vm.progress.isIndexConversationsFinished = true;
          vm.progress.conversationsIndexed = 0;
          await vm.syncProgress();
          break;
        }
      } else if (e instanceof URLChangedError) {
        const newURL = vm.webview?.getURL();
        await vm.error(
          AutomationErrorType.x_runJob_indexConversations_URLChanged,
          {
            newURL: newURL,
            error: formatError(e as Error),
            currentURL: vm.webview?.getURL(),
          },
        );
        errorTriggered = true;
      } else {
        await vm.error(
          AutomationErrorType.x_runJob_indexConversations_OtherError,
          {
            error: formatError(e as Error),
            currentURL: vm.webview?.getURL(),
          },
        );
        errorTriggered = true;
      }
    }
  }

  if (errorTriggered) {
    return false;
  }

  while (vm.progress.isIndexConversationsFinished === false) {
    await vm.waitForPause();

    // Scroll to bottom
    await window.electron.X.resetRateLimitInfo(vm.account.id);
    const moreToScroll = await vm.scrollToBottom();
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
    }

    // Parse so far
    try {
      vm.progress = await window.electron.X.indexParseConversations(
        vm.account.id,
      );
    } catch (e) {
      const latestResponseData = await window.electron.X.getLatestResponseData(
        vm.account.id,
      );
      await vm.error(
        AutomationErrorType.x_runJob_indexConversations_ParseConversationsError,
        {
          error: formatError(e as Error),
        },
        {
          latestResponseData: latestResponseData,
        },
      );
      errorTriggered = true;
      break;
    }
    vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
    await window.electron.X.updateJob(
      vm.account.id,
      JSON.stringify(vm.jobs[jobIndex]),
    );

    // Check if we're done
    if (!(await window.electron.X.indexIsThereMore(vm.account.id))) {
      vm.progress.isIndexConversationsFinished = true;
      await vm.syncProgress();
      break;
    } else {
      if (!moreToScroll) {
        vm.log(
          "runJobIndexConversations",
          "we scrolled to the bottom but we're not finished, so scroll up a bit to trigger infinite scroll next time",
        );
        // We scrolled to the bottom but we're not finished, so scroll up a bit to trigger infinite scroll next time
        await vm.sleep(500);
        await vm.scrollUp(1000);
      }
    }
  }

  // Stop monitoring network requests
  await window.electron.X.indexStop(vm.account.id);

  if (errorTriggered) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobIndexMessages(vm: XViewModel, jobIndex: number) {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_INDEX_MESSAGES,
    navigator.userAgent,
  );

  let tries: number,
    success: boolean,
    error: null | Error = null;

  let indexMessagesStartResponse: XIndexMessagesStartResponse;
  let url = "";

  vm.showBrowser = true;
  vm.instructions = `# I'm saving your direct messages.

Please wait while I index all the messages from each conversation...`;
  vm.showAutomationNotice = true;

  // Start monitoring network requests
  await vm.loadBlank();
  await window.electron.X.indexStart(vm.account.id);
  await vm.sleep(2000);

  // Load the conversations
  try {
    indexMessagesStartResponse = await window.electron.X.indexMessagesStart(
      vm.account.id,
    );
  } catch (e) {
    await vm.error(AutomationErrorType.x_runJob_indexMessages_FailedToStart, {
      error: formatError(e as Error),
    });
    return false;
  }
  vm.log("runJobIndexMessages", [
    "indexMessagesStartResponse",
    indexMessagesStartResponse,
  ]);

  // Start the progress
  vm.progress.totalConversations =
    indexMessagesStartResponse?.totalConversations;
  vm.progress.conversationMessagesIndexed =
    vm.progress.totalConversations -
    indexMessagesStartResponse?.conversationIDs.length;
  await vm.syncProgress();

  for (let i = 0; i < indexMessagesStartResponse.conversationIDs.length; i++) {
    await vm.waitForPause();

    // Load the URL
    success = false;
    let shouldSkip = false;
    for (tries = 0; tries < 3; tries++) {
      await vm.waitForPause();

      // Load URL and wait for messages to appear
      try {
        url = `https://x.com/messages/${indexMessagesStartResponse.conversationIDs[i]}`;
        await vm.loadURLWithRateLimit(url);
        await vm.waitForSelector('div[data-testid="DmActivityContainer"]', url);
        success = true;
        break;
      } catch (e) {
        vm.log("runJobIndexMessages", ["selector never appeared", e]);
        if (e instanceof TimeoutError) {
          // Were we rate limited?
          vm.rateLimitInfo = await window.electron.X.isRateLimited(
            vm.account.id,
          );
          if (vm.rateLimitInfo.isRateLimited) {
            await vm.waitForRateLimit();
          } else {
            error = e;
            vm.log("runJobIndexMessages", [
              "loading conversation and waiting for messages failed, try #",
              tries,
            ]);
            await vm.sleep(1000);
          }
        } else if (e instanceof URLChangedError) {
          // If the URL changes (like to https://x.com/i/verified-get-verified), skip it
          vm.log("runJobIndexMessages", [
            "conversation is inaccessible, so skipping it",
          ]);
          vm.progress.conversationMessagesIndexed += 1;
          await vm.syncProgress();
          shouldSkip = true;
          success = true;

          // Mark the conversation's shouldIndexMessages to false
          await window.electron.X.indexConversationFinished(
            vm.account.id,
            indexMessagesStartResponse.conversationIDs[i],
          );
          break;
        } else {
          error = e as Error;
          vm.log("runJobIndexMessages", [
            "loading conversation and waiting for messages failed, try #",
            tries,
          ]);
          await vm.sleep(1000);
        }
      }
    }

    if (!success) {
      await vm.error(AutomationErrorType.x_runJob_indexMessages_Timeout, {
        error: formatError(error as Error),
      });
    }

    if (shouldSkip) {
      continue;
    }

    await vm.sleep(500);
    await vm.waitForLoadingToFinish();

    while (vm.progress.isIndexMessagesFinished === false) {
      await vm.waitForPause();

      // Scroll to top
      await window.electron.X.resetRateLimitInfo(vm.account.id);
      let moreToScroll = await vm.scrollToTop(
        'div[data-testid="DmActivityViewport"]',
      );
      vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
      if (vm.rateLimitInfo.isRateLimited) {
        await vm.waitForRateLimit();
        moreToScroll = true;
      }

      // Parse so far
      try {
        vm.progress = await window.electron.X.indexParseMessages(vm.account.id);
      } catch (e) {
        const latestResponseData =
          await window.electron.X.getLatestResponseData(vm.account.id);
        await vm.error(
          AutomationErrorType.x_runJob_indexMessages_ParseMessagesError,
          {
            error: formatError(e as Error),
          },
          {
            latestResponseData: latestResponseData,
            currentURL: vm.webview?.getURL(),
          },
          true,
        );
        break;
      }
      vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
      await window.electron.X.updateJob(
        vm.account.id,
        JSON.stringify(vm.jobs[jobIndex]),
      );

      // Check if we're done
      if (!moreToScroll) {
        vm.progress.conversationMessagesIndexed += 1;
        await vm.syncProgress();
        break;
      }
    }

    // Mark the conversation's shouldIndexMessages to false
    await window.electron.X.indexConversationFinished(
      vm.account.id,
      indexMessagesStartResponse.conversationIDs[i],
    );
  }

  // Stop monitoring network requests
  await window.electron.X.indexStop(vm.account.id);

  await vm.finishJob(jobIndex);
}

export async function runJobIndexLikes(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_INDEX_LIKES,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = `# I'm saving your likes.

Hang on while I scroll down to your earliest likes.`;
  vm.showAutomationNotice = true;

  // Start monitoring network requests
  await vm.loadBlank();
  await window.electron.X.indexStart(vm.account.id);
  await vm.sleep(2000);

  // Start the progress
  vm.progress.isIndexLikesFinished = false;
  vm.progress.likesIndexed = 0;
  await vm.syncProgress();

  // Load the likes
  await vm.waitForPause();
  await window.electron.X.resetRateLimitInfo(vm.account.id);
  const username = vm.account.xAccount?.username || "";
  const url = `https://x.com/${username}/likes`;
  await vm.loadURLWithRateLimit(url);
  await vm.sleep(500);

  // Check if likes list is empty
  if (
    await indexContentCheckIfEmpty(
      vm,
      'div[data-testid="emptyState"]',
      "article",
      "isIndexLikesFinished",
      "likesIndexed",
    )
  ) {
    await window.electron.X.indexStop(vm.account.id);
    await vm.finishJob(jobIndex);
    return true;
  }

  // Wait for likes to appear
  if (!vm.progress.isIndexLikesFinished) {
    const loadResult = await indexContentWaitForInitialLoad(
      vm,
      "article",
      url,
      "isIndexLikesFinished",
      "likesIndexed",
      AutomationErrorType.x_runJob_indexLikes_URLChanged,
      AutomationErrorType.x_runJob_indexLikes_OtherError,
    );

    if (loadResult.errorTriggered) {
      await window.electron.X.indexStop(vm.account.id);
      return false;
    }

    if (!loadResult.success) {
      await window.electron.X.indexStop(vm.account.id);
      await vm.finishJob(jobIndex);
      return true;
    }
  }

  // Main indexing loop
  let errorTriggered = false;
  while (vm.progress.isIndexLikesFinished === false) {
    const iterationResult = await indexContentProcessIteration(vm, jobIndex, {
      failureStateKey: FailureState.indexLikes_FailedToRetryAfterRateLimit,
      parseErrorType: AutomationErrorType.x_runJob_indexLikes_ParseTweetsError,
      verifyErrorType:
        AutomationErrorType.x_runJob_indexLikes_VerifyThereIsNoMoreError,
      progressKey: "isIndexLikesFinished",
    });

    if (!iterationResult.shouldContinue) {
      errorTriggered = iterationResult.errorTriggered;
      break;
    }
  }

  // Stop monitoring network requests
  await window.electron.X.indexStop(vm.account.id);

  if (errorTriggered) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobIndexBookmarks(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_INDEX_BOOKMARKS,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = `# I'm saving your bookmarks.

Hang on while I scroll down to your earliest bookmarks.`;
  vm.showAutomationNotice = true;

  // Start monitoring network requests
  await vm.loadBlank();
  await window.electron.X.indexStart(vm.account.id);
  await vm.sleep(2000);

  // Start the progress
  vm.progress.isIndexBookmarksFinished = false;
  vm.progress.bookmarksIndexed = 0;
  await vm.syncProgress();

  // Load the bookmarks
  await vm.waitForPause();
  await window.electron.X.resetRateLimitInfo(vm.account.id);
  const url = "https://x.com/i/bookmarks";
  await vm.loadURLWithRateLimit(url);
  await vm.sleep(500);

  // Check if bookmarks list is empty
  if (
    await indexContentCheckIfEmpty(
      vm,
      'div[data-testid="emptyState"]',
      "article",
      "isIndexBookmarksFinished",
      "bookmarksIndexed",
    )
  ) {
    await window.electron.X.indexStop(vm.account.id);
    await vm.finishJob(jobIndex);
    return true;
  }

  // Wait for bookmarks to appear
  if (!vm.progress.isIndexBookmarksFinished) {
    const loadResult = await indexContentWaitForInitialLoad(
      vm,
      "article",
      url,
      "isIndexBookmarksFinished",
      "bookmarksIndexed",
      AutomationErrorType.x_runJob_indexBookmarks_URLChanged,
      AutomationErrorType.x_runJob_indexBookmarks_OtherError,
    );

    if (loadResult.errorTriggered) {
      await window.electron.X.indexStop(vm.account.id);
      return false;
    }

    if (!loadResult.success) {
      await window.electron.X.indexStop(vm.account.id);
      await vm.finishJob(jobIndex);
      return true;
    }
  }

  // Main indexing loop
  let errorTriggered = false;
  while (vm.progress.isIndexBookmarksFinished === false) {
    const iterationResult = await indexContentProcessIteration(vm, jobIndex, {
      failureStateKey: FailureState.indexBookmarks_FailedToRetryAfterRateLimit,
      parseErrorType:
        AutomationErrorType.x_runJob_indexBookmarks_ParseTweetsError,
      verifyErrorType:
        AutomationErrorType.x_runJob_indexBookmarks_VerifyThereIsNoMoreError,
      progressKey: "isIndexBookmarksFinished",
    });

    if (!iterationResult.shouldContinue) {
      errorTriggered = iterationResult.errorTriggered;
      break;
    }
  }

  // Stop monitoring network requests
  await window.electron.X.indexStop(vm.account.id);

  if (errorTriggered) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}
