import log from "electron-log/main";
import Database from "better-sqlite3";
import { exec } from "../../database";
import { XAPIConversation, XConversationRow } from "../types";

/**
 * Index a conversation from the X API into the database.
 * This method handles both inserting new conversations and updating existing ones.
 */
export function indexConversationIntoDB(
  db: Database.Database,
  incrementProgress: () => void,
  conversation: XAPIConversation,
): void {
  log.debug("XAccountController.indexConversation", conversation);

  // Have we seen this conversation before?
  const existing: XConversationRow[] = exec(
    db,
    "SELECT minEntryID, maxEntryID FROM conversation WHERE conversationID = ?",
    [conversation.conversation_id],
    "all",
  ) as XConversationRow[];
  if (existing.length > 0) {
    log.debug(
      "XAccountController.indexConversation: conversation already indexed, but needs to be updated",
      {
        oldMinEntryID: existing[0].minEntryID,
        oldMaxEntryID: existing[0].maxEntryID,
        newMinEntryID: conversation.min_entry_id,
        newMaxEntryID: conversation.max_entry_id,
      },
    );

    // Update the conversation
    exec(
      db,
      "UPDATE conversation SET sortTimestamp = ?, type = ?, minEntryID = ?, maxEntryID = ?, isTrusted = ?, updatedInDatabaseAt = ?, shouldIndexMessages = ?, deletedAt = NULL WHERE conversationID = ?",
      [
        conversation.sort_timestamp,
        conversation.type,
        conversation.min_entry_id,
        conversation.max_entry_id,
        conversation.trusted ? 1 : 0,
        new Date(),
        1,
        conversation.conversation_id,
      ],
    );
  } else {
    // Add the conversation
    exec(
      db,
      "INSERT INTO conversation (conversationID, type, sortTimestamp, minEntryID, maxEntryID, isTrusted, addedToDatabaseAt, shouldIndexMessages) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        conversation.conversation_id,
        conversation.type,
        conversation.sort_timestamp,
        conversation.min_entry_id,
        conversation.max_entry_id,
        conversation.trusted ? 1 : 0,
        new Date(),
        1,
      ],
    );
  }

  // Delete participants
  exec(db, "DELETE FROM conversation_participant WHERE conversationID = ?", [
    conversation.conversation_id,
  ]);

  // Add the participants
  conversation.participants.forEach((participant) => {
    exec(
      db,
      "INSERT INTO conversation_participant (conversationID, userID) VALUES (?, ?)",
      [conversation.conversation_id, participant.user_id],
    );
  });

  // Update progress
  incrementProgress();
}
