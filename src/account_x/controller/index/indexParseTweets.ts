import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type { XProgress } from "../../../shared_types";
import { indexParseTweetsResponseData } from "./indexParseTweetsResponseData";

// Parses the response data so far to index tweets that have been collected
// Returns the progress object
// This works for tweets, likes, and bookmarks
export async function indexParseTweets(
  controller: XAccountController,
): Promise<XProgress> {
  await controller.mitmController.clearProcessed();
  log.info(
    `XAccountController.indexParseTweets: parsing ${controller.mitmController.responseData.length} responses`,
  );

  for (let i = 0; i < controller.mitmController.responseData.length; i++) {
    indexParseTweetsResponseData(controller, i);
  }

  return controller.progress;
}
