import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
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
  unfollowEveryoneProcessIteration,
  unfollowEveryoneLoadPage,
  UNFOLLOW_BUTTON_SELECTOR,
} from "./jobs_delete/index";

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
  vm.instructions = vm.t("viewModels.x.jobs.delete.tweets");

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

  // Load the profile page, which is where X's own client deletes posts from
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

    // Delete the tweet with retry logic
    const { success, statusCode } = await deleteContentRetryLoop(vm, () =>
      deleteTweetItem(vm, ct0, tweetsToDelete.tweets[i].id),
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
  vm.instructions = vm.t("viewModels.x.jobs.delete.retweets");

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

  // Load the reposts page, which is where reposts now live
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit(
    `https://x.com/${vm.account.xAccount?.username}/reposts`,
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
        tweetsToDelete.tweets[i].rt ?? null,
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
  vm.instructions = vm.t("viewModels.x.jobs.delete.likes");

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

  // Load the likes page. X redirects it into its /i/ namespace, which is where
  // the referrer for UnfavoriteTweet comes from, so accept the redirect rather
  // than ending the job on it.
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit(
    `https://x.com/${vm.account.xAccount?.username}/likes`,
    ["https://x.com/i/history/likes", "https://x.com/i/history"],
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
      deleteLikeItem(vm, ct0, tweetsToDelete.tweets[i].id),
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
  vm.instructions = vm.t("viewModels.x.jobs.delete.bookmarks");

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

  // Load the bookmarks page, which X may redirect to /i/history — the referrer
  // its own client sends from here.
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit("https://x.com/i/bookmarks", [
    "https://x.com/i/history",
  ]);

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
  vm.instructions = vm.t("viewModels.x.jobs.delete.unfollowEveryone");
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
          UNFOLLOW_BUTTON_SELECTOR,
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
