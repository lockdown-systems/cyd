import type { XViewModel } from "./view_model";
import { XArchiveStartResponse } from "../../../../shared_types";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import { FailureState } from "./types";
import { archiveSaveTweet } from "./jobs_index/helpers_archive";
import {
  indexContentCheckOutcome,
  indexContentParsePage,
  indexContentWaitForInitialLoad,
  indexContentProcessIteration,
} from "./jobs_index/helpers_shared";

// All helper functions have been moved to separate files in ./jobs_index/
// - helpers_tweets.ts: Tweet-specific helpers
// - helpers_archive.ts: Archive helper
// - helpers_shared.ts: Shared indexing helpers

// How many times to load a timeline that answers with nothing Cyd can read
// before reporting it. X sometimes just needs another go.
const MAX_TIMELINE_ATTEMPTS = 3;

interface XTimelineRoute {
  url: string;
  // X redirects some of its timelines; a change to one of these is expected
  expectedURLs?: (string | RegExp)[];
  // The page's own empty-state marker, where X shows one
  emptySelector?: string;
}

interface XIndexTimelineErrors {
  urlChanged: AutomationErrorType;
  other: AutomationErrorType;
  parse: AutomationErrorType;
  verify: AutomationErrorType;
  // X answered with nothing Cyd could read
  unreadable: AutomationErrorType;
}

interface XIndexTimelineConfig {
  event: (typeof PlausibleEvents)[keyof typeof PlausibleEvents];
  instructionsKey: string;
  routes: XTimelineRoute[];
  contentSelector: string;
  progressKey: string;
  countKey: string;
  failureStateKey: FailureState;
  errors: XIndexTimelineErrors;
}

type XTimelineRouteResult =
  | { status: "done" }
  // X answered with nothing Cyd could read, so this route is worth another try
  | { status: "unreadable" }
  // The job is over, with or without an automation error having been raised
  | { status: "stop"; errorTriggered: boolean };

async function routeResultFromOutcome(
  vm: XViewModel,
): Promise<XTimelineRouteResult> {
  return (await indexContentCheckOutcome(vm)) == "unreadable"
    ? { status: "unreadable" }
    : { status: "done" };
}

// Load one timeline and save everything on it
async function indexTimelineRoute(
  vm: XViewModel,
  jobIndex: number,
  route: XTimelineRoute,
  config: XIndexTimelineConfig,
): Promise<XTimelineRouteResult> {
  // Each route is judged on the responses it produces itself
  await window.electron.X.resetIndexTimelineStats(vm.account.id);
  await window.electron.X.resetThereIsMore(vm.account.id);
  (vm.progress as Record<string, unknown>)[config.progressKey] = false;

  await vm.waitForPause();
  await window.electron.X.resetRateLimitInfo(vm.account.id);
  await vm.loadURLWithRateLimit(route.url, route.expectedURLs ?? []);
  await vm.sleep(2000);

  // Does the page say it is empty? X shows a marker on likes, bookmarks, and
  // reposts, but not on the profile timeline.
  if (
    route.emptySelector &&
    (await vm.doesSelectorExist(route.emptySelector))
  ) {
    vm.log("indexTimelineRoute", ["empty state found", route.url]);
    return { status: "done" };
  }

  // Wait for content to appear
  const loadResult = await indexContentWaitForInitialLoad(
    vm,
    config.contentSelector,
    config.errors.urlChanged,
    config.errors.other,
  );
  if (loadResult.errorTriggered) {
    return { status: "stop", errorTriggered: true };
  }
  if (loadResult.rateLimited) {
    // The limit has lifted by now, so load the timeline again
    return { status: "unreadable" };
  }

  if (!loadResult.loaded) {
    // Nothing rendered. An account with nothing in it looks exactly like a
    // timeline that never loaded, so ask what X returned rather than guessing.
    const parseResult = await indexContentParsePage(
      vm,
      jobIndex,
      config.errors.parse,
    );
    if (!parseResult.success) {
      return { status: "stop", errorTriggered: true };
    }
    return routeResultFromOutcome(vm);
  }

  // Main indexing loop
  while (
    (vm.progress as Record<string, unknown>)[config.progressKey] === false
  ) {
    const iterationResult = await indexContentProcessIteration(vm, jobIndex, {
      failureStateKey: config.failureStateKey,
      parseErrorType: config.errors.parse,
      verifyErrorType: config.errors.verify,
      progressKey: config.progressKey,
    });

    if (!iterationResult.shouldContinue) {
      if (iterationResult.errorTriggered) {
        return { status: "stop", errorTriggered: true };
      }
      break;
    }
  }

  if (!(vm.progress as Record<string, unknown>)[config.progressKey]) {
    // The loop gave up without finishing, having already recorded why
    return { status: "stop", errorTriggered: false };
  }

  // The timeline was walked to the end. If X never answered with a timeline
  // Cyd could read, the run saved nothing and would otherwise report success.
  return routeResultFromOutcome(vm);
}

