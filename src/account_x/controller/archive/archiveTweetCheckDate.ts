import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XTweetRow } from "../../types";

// If the tweet doesn't have an archivedAt timestamp, set one
export async function archiveTweetCheckDate(
  controller: XAccountController,
  tweetID: string,
): Promise<void> {
  if (!controller.db) {
    controller.initDB();
  }

  const tweet: XTweetRow = exec(
    controller.db!,
    "SELECT * FROM tweet WHERE tweetID = ?",
    [tweetID],
    "get",
  ) as XTweetRow;
  if (!tweet.archivedAt) {
    exec(controller.db!, "UPDATE tweet SET archivedAt = ? WHERE tweetID = ?", [
      new Date(),
      tweetID,
    ]);
  }
}
