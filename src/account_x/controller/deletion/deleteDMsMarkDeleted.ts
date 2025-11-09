import log from "electron-log/main";
import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";

export function deleteDMsMarkDeleted(
  controller: XAccountController,
  conversationID: string,
): void {
  log.info(
    `XAccountController.deleteDMsMarkDeleted: conversationID=${conversationID}`,
  );

  if (!controller.db) {
    controller.initDB();
  }

  // Mark the conversation as deleted
  exec(
    controller.db,
    "UPDATE conversation SET deletedAt = ? WHERE conversationID = ?",
    [new Date(), conversationID],
  );

  // Mark all the messages as deleted
  exec(
    controller.db,
    "UPDATE message SET deletedAt = ? WHERE conversationID = ? AND deletedAt is NULL",
    [new Date(), conversationID],
  );

  // Update the progress
  controller.progress.conversationsDeleted++;
}
