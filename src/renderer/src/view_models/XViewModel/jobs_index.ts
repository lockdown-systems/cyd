import type { XViewModel } from "./view_model";
import { TimeoutError, URLChangedError } from "../BaseViewModel";
import {
  XArchiveStartResponse,
  XIndexMessagesStartResponse,
} from "../../../../shared_types";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import { FailureState } from "./types";
import { archiveSaveTweet } from "./jobs_index/helpers_archive";
import {
  indexContentCheckIfEmpty,
  indexContentWaitForInitialLoad,
  indexContentProcessIteration,
} from "./jobs_index/helpers_shared";

// All helper functions have been moved to separate files in ./jobs_index/
// - helpers_tweets.ts: Tweet-specific helpers
// - helpers_archive.ts: Archive helper
// - helpers_shared.ts: Shared indexing helpers

export async function runJobIndexTweets(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_INDEX_TWEETS,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = vm.t("viewModels.x.jobs.index.tweets");
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
  vm.instructions = vm.t("viewModels.x.jobs.index.archiveTweets");
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
  vm.instructions = vm.t("viewModels.x.jobs.index.conversations");
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

  let tries: number, success: boolean;

  let indexMessagesStartResponse: XIndexMessagesStartResponse;
  let url = "";

  vm.showBrowser = true;
  vm.instructions = vm.t("viewModels.x.jobs.index.messages");
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
        // Use longer timeout on retries (60 seconds instead of default 30 seconds)
        const timeout = tries > 0 ? 60000 : undefined;
        await vm.waitForSelector(
          'div[data-testid="DmActivityContainer"]',
          url,
          timeout,
        );
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
          vm.log("runJobIndexMessages", [
            "loading conversation and waiting for messages failed, try #",
            tries,
          ]);
          await vm.sleep(1000);
        }
      }
    }

    if (!success) {
      // Instead of submitting an error report, show a user-friendly message
      // and skip this conversation for now.
      await window.electron.showError(
        vm.t("viewModels.x.jobs.index.messagesTimeoutError"),
      );
      vm.log("runJobIndexMessages", [
        "conversation timed out after 3 retries, skipping it",
      ]);
      vm.progress.conversationMessagesIndexed += 1;
      await vm.syncProgress();
      shouldSkip = true;
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
  vm.instructions = vm.t("viewModels.x.jobs.index.likes");
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
  vm.instructions = vm.t("viewModels.x.jobs.index.bookmarks");
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
