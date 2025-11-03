import type { XViewModel } from "./view_model";
import { TimeoutError, URLChangedError } from "../BaseViewModel";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import { RunJobsState } from "./types";
import {
  deleteContentGetCookie,
  deleteContentRetryLoop,
  deleteContentUpdateDatabase,
  deleteContentHandleFailure,
  deleteTweetsLoadList,
  deleteTweetItem,
  deleteRetweetItem,
  deleteLikeItem,
  deleteBookmarkItem,
  deleteDMsProcessIteration,
  unfollowEveryoneProcessIteration,
} from "./jobs_delete/index";

export async function deleteDMsLoadDMsPage(vm: XViewModel): Promise<boolean> {
  vm.log("deleteDMsLoadDMsPage", "loading DMs page");
  let tries: number, success: boolean;
  let error: Error | null = null;
  let errorType: AutomationErrorType =
    AutomationErrorType.x_runJob_deleteDMs_OtherError;
  let newURL: string = "";

  success = false;
  for (tries = 0; tries < 3; tries++) {
    await vm.loadURLWithRateLimit("https://x.com/messages");

    // If the conversations list is empty, there is no search text field
    try {
      // Wait for the search text field to appear with a 30 second timeout
      await vm.waitForSelector(
        'section input[type="text"]',
        "https://x.com/messages",
        30000,
      );
    } catch (e) {
      vm.log("deleteDMsLoadDMsPage", ["selector never appeared", e]);
      // There are no conversations
      await vm.waitForLoadingToFinish();
      vm.progress.isDeleteDMsFinished = true;
      await vm.syncProgress();
      return false;
    }

    try {
      await window.electron.X.resetRateLimitInfo(vm.account.id);
      vm.log(
        "deleteDMsLoadDMsPage",
        "waiting for selector after loading messages page",
      );
      await vm.waitForSelector(
        'section div div[role="tablist"] div[data-testid="cellInnerDiv"]',
        "https://x.com/messages",
      );
      success = true;
      break;
    } catch (e) {
      vm.log("deleteDMsLoadDMsPage", ["selector never appeared", e]);
      if (e instanceof TimeoutError) {
        // Were we rate limited?
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
        } else {
          // Assume that there are no conversations
          await vm.waitForLoadingToFinish();
          vm.progress.isDeleteDMsFinished = true;
          await vm.syncProgress();
          return false;
        }
      } else if (e instanceof URLChangedError) {
        newURL = vm.webview?.getURL() || "";
        error = e;
        errorType = AutomationErrorType.x_runJob_deleteDMs_URLChanged;
        vm.log("deleteDMsLoadDMsPage", ["URL changed", newURL]);
        await vm.sleep(1000);
        continue;
      } else {
        error = e as Error;
        vm.log("deleteDMsLoadDMsPage", ["other error", e]);
        await vm.sleep(1000);
        continue;
      }
    }
  }

  if (!success) {
    await vm.error(errorType, {
      error: formatError(error as Error),
      currentURL: vm.webview?.getURL(),
      newURL: newURL,
    });
    return true;
  }

  return false;
}

// Load the following page, and return true if an error was triggered
export async function unfollowEveryoneLoadPage(
  vm: XViewModel,
): Promise<boolean> {
  vm.log("unfollowEveryoneLoadPage", "loading following page");
  let tries: number, success: boolean;
  let error: Error | null = null;
  let errorType: AutomationErrorType =
    AutomationErrorType.x_runJob_unfollowEveryone_OtherError;
  let newURL: string = "";

  const followingURL = `https://x.com/${vm.account.xAccount?.username}/following`;

  success = false;
  for (tries = 0; tries < 3; tries++) {
    await vm.loadURLWithRateLimit(followingURL);

    // If no following users appear in two seconds, there are no following users
    try {
      await vm.waitForSelector(
        'div[data-testid="cellInnerDiv"] button button',
        followingURL,
        2000,
      );
    } catch (e) {
      if (e instanceof TimeoutError) {
        // Were we rate limited?
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
        } else {
          // There are no following users
          await vm.waitForLoadingToFinish();
          vm.progress.isUnfollowEveryoneFinished = true;
          await vm.syncProgress();
          return false;
        }
      } else if (e instanceof URLChangedError) {
        newURL = vm.webview?.getURL() || "";
        error = e;
        errorType = AutomationErrorType.x_runJob_deleteDMs_URLChanged;
        vm.log("unfollowEveryoneLoadPage", ["URL changed", newURL]);
        await vm.sleep(1000);
        continue;
      } else {
        error = e as Error;
        vm.log("unfollowEveryoneLoadPage", ["other error", e]);
        await vm.sleep(1000);
        continue;
      }
    }

    success = true;
    break;
  }

  if (!success) {
    await vm.error(errorType, {
      error: formatError(error as Error),
      currentURL: vm.webview?.getURL(),
      newURL: newURL,
    });
    return true;
  }

  return false;
}

