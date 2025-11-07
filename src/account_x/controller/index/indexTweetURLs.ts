import log from "electron-log/main";
import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XAPILegacyTweet, XAPILegacyURL } from "../../types";

/**
 * Index URLs from a tweet into the database.
 * Extracts URLs from tweet entities and stores them in the tweet_url table.
 */
export function indexTweetURLs(
  controller: XAccountController,
  tweetLegacy: XAPILegacyTweet,
): void {
  if (!controller.db) {
    controller.initDB();
  }

  log.debug("XAccountController.indexTweetURL");

  // Loop over all URL items
  tweetLegacy.entities?.urls.forEach((url: XAPILegacyURL) => {
    // Make sure we have all of the URL information before importing
    if (
      !url["url"] ||
      !url["display_url"] ||
      !url["expanded_url"] ||
      !url["indices"]
    ) {
      return;
    }

    // Index url information in tweet_url table
    exec(
      controller.db!,
      "INSERT OR REPLACE INTO tweet_url (url, displayURL, expandedURL, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?)",
      [
        url["url"],
        url["display_url"],
        url["expanded_url"],
        url["indices"]?.[0],
        url["indices"]?.[1],
        tweetLegacy["id_str"],
      ],
    );
  });
}
