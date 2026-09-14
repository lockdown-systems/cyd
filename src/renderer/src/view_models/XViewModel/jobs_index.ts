import type { XViewModel } from "./view_model";
import { XArchiveStartResponse } from "../../../../shared_types";
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
  await vm.sleep(2000);

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
  await vm.sleep(2000);

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
  await vm.sleep(2000);

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
