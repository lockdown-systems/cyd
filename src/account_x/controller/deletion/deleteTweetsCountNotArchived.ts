import log from "electron-log/main";
import { exec, Sqlite3Count } from "../../../database";
import { getTimestampDaysAgo } from "../../../util";
import type { XAccountController } from "../../x_account_controller";
import { containsFilterCondition } from "./containsFilter";

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

  // Count all non-deleted, non-archived tweets, with no filters
  let whereClause =
    "archivedAt IS NULL AND deletedTweetAt IS NULL AND text NOT LIKE ? AND username = ?";
  const params: (string | number)[] = ["RT @%", controller.account.username];

  // Select just the tweets that need to be deleted based on the settings
  if (!total) {
    const daysOldTimestamp = controller.account.deleteTweetsDaysOldEnabled
      ? getTimestampDaysAgo(controller.account.deleteTweetsDaysOld)
      : getTimestampDaysAgo(0);
    whereClause += " AND createdAt <= ?";
    params.push(daysOldTimestamp);

    if (controller.account.deleteTweetsLikesThresholdEnabled) {
      whereClause += " AND likeCount <= ?";
      params.push(controller.account.deleteTweetsLikesThreshold);
    }
    if (controller.account.deleteTweetsRetweetsThresholdEnabled) {
      whereClause += " AND retweetCount <= ?";
      params.push(controller.account.deleteTweetsRetweetsThreshold);
    }
    const containsFilter = containsFilterCondition(
      "text",
      controller.account.deleteTweetsFilterEnabled,
      controller.account.deleteTweetsFilterText,
    );
    if (containsFilter) {
      whereClause += ` AND ${containsFilter.sql}`;
      params.push(containsFilter.param);
    }
  }

  const count = exec(
    controller.db,
    `SELECT COUNT(*) AS count FROM tweet WHERE ${whereClause}`,
    params,
    "get",
  ) as Sqlite3Count;

  return count.count;
}
