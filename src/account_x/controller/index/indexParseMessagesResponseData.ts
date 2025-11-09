import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type {
  XAPIConversationTimeline,
  XAPIInboxInitialState,
  XAPIMessage,
} from "../../types";
import { indexMessage } from "./indexMessage";

export async function indexParseMessagesResponseData(
  controller: XAccountController,
  responseIndex: number,
): Promise<boolean> {
  const responseData = controller.mitmController.responseData[responseIndex];

  // Already processed?
  if (responseData.processed) {
    return true;
  }

  // Rate limited?
  if (responseData.status == 429) {
    log.warn("XAccountController.indexParseMessagesResponseData: RATE LIMITED");
    controller.mitmController.responseData[responseIndex].processed = true;
    return false;
  }

  // Process the response
  if (
    // XAPIConversationTimeline
    (responseData.url.includes("/i/api/1.1/dm/conversation/") ||
      // XAPIInboxInitialState
      responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json")) &&
    responseData.status == 200
  ) {
    log.debug(
      "XAccountController.indexParseMessagesResponseData",
      responseIndex,
    );
    let entries: XAPIMessage[];

    if (responseData.url.includes("/i/api/1.1/dm/conversation/")) {
      // XAPIConversationTimeline
      const conversationTimeline: XAPIConversationTimeline = JSON.parse(
        responseData.responseBody,
      );
      if (!conversationTimeline.conversation_timeline.entries) {
        // Skip this response
        return true;
      }
      entries = conversationTimeline.conversation_timeline.entries;
    } else {
      // XAPIInboxInitialState
      const inbox_initial_state: XAPIInboxInitialState = JSON.parse(
        responseData.responseBody,
      );
      if (!inbox_initial_state.inbox_initial_state) {
        // Skip this response
        return true;
      }
      entries = inbox_initial_state.inbox_initial_state.entries;
    }

    // Add the messages
    if (entries) {
      log.info(
        `XAccountController.indexParseMessagesResponseData: adding ${entries.length} messages`,
      );
      for (let i = 0; i < entries.length; i++) {
        const message = entries[i];
        indexMessage(controller, message);
      }
    } else {
      log.info("XAccountController.indexParseMessagesResponseData: no entries");
    }

    controller.mitmController.responseData[responseIndex].processed = true;
    log.debug(
      "XAccountController.indexParseMessagesResponseData: processed",
      responseIndex,
    );
  } else {
    // Skip response
    log.debug(
      "XAccountController.indexParseMessagesResponseData: skipping response",
      responseData.url,
    );
    controller.mitmController.responseData[responseIndex].processed = true;
  }

  return true;
}