export async function runJobDeleteTweets(
  vm: XViewModel,
  jobIndex: number,
): Promise<void> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_DELETE_TWEETS,
    navigator.userAgent,
  );

  // After this job, we want to reload the user stats
  await window.electron.X.setConfig(vm.account.id, "reloadUserStats", "true");

  vm.runJobsState = RunJobsState.DeleteTweets;
  vm.instructions = `# I'm deleting your tweets based on your criteria, starting with the earliest.`;

  // Load the tweets to delete
  const tweetsToDelete = await deleteTweetsLoadList(
    vm,
    window.electron.X.deleteTweetsStart,
    AutomationErrorType.x_runJob_deleteTweets_FailedToStart,
  );

  if (!tweetsToDelete) {
    return;
  }

  // Start the progress
  vm.progress.totalTweetsToDelete = tweetsToDelete.tweets.length;
  vm.progress.tweetsDeleted = 0;
  vm.progress.tweetsArchived = 0;
  vm.progress.newTweetsArchived = 0;
  await vm.syncProgress();

  // Load the replies page
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit(
    `https://x.com/${vm.account.xAccount?.username}/with_replies`,
  );

  // Hide the browser and start showing other progress instead
  vm.showBrowser = false;

  // Get the ct0 cookie
  const ct0 = await deleteContentGetCookie(
    vm,
    AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
  );

  if (!ct0) {
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the tweet with retry logic
    const { success, statusCode } = await deleteContentRetryLoop(vm, () =>
      deleteTweetItem(
        vm,
        ct0,
        tweetsToDelete.tweets[i].id,
        vm.account.xAccount?.username || "",
      ),
    );

    if (success) {
      // Update the tweet's deletedAt date
      const updated = await deleteContentUpdateDatabase(
        vm,
        () =>
          window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "tweet",
          ),
        AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp,
        tweetsToDelete.tweets[i],
        i,
      );

      if (updated) {
        vm.progress.tweetsDeleted += 1;
        await vm.syncProgress();
      }
    } else {
      // Failed to delete
      await deleteContentHandleFailure(
        vm,
        AutomationErrorType.x_runJob_deleteTweets_FailedToDelete,
        statusCode,
        tweetsToDelete.tweets[i],
        i,
      );
    }

    await vm.waitForPause();
  }

  await vm.finishJob(jobIndex);
}

export async function runJobDeleteRetweets(
  vm: XViewModel,
  jobIndex: number,
): Promise<void> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_DELETE_RETWEETS,
    navigator.userAgent,
  );

  // After this job, we want to reload the user stats
  await window.electron.X.setConfig(vm.account.id, "reloadUserStats", "true");

  vm.runJobsState = RunJobsState.DeleteRetweets;
  vm.instructions = `# I'm deleting your retweets, starting with the earliest.`;

  // Load the retweets to delete
  const tweetsToDelete = await deleteTweetsLoadList(
    vm,
    window.electron.X.deleteRetweetsStart,
    AutomationErrorType.x_runJob_deleteRetweets_FailedToStart,
  );

  if (!tweetsToDelete) {
    return;
  }

  // Start the progress
  vm.progress.totalRetweetsToDelete = tweetsToDelete.tweets.length;
  vm.progress.retweetsDeleted = 0;
  await vm.syncProgress();

  // Load the tweets page
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit(
    `https://x.com/${vm.account.xAccount?.username}`,
  );

  // Hide the browser and start showing other progress instead
  vm.showBrowser = false;

  // Get the ct0 cookie
  const ct0 = await deleteContentGetCookie(
    vm,
    AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
  );

  if (!ct0) {
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the retweet with retry logic
    const { success, statusCode } = await deleteContentRetryLoop(vm, () =>
      deleteRetweetItem(
        vm,
        ct0,
        tweetsToDelete.tweets[i].id,
        vm.account.xAccount?.username || "",
      ),
    );

    if (success) {
      vm.log("runJobDeleteRetweets", [
        "deleted retweet",
        tweetsToDelete.tweets[i].id,
      ]);

      // Update the tweet's deletedAt date
      const updated = await deleteContentUpdateDatabase(
        vm,
        () =>
          window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "retweet",
          ),
        AutomationErrorType.x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp,
        tweetsToDelete.tweets[i],
        i,
      );

      if (updated) {
        vm.progress.retweetsDeleted += 1;
        await vm.syncProgress();
      }
    } else {
      // Failed to delete
      await deleteContentHandleFailure(
        vm,
        AutomationErrorType.x_runJob_deleteRetweets_FailedToDelete,
        statusCode,
        tweetsToDelete.tweets[i],
        i,
      );
    }

    await vm.waitForPause();
  }

  await vm.finishJob(jobIndex);
}

