import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type {
  XAPIData,
  XAPIBookmarksData,
  XAPITimeline,
  XAPIUserCore,
  XAPILegacyTweet,
} from "../../types";
import {
  isXAPIBookmarksData,
  isXAPIData,
  isXAPIData_v2,
  isXAPIError,
} from "../../types";
import { indexTweet } from "./indexTweet";

// Returns false if the loop should stop
export function indexParseTweetsResponseData(
  controller: XAccountController,
  responseIndex: number,
): boolean {
  const responseData = controller.mitmController.responseData[responseIndex];

  // Already processed?
  if (responseData.processed) {
    return true;
  }

  // Rate limited?
  if (responseData.status == 429) {
    log.warn("XAccountController.indexParseTweetsResponseData: RATE LIMITED");
    controller.mitmController.responseData[responseIndex].processed = true;
    return false;
  }

  // Process the next response
  if (
    // Tweets
    (responseData.url.includes("/UserTweetsAndReplies?") ||
      // Likes
      responseData.url.includes("/Likes?") ||
      // Bookmarks
      responseData.url.includes("/Bookmarks?")) &&
    responseData.status == 200
  ) {
    // For likes and tweets, body is XAPIData
    // For bookmarks, body is XAPIBookmarksData
    const body: XAPIData | XAPIBookmarksData = JSON.parse(
      responseData.responseBody,
    );
    let timeline: XAPITimeline;
    if (isXAPIBookmarksData(body)) {
      timeline = (body as XAPIBookmarksData).data.bookmark_timeline_v2;
    } else if (isXAPIData(body)) {
      timeline = (body as XAPIData).data.user.result.timeline as XAPITimeline;
    } else if (isXAPIData_v2(body)) {
      timeline = (body as XAPIData).data.user.result
        .timeline_v2 as XAPITimeline;
    } else if (isXAPIError(body)) {
      log.error(
        "XAccountController.indexParseTweetsResponseData: XAPIError",
        body,
      );
      controller.mitmController.responseData[responseIndex].processed = true;
      return false;
    } else {
      log.error(
        "XAccountController.indexParseTweetsResponseData: Invalid response data",
        responseData.responseBody,
      );
      throw new Error("Invalid response data");
    }

    // Loop through instructions
    timeline.timeline.instructions.forEach((instructions) => {
      if (instructions["type"] != "TimelineAddEntries") {
        return;
      }

      // If we only have two entries, they both have entryType of TimelineTimelineCursor (one cursorType of Top and the other of Bottom), this means there are no more tweets
      if (
        instructions.entries?.length == 2 &&
        instructions.entries[0].content.entryType == "TimelineTimelineCursor" &&
        instructions.entries[0].content.cursorType == "Top" &&
        instructions.entries[1].content.entryType == "TimelineTimelineCursor" &&
        instructions.entries[1].content.cursorType == "Bottom"
      ) {
        controller.thereIsMore = false;
        return;
      }

      // Loop through the entries
      instructions.entries?.forEach((entries) => {
        let userCore: XAPIUserCore | undefined;
        let tweetLegacy: XAPILegacyTweet | undefined;

        if (entries.content.entryType == "TimelineTimelineModule") {
          entries.content.items?.forEach((item) => {
            if (
              item.item.itemContent.tweet_results &&
              item.item.itemContent.tweet_results.result &&
              item.item.itemContent.tweet_results.result.core &&
              item.item.itemContent.tweet_results.result.core.user_results &&
              item.item.itemContent.tweet_results.result.core.user_results
                .result &&
              item.item.itemContent.tweet_results.result.core.user_results
                .result.core &&
              item.item.itemContent.tweet_results.result.legacy
            ) {
              userCore =
                item.item.itemContent.tweet_results.result.core.user_results
                  .result.core;
              tweetLegacy = item.item.itemContent.tweet_results.result.legacy;
            }

            if (
              item.item.itemContent.tweet_results &&
              item.item.itemContent.tweet_results.result &&
              item.item.itemContent.tweet_results.result.tweet &&
              item.item.itemContent.tweet_results.result.tweet.core &&
              item.item.itemContent.tweet_results.result.tweet.core
                .user_results &&
              item.item.itemContent.tweet_results.result.tweet.core.user_results
                .result &&
              item.item.itemContent.tweet_results.result.tweet.core.user_results
                .result.core &&
              item.item.itemContent.tweet_results.result.tweet.legacy
            ) {
              userCore =
                item.item.itemContent.tweet_results.result.tweet.core
                  .user_results.result.core;
              tweetLegacy =
                item.item.itemContent.tweet_results.result.tweet.legacy;
            }

            if (userCore && tweetLegacy) {
              indexTweet(controller, responseIndex, userCore, tweetLegacy);
            }
          });
        } else if (entries.content.entryType == "TimelineTimelineItem") {
          if (
            entries.content.itemContent &&
            entries.content.itemContent.tweet_results &&
            entries.content.itemContent.tweet_results.result &&
            entries.content.itemContent.tweet_results.result.core &&
            entries.content.itemContent.tweet_results.result.core
              .user_results &&
            entries.content.itemContent.tweet_results.result.core.user_results
              .result &&
            entries.content.itemContent.tweet_results.result.core.user_results
              .result.legacy &&
            entries.content.itemContent.tweet_results.result.core.user_results
              .result.core &&
            entries.content.itemContent.tweet_results.result.legacy
          ) {
            userCore =
              entries.content.itemContent.tweet_results.result.core.user_results
                .result.core;
            tweetLegacy =
              entries.content.itemContent.tweet_results.result.legacy;
          }

          if (
            entries.content.itemContent &&
            entries.content.itemContent.tweet_results &&
            entries.content.itemContent.tweet_results.result &&
            entries.content.itemContent.tweet_results.result.tweet &&
            entries.content.itemContent.tweet_results.result.tweet.core &&
            entries.content.itemContent.tweet_results.result.tweet.core
              .user_results &&
            entries.content.itemContent.tweet_results.result.tweet.core
              .user_results.result &&
            entries.content.itemContent.tweet_results.result.tweet.core
              .user_results.result.legacy &&
            entries.content.itemContent.tweet_results.result.tweet.core
              .user_results.result.core &&
            entries.content.itemContent.tweet_results.result.tweet.legacy
          ) {
            userCore =
              entries.content.itemContent.tweet_results.result.tweet.core
                .user_results.result.core;
            tweetLegacy =
              entries.content.itemContent.tweet_results.result.tweet.legacy;
          }

          if (userCore && tweetLegacy) {
            indexTweet(controller, responseIndex, userCore, tweetLegacy);
          }
        }
      });
    });

    controller.mitmController.responseData[responseIndex].processed = true;
    log.debug(
      "XAccountController.indexParseTweetsResponseData: processed",
      responseIndex,
    );
  } else {
    // Skip response
    controller.mitmController.responseData[responseIndex].processed = true;
  }

  return true;
}
