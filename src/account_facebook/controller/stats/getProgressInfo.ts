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

  const totalWallPostsUntaggedConfig: string | null =
    await controller.getConfig("totalWallPostsUntagged");
  let totalWallPostsUntagged: number = 0;
  if (totalWallPostsUntaggedConfig) {
    totalWallPostsUntagged = parseInt(totalWallPostsUntaggedConfig);
  }

  const totalWallPostsHiddenConfig: string | null = await controller.getConfig(
    "totalWallPostsHidden",
  );
  let totalWallPostsHidden: number = 0;
  if (totalWallPostsHiddenConfig) {
    totalWallPostsHidden = parseInt(totalWallPostsHiddenConfig);
  }

  const progressInfo = emptyFacebookProgressInfo();
  progressInfo.accountUUID = controller.accountUUID;
  progressInfo.totalWallPostsDeleted = totalWallPostsDeleted;
  progressInfo.totalWallPostsUntagged = totalWallPostsUntagged;
  progressInfo.totalWallPostsHidden = totalWallPostsHidden;
  return progressInfo;
}