export async function runJobDeleteLikes(
  vm: XViewModel,
  jobIndex: number,
): Promise<void> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_DELETE_LIKES,
    navigator.userAgent,
  );

  // After this job, we want to reload the user stats
  await window.electron.X.setConfig(vm.account.id, "reloadUserStats", "true");

  vm.runJobsState = RunJobsState.DeleteLikes;
  vm.instructions = `# I'm deleting your likes, starting with the earliest.`;

  // Load the likes to delete
  const tweetsToDelete = await deleteTweetsLoadList(
    vm,
    window.electron.X.deleteLikesStart,
    AutomationErrorType.x_runJob_deleteLikes_FailedToStart,
  );

  if (!tweetsToDelete) {
    return;
  }

  // Start the progress
  vm.progress.totalLikesToDelete = tweetsToDelete.tweets.length;
  vm.progress.likesDeleted = 0;
  await vm.syncProgress();

  // Load the likes page
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit(
    `https://x.com/${vm.account.xAccount?.username}/likes`,
  );

  // Hide the browser and start showing other progress instead
  vm.showBrowser = false;

  // Get the ct0 cookie
  const ct0 = await deleteContentGetCookie(
    vm,
    AutomationErrorType.x_runJob_deleteLikes_Ct0CookieNotFound,
  );

  if (!ct0) {
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the like with retry logic
    const { success, statusCode } = await deleteContentRetryLoop(vm, () =>
      deleteLikeItem(
        vm,
        ct0,
        tweetsToDelete.tweets[i].id,
        vm.account.xAccount?.username || "",
      ),
    );

    if (success) {
      // Update the tweet's deletedAt date
      const updated = await deleteContentUpdateDatabase(
        vm,
        () =>
          window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "like",
          ),
        AutomationErrorType.x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp,
        tweetsToDelete.tweets[i],
        i,
      );

      if (updated) {
        vm.progress.likesDeleted += 1;
        await vm.syncProgress();
      }
    } else {
      // Failed to delete
      await deleteContentHandleFailure(
        vm,
        AutomationErrorType.x_runJob_deleteLikes_FailedToDelete,
        statusCode,
        tweetsToDelete.tweets[i],
        i,
      );
    }

    await vm.waitForPause();
  }

  await vm.finishJob(jobIndex);
}

export async function runJobDeleteBookmarks(
  vm: XViewModel,
  jobIndex: number,
): Promise<void> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_DELETE_BOOKMARKS,
    navigator.userAgent,
  );

  // After this job, we want to reload the user stats
  await window.electron.X.setConfig(vm.account.id, "reloadUserStats", "true");

  vm.runJobsState = RunJobsState.DeleteBookmarks;
  vm.instructions = `# I'm deleting your bookmarks, starting with the earliest.`;

  // Load the bookmarks to delete
  const tweetsToDelete = await deleteTweetsLoadList(
    vm,
    window.electron.X.deleteBookmarksStart,
    AutomationErrorType.x_runJob_deleteLikes_FailedToStart,
  );

  if (!tweetsToDelete) {
    return;
  }

  // Start the progress
  vm.progress.totalBookmarksToDelete = tweetsToDelete.tweets.length;
  vm.progress.bookmarksDeleted = 0;
  await vm.syncProgress();

  // Load the bookmarks page
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit("https://x.com/i/bookmarks");

  // Hide the browser and start showing other progress instead
  vm.showBrowser = false;

  // Get the ct0 cookie
  const ct0 = await deleteContentGetCookie(
    vm,
    AutomationErrorType.x_runJob_deleteBookmarks_Ct0CookieNotFound,
  );

  if (!ct0) {
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the bookmark with retry logic
    const { success, statusCode } = await deleteContentRetryLoop(vm, () =>
      deleteBookmarkItem(vm, ct0, tweetsToDelete.tweets[i].id),
    );

    if (success) {
      // Update the tweet's deletedAt date
      const updated = await deleteContentUpdateDatabase(
        vm,
        () =>
          window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "bookmark",
          ),
        AutomationErrorType.x_runJob_deleteBookmarks_FailedToUpdateDeleteTimestamp,
        tweetsToDelete.tweets[i],
        i,
      );

      if (updated) {
        vm.progress.bookmarksDeleted += 1;
        await vm.syncProgress();
      }
    } else {
      // Failed to delete
      await deleteContentHandleFailure(
        vm,
        AutomationErrorType.x_runJob_deleteBookmarks_FailedToDelete,
        statusCode,
        tweetsToDelete.tweets[i],
        i,
      );
    }

    await vm.waitForPause();
  }

  await vm.finishJob(jobIndex);
}

