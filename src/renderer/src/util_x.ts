import CydAPIClient from "../../cyd-api-client";
import type { DeviceInfo } from "./types";
import { XAccount, XProgressInfo } from "../../shared_types";
import { getJobsType } from "./util";

export async function xGetLastImportArchive(
  accountID: number
): Promise<Date | null> {
  const lastFinishedJob_importArchive = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_importArchive"
  );
  if (lastFinishedJob_importArchive) {
    return new Date(lastFinishedJob_importArchive);
  }
  return null;
}

export async function xGetLastBuildDatabase(
  accountID: number
): Promise<Date | null> {
  const lastFinishedJob_indexTweets = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_indexTweets"
  );
  const lastFinishedJob_indexLikes = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_indexLikes"
  );
  if (lastFinishedJob_indexTweets || lastFinishedJob_indexLikes) {
    const lastFinishedJob_indexTweets_date = lastFinishedJob_indexTweets
      ? new Date(lastFinishedJob_indexTweets)
      : new Date(0);
    const lastFinishedJob_indexLikes_date = lastFinishedJob_indexLikes
      ? new Date(lastFinishedJob_indexLikes)
      : new Date(0);
    return lastFinishedJob_indexTweets_date > lastFinishedJob_indexLikes_date
      ? lastFinishedJob_indexTweets_date
      : lastFinishedJob_indexLikes_date;
  }
  return null;
}

export async function xGetLastDelete(accountID: number): Promise<Date | null> {
  const lastFinishedJob_deleteTweets = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_deleteTweets"
  );
  const lastFinishedJob_deleteRetweets = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_deleteRetweets"
  );
  const lastFinishedJob_deleteLikes = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_deleteLikes"
  );
  const lastFinishedJob_deleteBookmarks = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_deleteBookmarks"
  );
  const lastFinishedJob_unfollowEveryone = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_unfollowEveryone"
  );
  const lastFinishedJob_deleteDMs = await window.electron.X.getConfig(
    accountID,
    "lastFinishedJob_deleteDMs"
  );

  if (
    lastFinishedJob_deleteTweets ||
    lastFinishedJob_deleteRetweets ||
    lastFinishedJob_deleteLikes ||
    lastFinishedJob_deleteBookmarks ||
    lastFinishedJob_unfollowEveryone ||
    lastFinishedJob_deleteDMs
  ) {
    const lastFinishedJob_deleteTweets_date = lastFinishedJob_deleteTweets
      ? new Date(lastFinishedJob_deleteTweets)
      : new Date(0);
    const lastFinishedJob_deleteRetweets_date = lastFinishedJob_deleteRetweets
      ? new Date(lastFinishedJob_deleteRetweets)
      : new Date(0);
    const lastFinishedJob_deleteLikes_date = lastFinishedJob_deleteLikes
      ? new Date(lastFinishedJob_deleteLikes)
      : new Date(0);
    const lastFinishedJob_deleteBookmarks_date = lastFinishedJob_deleteBookmarks
      ? new Date(lastFinishedJob_deleteBookmarks)
      : new Date(0);
    const lastFinishedJob_unfollowEveryone_date =
      lastFinishedJob_unfollowEveryone
        ? new Date(lastFinishedJob_unfollowEveryone)
        : new Date(0);
    const lastFinishedJob_deleteDMs_date = lastFinishedJob_deleteDMs
      ? new Date(lastFinishedJob_deleteDMs)
      : new Date(0);
    return new Date(
      Math.max(
        lastFinishedJob_deleteTweets_date.getTime(),
        lastFinishedJob_deleteRetweets_date.getTime(),
        lastFinishedJob_deleteLikes_date.getTime(),
        lastFinishedJob_deleteBookmarks_date.getTime(),
        lastFinishedJob_unfollowEveryone_date.getTime(),
        lastFinishedJob_deleteDMs_date.getTime()
      )
    );
  }
  return null;
}

