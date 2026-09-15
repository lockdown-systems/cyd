import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type {
  XAPIData,
  XAPIBookmarksData,
  XAPIError,
  XAPIItemContent,
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
import {
  DEFAULT_X_RATE_LIMIT_SECONDS,
  type ResponseData,
} from "../../../shared_types";
import { indexTweet } from "./indexTweet";

// The timeline operations Cyd reads. On 2026-09-14 X split
// UserTweetsAndReplies into UserOriginalsTimeline (the profile timeline),
// UserRepliesTimeline (/with_replies), and UserRepostsTimeline (/reposts);
// see docs/x-capture/findings-20260914.md. X was not seen issuing
// UserTweetsAndReplies once in that capture; it stays here so that responses
// recorded before then still parse.
const TIMELINE_OPERATIONS = [
  "UserOriginalsTimeline",
  "UserRepliesTimeline",
  "UserRepostsTimeline",
  "UserTweetsAndReplies",
  "Likes",
  "Bookmarks",
];

// X's error code for a rate limit
const RATE_LIMIT_ERROR_CODE = 88;

function isTimelineResponse(responseData: ResponseData): boolean {
  return TIMELINE_OPERATIONS.some((operation) =>
    responseData.url.includes(`/${operation}?`),
  );
}

// Does this error array describe a rate limit? X was only ever seen reporting
// rate limits as an HTTP 429 with a plain-text body, so this is written
// against the shape rather than against a captured response.
function isRateLimitError(body: XAPIError): boolean {
  return (body.errors ?? []).some(
    (error) =>
      error.code == RATE_LIMIT_ERROR_CODE ||
      [error.message, error.name, error.kind].some((field) =>
        /rate.?limit/i.test(field ?? ""),
      ),
  );
}

// When the rate limit lifts, in epoch seconds
function rateLimitReset(
  responseData: ResponseData,
  body: XAPIError | null,
): number {
  const now = Math.floor(Date.now() / 1000);

  const retryAfter = (body?.errors ?? []).find(
    (error) => error.retry_after,
  )?.retry_after;
  if (retryAfter) {
    return now + Number(retryAfter);
  }

  const header = responseData.responseHeaders?.["x-rate-limit-reset"];
  const reset = Number(Array.isArray(header) ? header[0] : header);
  if (reset) {
    return reset;
  }

  return now + DEFAULT_X_RATE_LIMIT_SECONDS;
}

function timelineFromBody(
  body: XAPIData | XAPIBookmarksData,
): XAPITimeline | null {
  if (isXAPIBookmarksData(body)) {
    return body.data.bookmark_timeline_v2;
  }
  if (isXAPIData(body)) {
    return (body as XAPIData).data.user.result.timeline as XAPITimeline;
  }
  if (isXAPIData_v2(body)) {
    return (body as XAPIData).data.user.result.timeline_v2 as XAPITimeline;
  }
  return null;
}

// Every post in a timeline response, whether it arrived as a top-level entry
// or inside a module. Replies only ever arrive inside modules, where the
// content hangs off `item` rather than off `content`.
function postItemContents(timeline: XAPITimeline): XAPIItemContent[] {
  const itemContents: XAPIItemContent[] = [];

  timeline.timeline.instructions.forEach((instruction) => {
    if (instruction["type"] != "TimelineAddEntries") {
      return;
    }
    instruction.entries?.forEach((entry) => {
      if (entry.content.entryType == "TimelineTimelineModule") {
        entry.content.items?.forEach((item) => {
          if (item.item?.itemContent) {
            itemContents.push(item.item.itemContent);
          }
        });
      } else if (entry.content.itemContent) {
        itemContents.push(entry.content.itemContent);
      }
    });
  });

  return itemContents.filter(
    (itemContent) => itemContent.itemType == "TimelineTweet",
  );
}

// The author and the post, from either of the two shapes X uses. The author's
// fields live in `core`: as of 2026-09-14 timeline users have no `legacy` at
// all.
function postFields(
  itemContent: XAPIItemContent,
): { userCore: XAPIUserCore; tweetLegacy: XAPILegacyTweet } | null {
  const result = itemContent.tweet_results?.result;
  if (!result) {
    return null;
  }

  // __typename "TweetWithVisibilityResults" nests the post one level deeper
  const post = result.tweet ?? result;
  const userCore = post.core?.user_results?.result?.core;
  const tweetLegacy = post.legacy;
  if (!userCore || !tweetLegacy) {
    return null;
  }

  return { userCore, tweetLegacy };
}

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
    controller.markRateLimited(rateLimitReset(responseData, null));
    controller.mitmController.responseData[responseIndex].processed = true;
    return false;
  }

  if (!isTimelineResponse(responseData) || responseData.status != 200) {
    // Skip response
    controller.mitmController.responseData[responseIndex].processed = true;
    return true;
  }

  // For likes and tweets, body is XAPIData
  // For bookmarks, body is XAPIBookmarksData
  const body: XAPIData | XAPIBookmarksData = JSON.parse(
    responseData.responseBody,
  );

  if (isXAPIError(body)) {
    controller.mitmController.responseData[responseIndex].processed = true;

    // A rate limit can arrive inside an otherwise-successful response. Treated
    // as "no more data" it would end the run with a partial archive the user
    // believes is complete.
    if (isRateLimitError(body)) {
      log.warn(
        "XAccountController.indexParseTweetsResponseData: RATE LIMITED inside a successful response",
      );
      controller.markRateLimited(rateLimitReset(responseData, body));
      return false;
    }

    log.error(
      "XAccountController.indexParseTweetsResponseData: XAPIError",
      body,
    );
    return false;
  }

  const timeline = timelineFromBody(body);
  if (timeline === null) {
    log.error(
      "XAccountController.indexParseTweetsResponseData: Invalid response data",
      responseData.responseBody,
    );
    throw new Error("Invalid response data");
  }

  controller.timelineStats.recognizedResponses++;

  const itemContents = postItemContents(timeline);
  controller.timelineStats.tweetEntries += itemContents.length;

  // A recognized timeline response carrying no posts is the end of the
  // timeline — and, on the first page, an account with nothing in it. X gives
  // no other empty-state signal: an empty profile timeline still returns a
  // who-to-follow module and two cursors.
  if (itemContents.length == 0) {
    controller.thereIsMore = false;
  }

  itemContents.forEach((itemContent) => {
    const fields = postFields(itemContent);
    if (!fields) {
      return;
    }
    indexTweet(controller, responseIndex, fields.userCore, fields.tweetLegacy);
    controller.timelineStats.tweetsSaved++;
  });

  controller.mitmController.responseData[responseIndex].processed = true;
  log.debug(
    "XAccountController.indexParseTweetsResponseData: processed",
    responseIndex,
  );

  return true;
}
