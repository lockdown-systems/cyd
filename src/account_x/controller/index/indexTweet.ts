import log from "electron-log/main";
import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XAPIUserCore, XAPILegacyTweet } from "../../types";
import { indexTweetMedia } from "./indexTweetMedia";
import { indexTweetURLs } from "./indexTweetURLs";

export function indexTweet(
  controller: XAccountController,
  responseIndex: number,
  userCore: XAPIUserCore,
  tweetLegacy: XAPILegacyTweet,
): void {
  if (!controller.db) {
    controller.initDB();
  }

  // Check if tweet has media and call indexTweetMedia
  let hasMedia: boolean = false;
  if (
    tweetLegacy.extended_entities?.media &&
    tweetLegacy.extended_entities?.media.length
  ) {
    hasMedia = true;
    indexTweetMedia(controller, tweetLegacy);
  }

  // Check if tweet has URLs and index it
  if (tweetLegacy.entities?.urls && tweetLegacy.entities?.urls.length) {
    indexTweetURLs(controller, tweetLegacy);
  }

  // Add the tweet
  exec(
    controller.db,
    "INSERT OR REPLACE INTO tweet (username, tweetID, conversationID, createdAt, likeCount, quoteCount, replyCount, retweetCount, isLiked, isRetweeted, isBookmarked, text, path, hasMedia, isReply, replyTweetID, replyUserID, isQuote, quotedTweet, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      userCore["screen_name"],
      tweetLegacy["id_str"],
      tweetLegacy["conversation_id_str"],
      new Date(tweetLegacy["created_at"]),
      tweetLegacy["favorite_count"],
      tweetLegacy["quote_count"],
      tweetLegacy["reply_count"],
      tweetLegacy["retweet_count"],
      tweetLegacy["favorited"] ? 1 : 0,
      tweetLegacy["retweeted"] ? 1 : 0,
      tweetLegacy["bookmarked"] ? 1 : 0,
      tweetLegacy["full_text"],
      `${userCore["screen_name"]}/status/${tweetLegacy["id_str"]}`,
      hasMedia ? 1 : 0,
      tweetLegacy["in_reply_to_status_id_str"] ? 1 : 0,
      tweetLegacy["in_reply_to_status_id_str"],
      tweetLegacy["in_reply_to_user_id_str"],
      tweetLegacy["is_quote_status"] ? 1 : 0,
      tweetLegacy["quoted_status_permalink"]
        ? tweetLegacy["quoted_status_permalink"]["expanded"]
        : null,
      new Date(),
    ],
  );

  log.debug(
    "XAccountController.indexTweet: indexed tweet",
    controller.account?.username,
    userCore,
    tweetLegacy,
  );

  // Update progress
  if (tweetLegacy["favorited"]) {
    controller.progress.likesIndexed++;
  }
  if (tweetLegacy["bookmarked"]) {
    controller.progress.bookmarksIndexed++;
  }
  if (tweetLegacy["full_text"].startsWith("RT @")) {
    controller.progress.retweetsIndexed++;
  }
  if (
    userCore["screen_name"] == controller.account?.username &&
    !tweetLegacy["full_text"].startsWith("RT @")
  ) {
    controller.progress.tweetsIndexed++;
  }
  if (
    !tweetLegacy["favorited"] &&
    !tweetLegacy["bookmarked"] &&
    !tweetLegacy["full_text"].startsWith("RT @") &&
    userCore["screen_name"] != controller.account?.username
  ) {
    controller.progress.unknownIndexed++;
  }
}
