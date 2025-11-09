import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type { XArchiveTweet, XAPILegacyURL } from "../../types";

/**
 * Imports URLs from an archive tweet into the database.
 */
export function importXArchiveURLs(
  controller: XAccountController,
  tweet: XArchiveTweet,
): void {
  // Loop over all URL items
  tweet?.entities?.urls.forEach((url: XAPILegacyURL) => {
    // Index url information in tweet_url table
    exec(
      controller.db,
      "INSERT OR REPLACE INTO tweet_url (url, displayURL, expandedURL, startIndex, endIndex, tweetID) VALUES (?, ?, ?, ?, ?, ?)",
      [
        url.url,
        url.display_url,
        url.expanded_url,
        url.indices?.[0],
        url.indices?.[1],
        tweet.id_str,
      ],
    );
  });
}
