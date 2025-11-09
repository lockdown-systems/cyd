import log from "electron-log/main";
import { exec, Sqlite3Count } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import { XDatabaseStats, emptyXDatabaseStats } from "../../../shared_types";

export async function getDatabaseStats(
  controller: XAccountController,
): Promise<XDatabaseStats> {
  const databaseStats = emptyXDatabaseStats();
  if (!controller.account?.username) {
    log.debug("XAccountController.getDatabaseStats: no account");
    return databaseStats;
  }

  if (!controller.db) {
    controller.initDB();
  }

  const username = controller.account.username;

  const tweetsSaved: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND isLiked = ? AND username = ?",
    ["RT @%", 0, username],
    "get",
  ) as Sqlite3Count;
  const tweetsDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE text NOT LIKE ? AND isLiked = ? AND username = ? AND deletedTweetAt IS NOT NULL",
    ["RT @%", 0, username],
    "get",
  ) as Sqlite3Count;
  const retweetsSaved: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ?",
    ["RT @%"],
    "get",
  ) as Sqlite3Count;
  const retweetsDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE text LIKE ? AND deletedRetweetAt IS NOT NULL",
    ["RT @%"],
    "get",
  ) as Sqlite3Count;
  const likesSaved: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ?",
    [1],
    "get",
  ) as Sqlite3Count;
  const likesDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isLiked = ? AND deletedLikeAt IS NOT NULL",
    [1],
    "get",
  ) as Sqlite3Count;
  const bookmarksSaved: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ?",
    [1],
    "get",
  ) as Sqlite3Count;
  const bookmarksDeleted: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet WHERE isBookmarked = ? AND deletedBookmarkAt IS NOT NULL",
    [1],
    "get",
  ) as Sqlite3Count;
  const conversationsDeleted = parseInt(
    (await controller.getConfig("totalConversationsDeleted")) || "0",
  );
  const accountsUnfollowed = parseInt(
    (await controller.getConfig("totalAccountsUnfollowed")) || "0",
  );
  const tweetsMigratedToBluesky: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM tweet_bsky_migration",
    [],
    "get",
  ) as Sqlite3Count;

  databaseStats.tweetsSaved = tweetsSaved.count;
  databaseStats.tweetsDeleted = tweetsDeleted.count;
  databaseStats.retweetsSaved = retweetsSaved.count;
  databaseStats.retweetsDeleted = retweetsDeleted.count;
  databaseStats.likesSaved = likesSaved.count;
  databaseStats.likesDeleted = likesDeleted.count;
  databaseStats.bookmarksSaved = bookmarksSaved.count;
  databaseStats.bookmarksDeleted = bookmarksDeleted.count;
  databaseStats.conversationsDeleted = conversationsDeleted;
  databaseStats.accountsUnfollowed = accountsUnfollowed;
  databaseStats.tweetsMigratedToBluesky = tweetsMigratedToBluesky.count;
  return databaseStats;
}