// Save everything on each of a category's timelines
async function runIndexTimelineJob(
  vm: XViewModel,
  jobIndex: number,
  config: XIndexTimelineConfig,
): Promise<boolean> {
  await window.electron.trackEvent(config.event, navigator.userAgent);

  vm.showBrowser = true;
  vm.instructions = vm.t(config.instructionsKey);
  vm.showAutomationNotice = true;

  // Start monitoring network requests
  await vm.loadBlank();
  await window.electron.X.indexStart(vm.account.id);
  await vm.sleep(2000);

  // Start the progress
  (vm.progress as Record<string, unknown>)[config.progressKey] = false;
  (vm.progress as Record<string, unknown>)[config.countKey] = 0;
  await vm.syncProgress();

  let errorTriggered = false;
  for (const route of config.routes) {
    let result: XTimelineRouteResult = { status: "unreadable" };
    for (let attempt = 1; attempt <= MAX_TIMELINE_ATTEMPTS; attempt++) {
      result = await indexTimelineRoute(vm, jobIndex, route, config);
      if (result.status !== "unreadable") {
        break;
      }
      vm.log("runIndexTimelineJob", [
        "no timeline response to read, trying again",
        route.url,
        attempt,
      ]);
    }

    if (result.status === "unreadable") {
      // Finishing cleanly here would report success having saved nothing, and
      // automated error reports are the only way an outage is noticed at all.
      await vm.error(
        config.errors.unreadable,
        { url: route.url },
        { currentURL: vm.webview?.getURL() },
      );
      errorTriggered = true;
      break;
    }

    if (result.status === "stop") {
      errorTriggered = result.errorTriggered;
      break;
    }
  }

  // Stop monitoring network requests
  await window.electron.X.indexStop(vm.account.id);

  if (errorTriggered) {
    return false;
  }

  (vm.progress as Record<string, unknown>)[config.progressKey] = true;
  await vm.syncProgress();
  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobIndexTweets(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  const username = vm.account.xAccount?.username || "";
  return runIndexTimelineJob(vm, jobIndex, {
    event: PlausibleEvents.X_JOB_STARTED_INDEX_TWEETS,
    instructionsKey: "viewModels.x.jobs.index.tweets",
    // X split the profile timeline in three on 2026-09-14: the profile route
    // carries original posts only, /with_replies carries replies, and reposts
    // moved to /reposts. See docs/x-capture/findings-20260914.md.
    routes: [
      { url: `https://x.com/${username}` },
      { url: `https://x.com/${username}/with_replies` },
      {
        url: `https://x.com/${username}/reposts`,
        emptySelector: 'div[data-testid="emptyState"]',
      },
    ],
    contentSelector: "section article",
    progressKey: "isIndexTweetsFinished",
    countKey: "tweetsIndexed",
    failureStateKey: FailureState.indexTweets_FailedToRetryAfterRateLimit,
    errors: {
      urlChanged: AutomationErrorType.x_runJob_indexTweets_URLChanged,
      other: AutomationErrorType.x_runJob_indexTweets_OtherError,
      parse: AutomationErrorType.x_runJob_indexTweets_ParseTweetsError,
      verify: AutomationErrorType.x_runJob_indexTweets_VerifyThereIsNoMoreError,
      unreadable: AutomationErrorType.x_runJob_indexTweets_TimelineUnreadable,
    },
  });
}

export async function runJobIndexLikes(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  const username = vm.account.xAccount?.username || "";
  return runIndexTimelineJob(vm, jobIndex, {
    event: PlausibleEvents.X_JOB_STARTED_INDEX_LIKES,
    instructionsKey: "viewModels.x.jobs.index.likes",
    // Likes moved into X's /i/ namespace; the old route redirects there
    routes: [
      {
        url: "https://x.com/i/history/likes",
        expectedURLs: [
          `https://x.com/${username}/likes`,
          "https://x.com/i/history",
        ],
        emptySelector: 'div[data-testid="emptyState"]',
      },
    ],
    contentSelector: "article",
    progressKey: "isIndexLikesFinished",
    countKey: "likesIndexed",
    failureStateKey: FailureState.indexLikes_FailedToRetryAfterRateLimit,
    errors: {
      urlChanged: AutomationErrorType.x_runJob_indexLikes_URLChanged,
      other: AutomationErrorType.x_runJob_indexLikes_OtherError,
      parse: AutomationErrorType.x_runJob_indexLikes_ParseTweetsError,
      verify: AutomationErrorType.x_runJob_indexLikes_VerifyThereIsNoMoreError,
      unreadable: AutomationErrorType.x_runJob_indexLikes_TimelineUnreadable,
    },
  });
}

export async function runJobIndexBookmarks(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  return runIndexTimelineJob(vm, jobIndex, {
    event: PlausibleEvents.X_JOB_STARTED_INDEX_BOOKMARKS,
    instructionsKey: "viewModels.x.jobs.index.bookmarks",
    routes: [
      {
        url: "https://x.com/i/bookmarks",
        expectedURLs: ["https://x.com/i/history"],
        emptySelector: 'div[data-testid="emptyState"]',
      },
    ],
    contentSelector: "article",
    progressKey: "isIndexBookmarksFinished",
    countKey: "bookmarksIndexed",
    failureStateKey: FailureState.indexBookmarks_FailedToRetryAfterRateLimit,
    errors: {
      urlChanged: AutomationErrorType.x_runJob_indexBookmarks_URLChanged,
      other: AutomationErrorType.x_runJob_indexBookmarks_OtherError,
      parse: AutomationErrorType.x_runJob_indexBookmarks_ParseTweetsError,
      verify:
        AutomationErrorType.x_runJob_indexBookmarks_VerifyThereIsNoMoreError,
      unreadable:
        AutomationErrorType.x_runJob_indexBookmarks_TimelineUnreadable,
    },
  });
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
