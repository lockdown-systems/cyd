import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type {
  XAPIInboxTimeline,
  XAPIInboxInitialState,
  XAPIUser,
  XAPIConversation,
} from "../../types";
import { indexUser } from "./indexUser";
import { indexConversation } from "./indexConversation";

export async function indexParseConversationsResponseData(
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
    log.warn(
      "XAccountController.indexParseConversationsResponseData: RATE LIMITED",
    );
    controller.mitmController.responseData[responseIndex].processed = true;
    return false;
  }

  // Process the response
  if (
    // XAPIInboxTimeline
    (responseData.url.includes("/i/api/1.1/dm/inbox_timeline/trusted.json") ||
      responseData.url.includes(
        "/i/api/1.1/dm/inbox_timeline/untrusted.json",
      ) ||
      // XAPIInboxInitialState
      responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json") ||
      responseData.url.includes("/i/api/1.1/dm/user_updates.json")) &&
    responseData.status == 200
  ) {
    let users: Record<string, XAPIUser>;
    let conversations: Record<string, XAPIConversation>;
    if (
      responseData.url.includes("/i/api/1.1/dm/inbox_initial_state.json") ||
      responseData.url.includes("/i/api/1.1/dm/user_updates.json")
    ) {
      const inbox_initial_state: XAPIInboxInitialState = JSON.parse(
        responseData.responseBody,
      );
      if (!inbox_initial_state.inbox_initial_state) {
        // Skip this response
        return true;
      }
      users = inbox_initial_state.inbox_initial_state.users;
      conversations = inbox_initial_state.inbox_initial_state.conversations;
      controller.thereIsMore =
        inbox_initial_state.inbox_initial_state.inbox_timelines.trusted
          ?.status == "HAS_MORE";
    } else {
      const inbox_timeline: XAPIInboxTimeline = JSON.parse(
        responseData.responseBody,
      );
      users = inbox_timeline.inbox_timeline.users;
      conversations = inbox_timeline.inbox_timeline.conversations;
      controller.thereIsMore =
        inbox_timeline.inbox_timeline.status == "HAS_MORE";
    }

    // Add the users
    if (users) {
      log.info(
        `XAccountController.indexParseConversationsResponseData: adding ${Object.keys(users).length} users`,
      );
      for (const userID in users) {
        const user = users[userID];
        await indexUser(controller, user);
      }
    } else {
      log.info(
        "XAccountController.indexParseConversationsResponseData: no users",
      );
    }

    // Add the conversations
    if (conversations) {
      log.info(
        `XAccountController.indexParseConversationsResponseData: adding ${Object.keys(conversations).length} conversations`,
      );
      for (const conversationID in conversations) {
        const conversation = conversations[conversationID];
        indexConversation(controller, conversation);
      }
    } else {
      log.info(
        "XAccountController.indexParseConversationsResponseData: no conversations",
      );
    }

    controller.mitmController.responseData[responseIndex].processed = true;
    log.debug(
      "XAccountController.indexParseConversationsResponseData: processed",
      responseIndex,
    );
  } else {
    // Skip response
    controller.mitmController.responseData[responseIndex].processed = true;
  }

  return true;
}
