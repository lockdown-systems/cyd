import log from "electron-log/main";
import { exec, Sqlite3Count } from "../../../database";
import { getTimestampDaysAgo } from "../../../util";
import type { XAccountController } from "../../x_account_controller";

// Returns the count of tweets that are not archived
// If total is true, return the total count of tweets not archived
// Otherwise, return the count of tweets not archived that will be deleted
export async function deleteTweetsCountNotArchived(
  controller: XAccountController,
  total: boolean,
): Promise<number> {
  log.info("XAccountController.deleteTweetsCountNotArchived");

  if (!controller.db) {
    controller.initDB();
  }

  if (!controller.account) {
    throw new Error("Account not found");
  }

  // Select just the tweets that need to be deleted based on the settings
  let count: Sqlite3Count;

  if (total) {
    // Count all non-deleted, non-archived tweets, with no filters
    count = exec(
      controller.db,
      "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ?",
      ["RT @%", controller.account.username],
      "get",
    ) as Sqlite3Count;
  } else {
    const daysOldTimestamp = controller.account.deleteTweetsDaysOldEnabled
      ? getTimestampDaysAgo(controller.account.deleteTweetsDaysOld)
      : getTimestampDaysAgo(0);
    if (
      controller.account.deleteTweetsLikesThresholdEnabled &&
      controller.account.deleteTweetsRetweetsThresholdEnabled
    ) {
      // Both likes and retweets thresholds
      count = exec(
        controller.db,
        "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ? AND retweetCount <= ?",
        [
          "RT @%",
          controller.account.username,
          daysOldTimestamp,
          controller.account.deleteTweetsLikesThreshold,
          controller.account.deleteTweetsRetweetsThreshold,
        ],
        "get",
      ) as Sqlite3Count;
    } else if (
      controller.account.deleteTweetsLikesThresholdEnabled &&
      !controller.account.deleteTweetsRetweetsThresholdEnabled
    ) {
      // Just likes threshold
      count = exec(
        controller.db,
        "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND likeCount <= ?",
        [
          "RT @%",
          controller.account.username,
          daysOldTimestamp,
          controller.account.deleteTweetsLikesThreshold,
        ],
        "get",
      ) as Sqlite3Count;
    } else if (
      !controller.account.deleteTweetsLikesThresholdEnabled &&
      controller.account.deleteTweetsRetweetsThresholdEnabled
    ) {
      // Just retweets threshold
      count = exec(
        controller.db,
        "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ? AND retweetCount <= ?",
        [
          "RT @%",
          controller.account.username,
          daysOldTimestamp,
          controller.account.deleteTweetsRetweetsThreshold,
        ],
        "get",
      ) as Sqlite3Count;
    } else {
      // Neither likes nor retweets threshold
      count = exec(
        controller.db,
        "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ? AND createdAt <= ?",
        ["RT @%", controller.account.username, daysOldTimestamp],
        "get",
      ) as Sqlite3Count;
    }
  }

  return count.count;
}
