import type { XViewModel } from "./view_model";
import { TimeoutError, URLChangedError } from "../BaseViewModel";
import { XDeleteTweetsStartResponse } from "../../../../shared_types";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import { RunJobsState } from "./types";

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
  let tweetsToDelete: XDeleteTweetsStartResponse;
  vm.instructions = `# I'm deleting your tweets based on your criteria, starting with the earliest.`;

  // Load the tweets to delete
  try {
    tweetsToDelete = await window.electron.X.deleteTweetsStart(vm.account.id);
  } catch (e) {
    await vm.error(AutomationErrorType.x_runJob_deleteTweets_FailedToStart, {
      error: formatError(e as Error),
    });
    return;
  }
  vm.log(
    "runJobDeleteTweets",
    `found ${tweetsToDelete.tweets.length} tweets to delete`,
  );

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
    "https://x.com/" + vm.account.xAccount?.username + "/with_replies",
  );

  // Hide the browser and start showing other progress instead
  vm.showBrowser = false;

  // Get the ct0 cookie
  const ct0: string | null = await window.electron.X.getCookie(
    vm.account.id,
    "x.com",
    "ct0",
  );
  vm.log("runJobDeleteTweets", ["ct0", ct0]);
  if (!ct0) {
    await vm.error(
      AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
      {},
    );
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the tweet
    let tweetDeleted = false;
    let statusCode = 0;
    for (let tries = 0; tries < 3; tries++) {
      statusCode = await vm.graphqlDelete(
        ct0,
        "https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet",
        "https://x.com/" + vm.account.xAccount?.username + "/with_replies",
        JSON.stringify({
          variables: {
            tweet_id: tweetsToDelete.tweets[i].id,
            dark_request: false,
          },
          queryId: "VaenaVgh5q5ih7kvyVjgtg",
        }),
      );
      if (statusCode == 200) {
        // Update the tweet's deletedAt date
        try {
          await window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "tweet",
          );
          tweetDeleted = true;
          vm.progress.tweetsDeleted += 1;
          await vm.syncProgress();
        } catch (e) {
          await vm.error(
            AutomationErrorType.x_runJob_deleteTweets_FailedToUpdateDeleteTimestamp,
            {
              error: formatError(e as Error),
            },
            {
              tweet: tweetsToDelete.tweets[i],
              index: i,
            },
            true,
          );
        }
        break;
      } else if (statusCode == 429) {
        // Rate limited
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        await vm.waitForRateLimit();
        tries = 0;
      } else {
        // Sleep 1 second and try again
        vm.log("runJobDeleteTweets", [
          "statusCode",
          statusCode,
          "failed to delete tweet, try #",
          tries,
        ]);
        await vm.sleep(1000);
      }
    }

    if (!tweetDeleted) {
      await vm.error(
        AutomationErrorType.x_runJob_deleteTweets_FailedToDelete,
        {
          statusCode: statusCode,
        },
        {
          tweet: tweetsToDelete.tweets[i],
          index: i,
        },
        true,
      );

      vm.progress.errorsOccured += 1;
      await vm.syncProgress();
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
  let tweetsToDelete: XDeleteTweetsStartResponse;
  vm.instructions = `# I'm deleting your retweets, starting with the earliest.`;

  // Load the retweets to delete
  try {
    tweetsToDelete = await window.electron.X.deleteRetweetsStart(vm.account.id);
  } catch (e) {
    await vm.error(AutomationErrorType.x_runJob_deleteRetweets_FailedToStart, {
      error: formatError(e as Error),
    });
    return;
  }
  vm.log("runJob", [
    "jobType=deleteRetweets",
    "XDeleteTweetsStartResponse",
    tweetsToDelete,
  ]);

  // Start the progress
  vm.progress.totalRetweetsToDelete = tweetsToDelete.tweets.length;
  vm.progress.retweetsDeleted = 0;
  await vm.syncProgress();

  // Load the tweets page
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit(
    "https://x.com/" + vm.account.xAccount?.username,
  );

  // Hide the browser and start showing other progress instead
  vm.showBrowser = false;

  // Get the ct0 cookie
  const ct0: string | null = await window.electron.X.getCookie(
    vm.account.id,
    "x.com",
    "ct0",
  );
  vm.log("runJobDeleteRetweets", ["ct0", ct0]);
  if (!ct0) {
    await vm.error(
      AutomationErrorType.x_runJob_deleteTweets_Ct0CookieNotFound,
      {},
    );
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the retweet
    let retweetDeleted = false;
    let statusCode = 0;
    for (let tries = 0; tries < 3; tries++) {
      // Delete the retweet (which also uses the delete tweet API route)
      statusCode = await vm.graphqlDelete(
        ct0,
        "https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet",
        "https://x.com/" + vm.account.xAccount?.username + "/with_replies",
        JSON.stringify({
          variables: {
            tweet_id: tweetsToDelete.tweets[i].id,
            dark_request: false,
          },
          queryId: "VaenaVgh5q5ih7kvyVjgtg",
        }),
      );
      if (statusCode == 200) {
        vm.log("runJobDeleteRetweets", [
          "deleted retweet",
          tweetsToDelete.tweets[i].id,
        ]);
        // Update the tweet's deletedAt date
        try {
          await window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "retweet",
          );
          retweetDeleted = true;
          vm.progress.retweetsDeleted += 1;
          await vm.syncProgress();
        } catch (e) {
          await vm.error(
            AutomationErrorType.x_runJob_deleteRetweets_FailedToUpdateDeleteTimestamp,
            {
              error: formatError(e as Error),
            },
            {
              tweet: tweetsToDelete.tweets[i],
              index: i,
            },
            true,
          );
        }
        break;
      } else if (statusCode == 429) {
        // Rate limited
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        await vm.waitForRateLimit();
        tries = 0;
      } else {
        // Sleep 1 second and try again
        vm.log("runJobDeleteRetweets", [
          "statusCode",
          statusCode,
          "failed to delete retweet, try #",
          tries,
        ]);
        await vm.sleep(1000);
      }
    }

    if (!retweetDeleted) {
      await vm.error(
        AutomationErrorType.x_runJob_deleteRetweets_FailedToDelete,
        {
          statusCode: statusCode,
        },
        {
          tweet: tweetsToDelete.tweets[i],
          index: i,
        },
        true,
      );

      vm.progress.errorsOccured += 1;
      await vm.syncProgress();
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
  let tweetsToDelete: XDeleteTweetsStartResponse;
  vm.instructions = `# I'm deleting your likes, starting with the earliest.`;

  // Load the likes to delete
  try {
    tweetsToDelete = await window.electron.X.deleteLikesStart(vm.account.id);
  } catch (e) {
    await vm.error(AutomationErrorType.x_runJob_deleteLikes_FailedToStart, {
      error: formatError(e as Error),
    });
    return;
  }
  vm.log(
    "runJobDeleteLikes",
    `found ${tweetsToDelete.tweets.length} likes to delete`,
  );

  // Start the progress
  vm.progress.totalLikesToDelete = tweetsToDelete.tweets.length;
  vm.progress.likesDeleted = 0;
  await vm.syncProgress();

  // Load the likes page
  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  await vm.loadURLWithRateLimit(
    "https://x.com/" + vm.account.xAccount?.username + "/likes",
  );

  // Hide the browser and start showing other progress instead
  vm.showBrowser = false;

  // Get the ct0 cookie
  const ct0: string | null = await window.electron.X.getCookie(
    vm.account.id,
    "x.com",
    "ct0",
  );
  vm.log("runJobDeleteLikes", ["ct0", ct0]);
  if (!ct0) {
    await vm.error(
      AutomationErrorType.x_runJob_deleteLikes_Ct0CookieNotFound,
      {},
    );
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the like
    let likeDeleted = false;
    let statusCode = 0;
    for (let tries = 0; tries < 3; tries++) {
      statusCode = await vm.graphqlDelete(
        ct0,
        "https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet",
        "https://x.com/" + vm.account.xAccount?.username + "/likes",
        JSON.stringify({
          variables: {
            tweet_id: tweetsToDelete.tweets[i].id,
          },
          queryId: "ZYKSe-w7KEslx3JhSIk5LA",
        }),
      );
      if (statusCode == 200) {
        // Update the tweet's deletedAt date
        try {
          await window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "like",
          );
          likeDeleted = true;
          vm.progress.likesDeleted += 1;
          await vm.syncProgress();
        } catch (e) {
          await vm.error(
            AutomationErrorType.x_runJob_deleteLikes_FailedToUpdateDeleteTimestamp,
            {
              error: formatError(e as Error),
            },
            {
              tweet: tweetsToDelete.tweets[i],
              index: i,
            },
            true,
          );
        }
        break;
      } else if (statusCode == 429) {
        // Rate limited
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        await vm.waitForRateLimit();
        tries = 0;
      } else {
        // Sleep 1 second and try again
        vm.log("runJobDeleteLikes", [
          "statusCode",
          statusCode,
          "failed to delete like, try #",
          tries,
        ]);
        await vm.sleep(1000);
      }
    }

    if (!likeDeleted) {
      await vm.error(
        AutomationErrorType.x_runJob_deleteLikes_FailedToDelete,
        {
          statusCode: statusCode,
        },
        {
          tweet: tweetsToDelete.tweets[i],
          index: i,
        },
        true,
      );

      vm.progress.errorsOccured += 1;
      await vm.syncProgress();
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
  let tweetsToDelete: XDeleteTweetsStartResponse;
  vm.instructions = `# I'm deleting your bookmarks, starting with the earliest.`;

  // Load the bookmarks to delete
  try {
    tweetsToDelete = await window.electron.X.deleteBookmarksStart(
      vm.account.id,
    );
  } catch (e) {
    await vm.error(AutomationErrorType.x_runJob_deleteLikes_FailedToStart, {
      error: formatError(e as Error),
    });
    return;
  }
  vm.log(
    "runJobDeleteBookmarks",
    `found ${tweetsToDelete.tweets.length} bookmarks to delete`,
  );

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
  const ct0: string | null = await window.electron.X.getCookie(
    vm.account.id,
    "x.com",
    "ct0",
  );
  vm.log("runJobDeleteBookmarks", ["ct0", ct0]);
  if (!ct0) {
    await vm.error(
      AutomationErrorType.x_runJob_deleteBookmarks_Ct0CookieNotFound,
      {},
    );
    return;
  }

  for (let i = 0; i < tweetsToDelete.tweets.length; i++) {
    vm.currentTweetItem = tweetsToDelete.tweets[i];

    // Delete the bookmark
    let bookmarkDeleted = false;
    let statusCode = 0;
    for (let tries = 0; tries < 3; tries++) {
      statusCode = await vm.graphqlDelete(
        ct0,
        "https://x.com/i/api/graphql/Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark",
        "https://x.com/i/bookmarks",
        JSON.stringify({
          variables: {
            tweet_id: tweetsToDelete.tweets[i].id,
          },
          queryId: "Wlmlj2-xzyS1GN3a6cj-mQ",
        }),
      );
      if (statusCode == 200) {
        // Update the tweet's deletedAt date
        try {
          await window.electron.X.deleteTweet(
            vm.account.id,
            tweetsToDelete.tweets[i].id,
            "bookmark",
          );
          bookmarkDeleted = true;
          vm.progress.bookmarksDeleted += 1;
          await vm.syncProgress();
        } catch (e) {
          await vm.error(
            AutomationErrorType.x_runJob_deleteBookmarks_FailedToUpdateDeleteTimestamp,
            {
              error: formatError(e as Error),
            },
            {
              tweet: tweetsToDelete.tweets[i],
              index: i,
            },
            true,
          );
        }
        break;
      } else if (statusCode == 429) {
        // Rate limited
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        await vm.waitForRateLimit();
        tries = 0;
      } else {
        // Sleep 1 second and try again
        vm.log("runJobDeleteLikes", [
          "statusCode",
          statusCode,
          "failed to delete like, try #",
          tries,
        ]);
        await vm.sleep(1000);
      }
    }

    if (!bookmarkDeleted) {
      await vm.error(
        AutomationErrorType.x_runJob_deleteBookmarks_FailedToDelete,
        {
          statusCode: statusCode,
        },
        {
          tweet: tweetsToDelete.tweets[i],
          index: i,
        },
        true,
      );

      vm.progress.errorsOccured += 1;
      await vm.syncProgress();
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

  let tries: number, success: boolean;
  let error: Error | null = null;
  let errorType: AutomationErrorType =
    AutomationErrorType.x_runJob_deleteDMs_UnknownError;

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
    error = null;
    success = false;

    await vm.waitForPause();

    // Try 3 times, in case of rate limit or error
    for (tries = 0; tries < 3; tries++) {
      errorTriggered = false;

      // Load the DMs page, if necessary
      if (reloadDMsPage) {
        if (await deleteDMsLoadDMsPage(vm)) {
          return false;
        }
        reloadDMsPage = false;
      }

      // When loading the DMs page in the previous step, if there are no conversations it sets isDeleteDMsFinished to true
      if (vm.progress.isDeleteDMsFinished) {
        vm.log("runJobDeleteDMs", [
          "no more conversations, so ending deleteDMS",
        ]);
        await window.electron.X.deleteDMsMarkAllDeleted(vm.account.id);
        success = true;
        break;
      }

      // Wait for conversation selector
      try {
        await vm.waitForSelector('div[data-testid="conversation"]');
      } catch (e) {
        errorTriggered = true;
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
          reloadDMsPage = true;
          tries--;
          continue;
        } else {
          error = e as Error;
          errorType =
            AutomationErrorType.x_runJob_deleteDMs_WaitForConversationsFailed;
          vm.log("runJobDeleteDMs", [
            "wait for conversation selector failed, try #",
            tries,
          ]);
          reloadDMsPage = true;
          continue;
        }
      }

      // Mouseover the first conversation
      if (
        !(await vm.scriptMouseoverElementFirst(
          'div[data-testid="conversation"]',
        ))
      ) {
        errorTriggered = true;
        errorType = AutomationErrorType.x_runJob_deleteDMs_MouseoverFailed;
        reloadDMsPage = true;
        continue;
      }

      // Wait for menu button selector
      try {
        await vm.waitForSelectorWithinSelector(
          'div[data-testid="conversation"]',
          "button",
        );
      } catch (e) {
        errorTriggered = true;
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
          reloadDMsPage = true;
          tries--;
          continue;
        } else {
          error = e as Error;
          errorType =
            AutomationErrorType.x_runJob_deleteDMs_WaitForMenuButtonFailed;
          vm.log("runJobDeleteDMs", [
            "wait for menu button selector failed, try #",
            tries,
          ]);
          reloadDMsPage = true;
          continue;
        }
      }

      // Click the menu button
      if (
        !(await vm.scriptClickElementWithinElementFirst(
          'div[data-testid="conversation"]',
          "button",
        ))
      ) {
        errorTriggered = true;
        errorType = AutomationErrorType.x_runJob_deleteDMs_ClickMenuFailed;
        reloadDMsPage = true;
        continue;
      }

      // Wait for delete button selector
      try {
        await vm.waitForSelector(
          'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
        );
      } catch (e) {
        errorTriggered = true;
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
          reloadDMsPage = true;
          tries--;
          continue;
        } else {
          error = e as Error;
          errorType =
            AutomationErrorType.x_runJob_deleteDMs_WaitForDeleteButtonFailed;
          vm.log("runJobDeleteDMs", [
            "wait for delete button selector failed, try #",
            tries,
          ]);
          reloadDMsPage = true;
          continue;
        }
      }

      // Click the delete button
      if (
        !(await vm.scriptClickElement(
          'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
        ))
      ) {
        errorTriggered = true;
        errorType = AutomationErrorType.x_runJob_deleteDMs_ClickDeleteFailed;
        reloadDMsPage = true;
        continue;
      }

      // Wait for delete confirm selector
      try {
        await vm.waitForSelector(
          'button[data-testid="confirmationSheetConfirm"]',
        );
      } catch (e) {
        errorTriggered = true;
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
          reloadDMsPage = true;
          tries--;
          continue;
        } else {
          error = e as Error;
          errorType =
            AutomationErrorType.x_runJob_deleteDMs_WaitForConfirmButtonFailed;
          vm.log("runJobDeleteDMs", [
            "wait for confirm button selector failed, try #",
            tries,
          ]);
          reloadDMsPage = true;
          continue;
        }
      }

      // Click the confirm button
      if (
        !(await vm.scriptClickElement(
          'button[data-testid="confirmationSheetConfirm"]',
        ))
      ) {
        errorTriggered = true;
        errorType = AutomationErrorType.x_runJob_deleteDMs_ClickConfirmFailed;
        reloadDMsPage = true;
        continue;
      }

      if (!errorTriggered) {
        // Update progress
        vm.progress.conversationsDeleted += 1;
        await window.electron.X.setConfig(
          vm.account.id,
          "totalConversationsDeleted",
          `${vm.progress.conversationsDeleted}`,
        );
        break;
      }
    }

    await vm.sleep(500);
    await vm.waitForLoadingToFinish();

    if (success) {
      break;
    }

    if (errorTriggered) {
      if (error) {
        await vm.error(errorType, {
          error: formatError(error as Error),
        });
      } else {
        await vm.error(errorType, {});
      }
      break;
    }
  }

  // Submit progress to the API
  vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);

  if (errorTriggered) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobUnfollowEveryone(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_UNFOLLOW_EVERYONE,
    navigator.userAgent,
  );

  let tries: number, success: boolean;
  let error: Error | null = null;
  let errorType: AutomationErrorType =
    AutomationErrorType.x_runJob_unfollowEveryone_UnknownError;

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
    error = null;
    success = false;

    await vm.waitForPause();

    // Try 3 times, in case of rate limit or error
    for (tries = 0; tries < 3; tries++) {
      errorTriggered = false;

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

      // When loading the following page in the previous step, if there are following users it sets isUnfollowEveryoneFinished to true
      if (vm.progress.isUnfollowEveryoneFinished) {
        vm.log("runJobUnfollowEveryone", [
          "no more following users, so ending unfollowEveryone",
        ]);
        success = true;
        break;
      }

      // Mouseover the "Following" button on the next user
      if (
        !(await vm.scriptMouseoverElementNth(
          'div[data-testid="cellInnerDiv"] button button',
          accountToUnfollowIndex,
        ))
      ) {
        errorTriggered = true;
        errorType =
          AutomationErrorType.x_runJob_unfollowEveryone_MouseoverFailed;
        reloadFollowingPage = true;
        continue;
      }

      // Click the unfollow button
      if (
        !(await vm.scriptClickElementNth(
          'div[data-testid="cellInnerDiv"] button button',
          accountToUnfollowIndex,
        ))
      ) {
        errorTriggered = true;
        errorType =
          AutomationErrorType.x_runJob_unfollowEveryone_ClickUnfollowFailed;
        reloadFollowingPage = true;
        continue;
      }

      // Wait for confirm button
      try {
        await vm.waitForSelector(
          'button[data-testid="confirmationSheetConfirm"]',
        );
      } catch (e) {
        errorTriggered = true;
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
          reloadFollowingPage = true;
          tries--;
          continue;
        } else {
          error = e as Error;
          errorType =
            AutomationErrorType.x_runJob_unfollowEveryone_WaitForConfirmButtonFailed;
          vm.log("runJobUnfollowEveryone", [
            "wait for confirm button selector failed, try #",
            tries,
          ]);
          reloadFollowingPage = true;
          continue;
        }
      }

      // Click the confirm button
      if (
        !(await vm.scriptClickElement(
          'button[data-testid="confirmationSheetConfirm"]',
        ))
      ) {
        errorTriggered = true;
        errorType =
          AutomationErrorType.x_runJob_unfollowEveryone_ClickConfirmFailed;
        reloadFollowingPage = true;
        continue;
      }

      if (!errorTriggered) {
        // Update progress
        vm.progress.accountsUnfollowed += 1;
        await window.electron.X.setConfig(
          vm.account.id,
          "totalAccountsUnfollowed",
          `${vm.progress.accountsUnfollowed}`,
        );

        // Increment the account index
        accountToUnfollowIndex++;
        if (accountToUnfollowIndex >= numberOfAccountsToUnfollow) {
          reloadFollowingPage = true;
        }
        break;
      }
    }

    await vm.sleep(500);

    if (success) {
      break;
    }

    if (errorTriggered) {
      if (error) {
        await vm.error(errorType, {
          error: formatError(error as Error),
        });
      } else {
        await vm.error(errorType, {});
      }
      break;
    }
  }

  // Submit progress to the API
  vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);

  if (errorTriggered) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}
