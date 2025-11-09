import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type { XProgress } from "../../../shared_types";
import { indexParseMessagesResponseData } from "./indexParseMessagesResponseData";

export async function indexParseMessages(
  controller: XAccountController,
): Promise<XProgress> {
  log.info(
    `XAccountController.indexParseMessages: parsing ${controller.mitmController.responseData.length} responses`,
  );

  controller.progress.currentJob = "indexMessages";
  controller.progress.isIndexMessagesFinished = false;

  for (let i = 0; i < controller.mitmController.responseData.length; i++) {
    await indexParseMessagesResponseData(controller, i);
  }

  return controller.progress;
}
