import CydAPIClient from "../../cyd-api-client";
import type { DeviceInfo } from "./types";
import { FacebookProgressInfo } from "../../shared_types";

export async function facebookPostProgress(
  apiClient: CydAPIClient,
  deviceInfo: DeviceInfo | null,
  accountID: number,
) {
  const progressInfo: FacebookProgressInfo =
    await window.electron.Facebook.getProgressInfo(accountID);
  const postFacebookProgressResp = await apiClient.postFacebookProgress(
    {
      account_uuid: progressInfo.accountUUID,
      total_wall_posts_deleted: progressInfo.totalWallPostsDeleted,
    },
    deviceInfo?.valid ? true : false,
  );

  if (
    postFacebookProgressResp !== true &&
    postFacebookProgressResp !== false &&
    postFacebookProgressResp.error
  ) {
    // Silently log the error and continue
    console.error(
      "facebookPostProgress",
      "failed to post progress to the API",
      postFacebookProgressResp.message,
    );
  }
}

export async function facebookGetLastDelete(
  accountID: number,
): Promise<Date | null> {
  const lastFinishedJob_deleteWallPosts =
    await window.electron.Facebook.getConfig(
      accountID,
      "lastFinishedJob_deleteWallPosts",
    );
  if (lastFinishedJob_deleteWallPosts) {
    return new Date(lastFinishedJob_deleteWallPosts);
  }
  return null;
}
