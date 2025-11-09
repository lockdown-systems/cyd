import log from "electron-log/main";
import { exec } from "../../../database";
import { getMediaURL } from "../../utils";
import type { XAccountController } from "../../x_account_controller";
import type { XAPILegacyTweet, XAPILegacyTweetMedia } from "../../types";
import { saveTweetMedia } from "./saveTweetMedia";

export function indexTweetMedia(
  controller: XAccountController,
  tweetLegacy: XAPILegacyTweet,
): void {
  log.debug("XAccountController.indexMedia");

  // Loop over all media items
  tweetLegacy.extended_entities?.media?.forEach(
    (media: XAPILegacyTweetMedia) => {
      const mediaURL = getMediaURL(media);
      const mediaExtension = mediaURL.substring(mediaURL.lastIndexOf(".") + 1);

      // Download media locally
      const filename = `${media["media_key"]}.${mediaExtension}`;
      saveTweetMedia(controller, mediaURL, filename);

      // Index media information in tweet_media table
      exec(
        controller.db,
        "INSERT OR REPLACE INTO tweet_media (mediaID, mediaType, url, filename, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          media["media_key"],
          media["type"],
          media["url"],
          filename,
          media["indices"]?.[0],
          media["indices"]?.[1],
          tweetLegacy["id_str"],
        ],
      );
    },
  );
}
