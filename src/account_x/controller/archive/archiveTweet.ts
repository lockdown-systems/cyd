import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";

// Save the tweet's archivedAt timestamp
export async function archiveTweet(
  controller: XAccountController,
  tweetID: string,
): Promise<void> {
  if (!controller.db) {
    controller.initDB();
  }

  exec(controller.db!, "UPDATE tweet SET archivedAt = ? WHERE tweetID = ?", [
    new Date(),
    tweetID,
  ]);
}
