import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import {
  XDeleteReviewStats,
  emptyXDeleteReviewStats,
} from "../../../shared_types";

export async function getDeleteReviewStats(
  controller: XAccountController,
): Promise<XDeleteReviewStats> {
  const deleteReviewStats = emptyXDeleteReviewStats();
  if (!controller.account?.username) {
    log.info("XAccountController.getDeleteReviewStats: no account");
    return deleteReviewStats;
  }

  if (!controller.db) {
    controller.initDB();
  }

  const deleteTweetsStartResponse = await controller.deleteTweetsStart();
  const deleteRetweetStartResponse = await controller.deleteRetweetsStart();
  const deleteLikesStartResponse = await controller.deleteLikesStart();
  const deleteBookmarksStartResponse = await controller.deleteBookmarksStart();

  deleteReviewStats.tweetsToDelete = deleteTweetsStartResponse.tweets.length;
  deleteReviewStats.retweetsToDelete = deleteRetweetStartResponse.tweets.length;
  deleteReviewStats.likesToDelete = deleteLikesStartResponse.tweets.length;
  deleteReviewStats.bookmarksToDelete =
    deleteBookmarksStartResponse.tweets.length;
  return deleteReviewStats;
}
