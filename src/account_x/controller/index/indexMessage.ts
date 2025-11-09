import log from "electron-log/main";
import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XAPIMessage } from "../../types";

export function indexMessage(
  controller: XAccountController,
  message: XAPIMessage,
): void {
  log.debug("XAccountController.indexMessage", message);
  if (!controller.db) {
    controller.initDB();
  }

  if (!message.message) {
    // skip
    return;
  }

  // Insert of replace message
  exec(
    controller.db,
    "INSERT OR REPLACE INTO message (messageID, conversationID, createdAt, senderID, text, deletedAt) VALUES (?, ?, ?, ?, ?, ?)",
    [
      message.message.id,
      message.message.conversation_id,
      new Date(Number(message.message.time)),
      message.message.message_data.sender_id,
      message.message.message_data.text,
      null,
    ],
  );

  // Update progress
  const insertMessageID: string = message.message.id;
  if (
    !controller.messageIDsIndexed.some(
      (messageID) => messageID === insertMessageID,
    )
  ) {
    controller.messageIDsIndexed.push(insertMessageID);
  }

  controller.progress.messagesIndexed = controller.messageIDsIndexed.length;
}
