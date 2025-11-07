import log from "electron-log/main";
import { getTimestampDaysAgo } from "../../../util";
import type { XAccountController } from "../../x_account_controller";
import type { XDeleteTweetsStartResponse } from "../../../shared_types";

// When you start deleting retweets, return a list of tweets to delete
export async function deleteRetweetsStart(
  controller: XAccountController,
): Promise<XDeleteTweetsStartResponse> {
  log.info("XAccountController.deleteRetweetsStart");

  if (!controller.db) {
    controller.initDB();
  }

  if (!controller.account) {
    throw new Error("Account not found");
  }

  const daysOldTimestamp = controller.account.deleteRetweetsDaysOldEnabled
    ? getTimestampDaysAgo(controller.account.deleteRetweetsDaysOld)
    : getTimestampDaysAgo(0);

  const tweets = controller.fetchTweetsWithMediaAndURLs(
    "t.deletedRetweetAt IS NULL AND t.text LIKE ? AND t.createdAt <= ?",
    ["RT @%", daysOldTimestamp],
  );

  return { tweets };
}
