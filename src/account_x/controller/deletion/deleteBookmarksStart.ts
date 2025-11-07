import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type { XDeleteTweetsStartResponse } from "../../../shared_types";

// When you start deleting bookmarks, return a list of tweets to unbookmark
export async function deleteBookmarksStart(
  controller: XAccountController,
): Promise<XDeleteTweetsStartResponse> {
  log.info("XAccountController.deleteBookmarksStart");

  if (!controller.db) {
    controller.initDB();
  }

  if (!controller.account) {
    throw new Error("Account not found");
  }

  const tweets = controller.fetchTweetsWithMediaAndURLs(
    "t.deletedBookmarkAt IS NULL AND t.isBookmarked = ?",
    [1],
  );

  return { tweets };
}
