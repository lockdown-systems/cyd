import type { FacebookAccountController } from "../../facebook_account_controller";
import {
  FacebookProgressInfo,
  emptyFacebookProgressInfo,
  FACEBOOK_DELETE_COUNTERS,
} from "../../../shared_types";

export async function getProgressInfo(
  controller: FacebookAccountController,
): Promise<FacebookProgressInfo> {
  if (!controller.db) {
    controller.initDB();
  }

  // temp: we need to update the server, currently it is summing all deletion
  // activity and stuffing it into totalWallPostsDeleted
  let totalWallPostsDeleted = 0;
  for (const counter of FACEBOOK_DELETE_COUNTERS) {
    const value = await controller.getConfig(`total_${counter}`);
    if (value) {
      totalWallPostsDeleted += parseInt(value);
    }
  }

  const progressInfo = emptyFacebookProgressInfo();
  progressInfo.accountUUID = controller.accountUUID;
  progressInfo.totalWallPostsDeleted = totalWallPostsDeleted;
  progressInfo.totalWallPostsUntagged = 0;
  progressInfo.totalWallPostsHidden = 0;
  return progressInfo;
}