export async function runJobDeleteDMs(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_DELETE_DMS,
    navigator.userAgent,
  );

  let tries: number;
  let errorTriggered = false;
  let reloadDMsPage = true;

  vm.showBrowser = true;
  vm.instructions = `# I'm deleting all your direct message conversations, starting with the most recent.`;
  vm.showAutomationNotice = true;

  // Start the progress
  await vm.syncProgress();
  vm.progress.isDeleteDMsFinished = false;
  vm.progress.conversationsDeleted = 0;

  // Loop through all of the conversations, deleting them one at a time until they are gone
  while (true) {
    await vm.waitForPause();

    // Try 3 times, in case of rate limit or error
    for (tries = 0; tries < 3; tries++) {
      // Load the DMs page, if necessary
      if (reloadDMsPage) {
        if (await deleteDMsLoadDMsPage(vm)) {
          return false;
        }
        reloadDMsPage = false;
      }

      // Process one DM deletion iteration
      const result = await deleteDMsProcessIteration(vm);

      if (result.success) {
        // Successfully deleted or no more conversations
        await vm.sleep(500);
        await vm.waitForLoadingToFinish();

        if (vm.progress.isDeleteDMsFinished) {
          // Submit progress to the API
          vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);
          await vm.finishJob(jobIndex);
          return true;
        }
        break;
      }

      if (result.shouldReload) {
        reloadDMsPage = true;
      }

      if (result.errorTriggered && result.errorType) {
        await vm.error(result.errorType, {});
        errorTriggered = true;
        break;
      }
    }

    await vm.sleep(500);
    await vm.waitForLoadingToFinish();

    if (errorTriggered) {
      // Submit progress to the API
      vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);
      return false;
    }
  }
}

export async function runJobUnfollowEveryone(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_UNFOLLOW_EVERYONE,
    navigator.userAgent,
  );

  let tries: number;
  let errorTriggered = false;
  let reloadFollowingPage = true;
  let numberOfAccountsToUnfollow = 0;
  let accountToUnfollowIndex = 0;

  vm.showBrowser = true;
  vm.instructions = `# I'm unfollowing everyone on X for you.`;
  vm.showAutomationNotice = true;

  // Start the progress
  await vm.syncProgress();
  vm.progress.isUnfollowEveryoneFinished = false;
  vm.progress.accountsUnfollowed = 0;

  while (true) {
    await vm.waitForPause();

    // Try 3 times, in case of rate limit or error
    for (tries = 0; tries < 3; tries++) {
      // Load the following page, if necessary
      if (reloadFollowingPage) {
        if (await unfollowEveryoneLoadPage(vm)) {
          return false;
        }
        reloadFollowingPage = false;

        // Count the number of accounts to unfollow in the DOM
        numberOfAccountsToUnfollow = await vm.countSelectorsFound(
          'div[data-testid="cellInnerDiv"] button button',
        );
        accountToUnfollowIndex = 0;
      }

      // Process one unfollow iteration
      const result = await unfollowEveryoneProcessIteration(
        vm,
        accountToUnfollowIndex,
        numberOfAccountsToUnfollow,
      );

      if (result.success) {
        accountToUnfollowIndex = result.newAccountIndex;
        reloadFollowingPage = result.shouldReload;

        if (vm.progress.isUnfollowEveryoneFinished) {
          // Submit progress to the API
          vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);
          await vm.finishJob(jobIndex);
          return true;
        }
        break;
      }

      if (result.errorTriggered && result.errorType) {
        await vm.error(result.errorType, {});
        errorTriggered = true;
        break;
      }

      if (result.shouldReload) {
        reloadFollowingPage = true;
      }
    }

    await vm.sleep(500);

    if (errorTriggered) {
      // Submit progress to the API
      vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);
      return false;
    }
  }
}
