import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";

// Set the conversation's shouldIndexMessages to false
export async function indexConversationFinished(
  controller: XAccountController,
  conversationID: string,
): Promise<void> {
  if (!controller.db) {
    controller.initDB();
  }

  exec(
    controller.db,
    "UPDATE conversation SET shouldIndexMessages = ? WHERE conversationID = ?",
    [0, conversationID],
  );
}
