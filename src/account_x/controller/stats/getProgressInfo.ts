import { exec, Sqlite3Count } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import { XProgressInfo, emptyXProgressInfo } from "../../../shared_types";

export async function getProgressInfo(
  controller: XAccountController,
): Promise<XProgressInfo> {
  if (!controller.db) {
    controller.initDB();
  }

  const totalTweetsIndexed: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE username = ? AND text NOT LIKE ? AND isLiked = ?",
    [controller.account?.username || "", "RT @%", 0],
    "get",
  ) as Sqlite3Count;
  const totalTweetsArchived: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE archivedAt IS NOT NULL",
    [],
    "get",
  ) as Sqlite3Count;
  const totalRetweetsIndexed: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ?",
    ["RT @%"],
    "get",
  ) as Sqlite3Count;
  const totalLikesIndexed: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ?",
    [1],
    "get",
  ) as Sqlite3Count;
  const totalBookmarksIndexed: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ?",
    [1],
    "get",
  ) as Sqlite3Count;
  const totalUnknownIndexed: Sqlite3Count = exec(
    controller.db,
    `SELECT COUNT(*) AS count FROM tweet
           WHERE id NOT IN (
               SELECT id FROM tweet WHERE username = ? AND text NOT LIKE ? AND isLiked = ?
               UNION
               SELECT id FROM tweet WHERE text LIKE ?
               UNION
               SELECT id FROM tweet WHERE isLiked = ?
           )`,
    [controller.account?.username || "", "RT @%", 0, "RT @%", 1],
    "get",
  ) as Sqlite3Count;
  const totalTweetsDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE username = ? AND text NOT LIKE ? AND isLiked = ? AND deletedTweetAt IS NOT NULL",
    [controller.account?.username || "", "RT @%", 0],
    "get",
  ) as Sqlite3Count;
  const totalRetweetsDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedRetweetAt IS NOT NULL",
    ["RT @%"],
    "get",
  ) as Sqlite3Count;
  const totalLikesDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedLikeAt IS NOT NULL",
    [1],
    "get",
  ) as Sqlite3Count;
  const totalBookmarksDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ? AND deletedBookmarkAt IS NOT NULL",
    [1],
    "get",
  ) as Sqlite3Count;
  const totalTweetsMigratedToBluesky: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet_bsky_migration",
    [],
    "get",
  ) as Sqlite3Count;

  const totalConversationsDeletedConfig: string | null =
    await controller.getConfig("totalConversationsDeleted");
  let totalConversationsDeleted: number = 0;
  if (totalConversationsDeletedConfig) {
    totalConversationsDeleted = parseInt(totalConversationsDeletedConfig);
  }

  const totalAccountsUnfollowedConfig: string | null =
    await controller.getConfig("totalAccountsUnfollowed");
  let totalAccountsUnfollowed: number = 0;
  if (totalAccountsUnfollowedConfig) {
    totalAccountsUnfollowed = parseInt(totalAccountsUnfollowedConfig);
  }

  const progressInfo = emptyXProgressInfo();
  progressInfo.accountUUID = controller.accountUUID;
  progressInfo.totalTweetsIndexed = totalTweetsIndexed.count;
  progressInfo.totalTweetsArchived = totalTweetsArchived.count;
  progressInfo.totalRetweetsIndexed = totalRetweetsIndexed.count;
  progressInfo.totalLikesIndexed = totalLikesIndexed.count;
  progressInfo.totalBookmarksIndexed = totalBookmarksIndexed.count;
  progressInfo.totalUnknownIndexed = totalUnknownIndexed.count;
  progressInfo.totalTweetsDeleted = totalTweetsDeleted.count;
  progressInfo.totalRetweetsDeleted = totalRetweetsDeleted.count;
  progressInfo.totalLikesDeleted = totalLikesDeleted.count;
  progressInfo.totalBookmarksDeleted = totalBookmarksDeleted.count;
  progressInfo.totalConversationsDeleted = totalConversationsDeleted;
  progressInfo.totalAccountsUnfollowed = totalAccountsUnfollowed;
  progressInfo.totalTweetsMigratedToBluesky =
    totalTweetsMigratedToBluesky.count;
  return progressInfo;
}
