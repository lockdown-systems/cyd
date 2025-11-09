import log from "electron-log/main";
import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XConversationRow } from "../../types";
import { deleteDMsMarkDeleted } from "./deleteDMsMarkDeleted";

export async function deleteDMsMarkAllDeleted(
  controller: XAccountController,
): Promise<void> {
  if (!controller.db) {
    controller.initDB();
  }

  const conversations = exec(
    controller.db,
    "SELECT conversationID FROM conversation WHERE deletedAt IS NULL",
    [],
    "all",
  ) as XConversationRow[];
  log.info(
    `XAccountController.deleteDMsMarkAllDeleted: marking ${conversations.length} conversations deleted`,
  );

  for (let i = 0; i < conversations.length; i++) {
    deleteDMsMarkDeleted(controller, conversations[i].conversationID);
  }
}
