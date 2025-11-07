import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type { XProgress } from "../../../shared_types";
import { indexParseConversationsResponseData } from "./indexParseConversationsResponseData";

// Returns true if more data needs to be indexed
// Returns false if we are caught up
export async function indexParseConversations(
  controller: XAccountController,
): Promise<XProgress> {
  await controller.mitmController.clearProcessed();
  log.info(
    `XAccountController.indexParseConversations: parsing ${controller.mitmController.responseData.length} responses`,
  );

  controller.progress.currentJob = "indexConversations";
  controller.progress.isIndexMessagesFinished = false;

  for (let i = 0; i < controller.mitmController.responseData.length; i++) {
    await indexParseConversationsResponseData(controller, i);
  }

  return controller.progress;
}
