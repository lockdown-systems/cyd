import type { FacebookAccountController } from "../../facebook_account_controller";
import {
  FacebookProgressInfo,
  emptyFacebookProgressInfo,
} from "../../../shared_types";

export async function getProgressInfo(
  controller: FacebookAccountController,
): Promise<FacebookProgressInfo> {
  if (!controller.db) {
    controller.initDB();
  }

  const totalWallPostsDeletedConfig: string | null = await controller.getConfig(
    "totalWallPostsDeleted",
  );
  let totalWallPostsDeleted: number = 0;
  if (totalWallPostsDeletedConfig) {
    totalWallPostsDeleted = parseInt(totalWallPostsDeletedConfig);
  }

  const progressInfo = emptyFacebookProgressInfo();
  progressInfo.accountUUID = controller.accountUUID;
  progressInfo.totalWallPostsDeleted = totalWallPostsDeleted;
  return progressInfo;
}
