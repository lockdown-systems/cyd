import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type { XDeleteTweetsStartResponse } from "../../../shared_types";

// When you start deleting likes, return a list of tweets to unlike
export async function deleteLikesStart(
  controller: XAccountController,
): Promise<XDeleteTweetsStartResponse> {
  log.info("XAccountController.deleteLikesStart");

  if (!controller.db) {
    controller.initDB();
  }

  if (!controller.account) {
    throw new Error("Account not found");
  }

  const tweets = controller.fetchTweetsWithMediaAndURLs(
    "t.deletedLikeAt IS NULL AND t.isLiked = ?",
    [1],
  );

  return { tweets };
}
