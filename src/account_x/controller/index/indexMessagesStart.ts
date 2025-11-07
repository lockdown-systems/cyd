import log from "electron-log/main";
import { exec, Sqlite3Count } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XIndexMessagesStartResponse } from "../../../shared_types";
import type { XConversationRow } from "../../types";

// When you start indexing DMs, return a list of DM conversationIDs to index
export async function indexMessagesStart(
  controller: XAccountController,
): Promise<XIndexMessagesStartResponse> {
  if (!controller.db) {
    controller.initDB();
  }

  // Select just the conversations that need to be indexed
  const conversationIDs: XConversationRow[] = exec(
    controller.db,
    "SELECT conversationID FROM conversation WHERE shouldIndexMessages = ? AND deletedAt IS NULL",
    [1],
    "all",
  ) as XConversationRow[];
  const totalConversations: Sqlite3Count = exec(
    controller.db,
    "SELECT COUNT(*) AS count FROM conversation WHERE deletedAt IS NULL",
    [],
    "get",
  ) as Sqlite3Count;
  log.debug(
    "XAccountController.indexMessagesStart",
    conversationIDs,
    totalConversations,
  );
  return {
    conversationIDs: conversationIDs.map((row) => row.conversationID),
    totalConversations: totalConversations.count,
  };
}