export async function xHasSomeData(accountID: number): Promise<boolean> {
  const lastImportArchive: Date | null = await xGetLastImportArchive(accountID);
  const lastBuildDatabase: Date | null = await xGetLastBuildDatabase(accountID);
  return lastImportArchive !== null || lastBuildDatabase !== null;
}

export async function xRequiresPremium(
  accountID: number,
  xAccount: XAccount
): Promise<boolean> {
  let requiresPremium = false;
  const jobsType = getJobsType(accountID);

  // Migrating to Bluesky is a premium feature
  if (jobsType == "migrateBluesky") {
    return true;
  }

  // All other premium features are part of deleting
  if (jobsType != "delete") {
    return requiresPremium;
  }

  // You can delete tweets for free, but only if you're not using these options
  if (xAccount.deleteTweets && xAccount.deleteTweetsDaysOldEnabled) {
    console.log(
      "Requires premium: deleteTweets and deleteTweetsDaysOldEnabled"
    );
    requiresPremium = true;
  }
  if (xAccount.deleteTweets && xAccount.deleteTweetsLikesThresholdEnabled) {
    console.log(
      "Requires premium: deleteTweets and deleteTweetsLikesThresholdEnabled"
    );
    requiresPremium = true;
  }
  if (xAccount.deleteTweets && xAccount.deleteTweetsRetweetsThresholdEnabled) {
    console.log(
      "Requires premium: deleteTweets and deleteTweetsRetweetsThresholdEnabled"
    );
    requiresPremium = true;
  }

  // You can delete retweets for free, but only if you're not using these options
  if (xAccount.deleteRetweets && xAccount.deleteRetweetsDaysOldEnabled) {
    console.log(
      "Requires premium: deleteRetweets and deleteRetweetsDaysOldEnabled"
    );
    requiresPremium = true;
  }

  // Deleting likes, bookmarks, DMs, and unfollowing everyone are premium features
  if (xAccount.deleteLikes) {
    console.log("Requires premium: deleteLikes");
    requiresPremium = true;
  }
  if (xAccount.deleteDMs) {
    console.log("Requires premium: deleteDMs");
    requiresPremium = true;
  }
  if (xAccount.deleteBookmarks) {
    console.log("Requires premium: deleteBookmarks");
    requiresPremium = true;
  }
  if (xAccount.unfollowEveryone) {
    console.log("Requires premium: unfollowEveryone");
    requiresPremium = true;
  }

  return requiresPremium;
}

export async function xPostProgress(
  apiClient: CydAPIClient,
  deviceInfo: DeviceInfo | null,
  accountID: number
) {
  const progressInfo: XProgressInfo = await window.electron.X.getProgressInfo(
    accountID
  );
  const postXProgresResp = await apiClient.postXProgress(
    {
      account_uuid: progressInfo.accountUUID,
      total_tweets_indexed: progressInfo.totalTweetsIndexed,
      total_tweets_archived: progressInfo.totalTweetsArchived,
      total_retweets_indexed: progressInfo.totalRetweetsIndexed,
      total_likes_indexed: progressInfo.totalLikesIndexed,
      total_bookmarks_indexed: progressInfo.totalBookmarksIndexed,
      total_unknown_indexed: progressInfo.totalUnknownIndexed,
      total_tweets_deleted: progressInfo.totalTweetsDeleted,
      total_retweets_deleted: progressInfo.totalRetweetsDeleted,
      total_likes_deleted: progressInfo.totalLikesDeleted,
      total_bookmarks_deleted: progressInfo.totalBookmarksDeleted,
      total_conversations_deleted: progressInfo.totalConversationsDeleted,
      total_accounts_unfollowed: progressInfo.totalAccountsUnfollowed,
      total_tweets_migrated_to_bluesky:
        progressInfo.totalTweetsMigratedToBluesky,
    },
    deviceInfo?.valid ? true : false
  );
  if (
    postXProgresResp !== true &&
    postXProgresResp !== false &&
    postXProgresResp.error
  ) {
    // Silently log the error and continue
    console.error(
      "xPostProgress",
      "failed to post progress to the API",
      postXProgresResp.message
    );
  }
}
