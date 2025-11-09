import log from "electron-log/main";
import { getTimestampDaysAgo } from "../../../util";
import type { XAccountController } from "../../x_account_controller";
import type { XDeleteTweetsStartResponse } from "../../../shared_types";

export async function deleteTweetsStart(
  controller: XAccountController,
): Promise<XDeleteTweetsStartResponse> {
  log.info("XAccountController.deleteTweetsStart");

  if (!controller.db) {
    controller.initDB();
  }

  if (!controller.account) {
    throw new Error("Account not found");
  }

  // Determine the timestamp for filtering tweets
  const daysOldTimestamp = controller.account.deleteTweetsDaysOldEnabled
    ? getTimestampDaysAgo(controller.account.deleteTweetsDaysOld)
    : getTimestampDaysAgo(0);

  // Build the WHERE clause and parameters dynamically
  let whereClause = `
            t.deletedTweetAt IS NULL
            AND t.text NOT LIKE ?
            AND t.username = ?
            AND t.createdAt <= ?
        `;
  const params: (string | number)[] = [
    "RT @%",
    controller.account.username,
    daysOldTimestamp,
  ];

  if (controller.account.deleteTweetsLikesThresholdEnabled) {
    whereClause += " AND t.likeCount <= ?";
    params.push(controller.account.deleteTweetsLikesThreshold);
  }
  if (controller.account.deleteTweetsRetweetsThresholdEnabled) {
    whereClause += " AND t.retweetCount <= ?";
    params.push(controller.account.deleteTweetsRetweetsThreshold);
  }

  // Fetch tweets using the helper function
  const tweets = controller.fetchTweetsWithMediaAndURLs(whereClause, params);

  return { tweets };
}
