import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";

// Save the tweet's deleted*At timestamp
export async function deleteTweet(
  controller: XAccountController,
  tweetID: string,
  deleteType: string,
): Promise<void> {
  if (!controller.db) {
    controller.initDB();
  }

  if (deleteType == "tweet") {
    exec(
      controller.db,
      "UPDATE tweet SET deletedTweetAt = ? WHERE tweetID = ?",
      [new Date(), tweetID],
    );
  } else if (deleteType == "retweet") {
    exec(
      controller.db,
      "UPDATE tweet SET deletedRetweetAt = ? WHERE tweetID = ?",
      [new Date(), tweetID],
    );
  } else if (deleteType == "like") {
    exec(
      controller.db,
      "UPDATE tweet SET deletedLikeAt = ? WHERE tweetID = ?",
      [new Date(), tweetID],
    );
  } else if (deleteType == "bookmark") {
    exec(
      controller.db,
      "UPDATE tweet SET deletedBookmarkAt = ? WHERE tweetID = ?",
      [new Date(), tweetID],
    );
  } else {
    throw new Error("Invalid deleteType");
  }
}
