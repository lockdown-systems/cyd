import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { XMigrateTweetCounts } from "../../../../shared_types";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";
import * as RateLimitOps from "./rate_limit";

export async function runJobMigrateBluesky(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_MIGRATE_BLUESKY,
    navigator.userAgent,
  );

  vm.showBrowser = false;
  vm.instructions = `# I'm migrating your tweets to Bluesky.`;
  vm.showAutomationNotice = true;

  vm.runJobsState = RunJobsState.MigrateBluesky;
  await window.electron.X.resetRateLimitInfo(vm.account.id);

  // Get the tweet counts
  const tweetCounts: XMigrateTweetCounts =
    await window.electron.X.blueskyGetTweetCounts(vm.account.id);

  // Start the progress
  await Helpers.syncProgress(vm);
  vm.progress.totalTweetsToMigrate = tweetCounts.toMigrateTweets.length;
  vm.progress.migrateTweetsCount = 0;
  vm.progress.migrateSkippedTweetsCount = 0;
  vm.progress.migrateSkippedTweetsErrors = {};

  vm.currentTweetItem = null;

  // Loop through tweets and migrate them
  for (const tweet of tweetCounts.toMigrateTweets) {
    let finished = false;
    // Loop until we're finished (retry on rate limit)
    while (!finished) {
      vm.currentTweetItem = tweet;
      const resp = await window.electron.X.blueskyMigrateTweet(
        vm.account.id,
        tweet.id,
      );

      // There was an error
      if (typeof resp === "string") {
        // Were we rate limited?
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await RateLimitOps.waitForRateLimit(vm);
          await window.electron.X.resetRateLimitInfo(vm.account.id);
        } else {
          // There was some other error
          vm.progress.migrateSkippedTweetsCount++;
          vm.progress.migrateSkippedTweetsErrors[tweet.id] = resp;
          console.error("Failed to migrate tweet", tweet.id, resp, tweet);
          finished = true;
        }
      } else {
        // Success
        vm.progress.migrateTweetsCount++;
        finished = true;
      }

      vm.emitter?.emit(`x-update-database-stats-${vm.account.id}`);

      await vm.waitForPause();
    }
  }

  vm.emitter?.emit(`x-update-database-stats-${vm.account.id}`);

  // Submit progress to the API
  vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);

  await Helpers.finishJob(vm, jobIndex);
  return true;
}

export async function runJobMigrateBlueskyDelete(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_MIGRATE_BLUESKY_DELETE,
    navigator.userAgent,
  );

  vm.showBrowser = false;
  vm.instructions = `# I'm deleting your posts from Bluesky that you migrated from X.`;
  vm.showAutomationNotice = true;

  vm.runJobsState = RunJobsState.MigrateBlueskyDelete;

  // Get the tweet counts
  const tweetCounts: XMigrateTweetCounts =
    await window.electron.X.blueskyGetTweetCounts(vm.account.id);

  // Start the progress
  await Helpers.syncProgress(vm);
  vm.progress.totalMigratedPostsToDelete =
    tweetCounts.alreadyMigratedTweets.length;
  vm.progress.migrateDeletePostsCount = 0;
  vm.progress.migrateDeleteSkippedPostsCount = 0;
  vm.progress.migrateSkippedTweetsErrors = {};

  vm.currentTweetItem = null;

  // Loop through migrated posts and delete them
  for (const tweet of tweetCounts.alreadyMigratedTweets) {
    let finished = false;
    // Loop until we're finished (retry on rate limit)
    while (!finished) {
      vm.currentTweetItem = tweet;
      const resp = await window.electron.X.blueskyDeleteMigratedTweet(
        vm.account.id,
        tweet.id,
      );

      // There was an error
      if (typeof resp === "string") {
        // Were we rate limited?
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await RateLimitOps.waitForRateLimit(vm);
          await window.electron.X.resetRateLimitInfo(vm.account.id);
        } else {
          // There was some other error
          vm.progress.migrateDeleteSkippedPostsCount++;
          vm.progress.migrateSkippedTweetsErrors[tweet.id] = resp;
          console.error(
            "Failed to delete migrated tweet",
            tweet.id,
            resp,
            tweet,
          );
          finished = true;
        }
      } else {
        // Success
        vm.progress.migrateDeletePostsCount++;
        finished = true;
      }

      vm.emitter?.emit(`x-update-database-stats-${vm.account.id}`);

      await vm.waitForPause();
    }
  }

  // Submit progress to the API
  vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);

  await Helpers.finishJob(vm, jobIndex);
  return true;
}
