import log from "electron-log/main";
import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type {
  XArchiveTweet,
  XAPILegacyTweetMedia,
  XTweetMediaRow,
} from "../../types";
import { saveXArchiveMedia } from "./saveXArchiveMedia";

/**
 * Imports media from an archive tweet into the database.
 */
export async function importXArchiveMedia(
  controller: XAccountController,
  tweet: XArchiveTweet,
  archivePath: string,
): Promise<void> {
  // Loop over all media items
  tweet.extended_entities?.media?.forEach(
    async (media: XAPILegacyTweetMedia) => {
      const existingMedia = exec(
        controller.db,
        "SELECT * FROM tweet_media WHERE mediaID = ?",
        [media.id_str],
        "get",
      ) as XTweetMediaRow;
      if (existingMedia) {
        log.debug(`importXArchiveMedia: media already exists: ${media.id_str}`);
        return;
      }
      const filename = await saveXArchiveMedia(
        controller,
        tweet.id_str,
        media,
        archivePath,
      );
      if (filename) {
        // Index media information in tweet_media table
        exec(
          controller.db,
          "INSERT INTO tweet_media (mediaID, mediaType, url, filename, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            media.id_str,
            media.type,
            media.url,
            filename,
            media.indices?.[0],
            media.indices?.[1],
            tweet.id_str,
          ],
        );
      }
    },
  );
}
