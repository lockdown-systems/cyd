import path from "path";
import fs from "fs";
import os from "os";
import { glob } from "glob";
import { URL } from "url";
import log from "electron-log/main";
import { exec } from "../../../database";
import type { XAccountController } from "../../x_account_controller";
import type {
  XArchiveAccount,
  XArchiveTweet,
  XArchiveTweetContainer,
  XArchiveLike,
  XArchiveLikeContainer,
  XTweetRow,
} from "../../types";
import { isXArchiveTweetContainer, isXArchiveLikeContainer } from "../../types";
import type { XImportArchiveResponse } from "../../../shared_types/x";
import { importXArchiveMedia } from "./importXArchiveMedia";
import { importXArchiveURLs } from "./importXArchiveURLs";

/**
 * Imports an X archive (tweets or likes) into the database.
 * Returns an XImportArchiveResponse with the import results.
 */
export async function importXArchive(
  controller: XAccountController,
  archivePath: string,
  dataType: string,
): Promise<XImportArchiveResponse> {
  let importCount = 0;
  let skipCount = 0;

  // If archivePath contains just one folder and no files, update archivePath to point to that inner folder
  const archiveContents = fs.readdirSync(archivePath);
  if (
    archiveContents.length === 1 &&
    fs.lstatSync(path.join(archivePath, archiveContents[0])).isDirectory()
  ) {
    archivePath = path.join(archivePath, archiveContents[0]);
  }

  // Load the username
  let username: string;
  try {
    const accountFile = fs.readFileSync(
      path.join(archivePath, "data", "account.js"),
      "utf8",
    );
    const accountData: XArchiveAccount[] = JSON.parse(
      accountFile.slice("window.YTD.account.part0 = ".length),
    );
    username = accountData[0].account.username;
  } catch {
    return {
      status: "error",
      errorMessage: "Error parsing JSON in account.js",
      importCount: importCount,
      skipCount: skipCount,
      updatedArchivePath: archivePath,
    };
  }

  // Import tweets
  if (dataType == "tweets") {
    const tweetsFilenames = await glob(
      [
        path.join(archivePath, "data", "tweet.js"),
        path.join(archivePath, "data", "tweets.js"),
        path.join(archivePath, "data", "tweet-part*.js"),
        path.join(archivePath, "data", "tweets-part*.js"),
      ],
      {
        windowsPathsNoEscape: os.platform() == "win32",
      },
    );
    if (tweetsFilenames.length === 0) {
      return {
        status: "error",
        errorMessage: "No tweets files found",
        importCount: importCount,
        skipCount: skipCount,
        updatedArchivePath: archivePath,
      };
    }

    for (let i = 0; i < tweetsFilenames.length; i++) {
      // Load the data
      // New archives use XArchiveTweetContainer[], old archives use XArchiveTweet[]
      let tweetsData: XArchiveTweet[] | XArchiveTweetContainer[];
      try {
        const tweetsFile = fs.readFileSync(tweetsFilenames[i], "utf8");
        tweetsData = JSON.parse(tweetsFile.slice(tweetsFile.indexOf("[")));
      } catch (e) {
        log.error(
          `importXArchive: Error parsing JSON in ${tweetsFilenames[i]}:`,
          e,
        );
        return {
          status: "error",
          errorMessage: "Error parsing JSON in tweets.js",
          importCount: importCount,
          skipCount: skipCount,
          updatedArchivePath: archivePath,
        };
      }

      // Loop through the tweets and add them to the database
      try {
        tweetsData.forEach(async (tweetContainer) => {
          let tweet: XArchiveTweet;
          if (isXArchiveTweetContainer(tweetContainer)) {
            tweet = tweetContainer.tweet;
          } else {
            tweet = tweetContainer;
          }

          // Check if tweet has media and call importXArchiveMedia
          let hasMedia: boolean = false;
          if (
            tweet.extended_entities?.media &&
            tweet.extended_entities?.media?.length
          ) {
            hasMedia = true;
            await importXArchiveMedia(controller, tweet, archivePath);
          }

          // Check if tweet has urls and call importXArchiveURLs
          if (tweet.entities?.urls && tweet.entities?.urls?.length) {
            importXArchiveURLs(controller, tweet);
          }

          // Import it
          exec(
            controller.db,
            "INSERT OR REPLACE INTO tweet (username, tweetID, createdAt, likeCount, retweetCount, isLiked, isRetweeted, isBookmarked, text, path, hasMedia, isReply, replyTweetID, replyUserID, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              username,
              tweet.id_str,
              new Date(tweet.created_at),
              tweet.favorite_count,
              tweet.retweet_count,
              tweet.favorited ? 1 : 0,
              tweet.retweeted ? 1 : 0,
              0,
              tweet.full_text,
              `${username}/status/${tweet.id_str}`,
              hasMedia ? 1 : 0,
              tweet.in_reply_to_status_id_str ? 1 : 0,
              tweet.in_reply_to_status_id_str,
              tweet.in_reply_to_user_id_str,
              new Date(),
            ],
          );
          importCount++;
        });
      } catch (e) {
        return {
          status: "error",
          errorMessage: "Error importing tweets: " + e,
          importCount: importCount,
          skipCount: skipCount,
          updatedArchivePath: archivePath,
        };
      }
    }

    return {
      status: "success",
      errorMessage: "",
      importCount: importCount,
      skipCount: skipCount,
      updatedArchivePath: archivePath,
    };
  }

  // Import likes
  else if (dataType == "likes") {
    const likesFilenames = await glob(
      [
        path.join(archivePath, "data", "like.js"),
        path.join(archivePath, "data", "likes.js"),
        path.join(archivePath, "data", "like-part*.js"),
        path.join(archivePath, "data", "likes-part*.js"),
      ],
      {
        windowsPathsNoEscape: os.platform() == "win32",
      },
    );
    if (likesFilenames.length === 0) {
      return {
        status: "error",
        errorMessage: "No likes files found",
        importCount: importCount,
        skipCount: skipCount,
        updatedArchivePath: archivePath,
      };
    }

    for (let i = 0; i < likesFilenames.length; i++) {
      // Load the data
      let likesData: XArchiveLike[] | XArchiveLikeContainer[];
      try {
        const likesFile = fs.readFileSync(likesFilenames[i], "utf8");
        likesData = JSON.parse(likesFile.slice(likesFile.indexOf("[")));
      } catch (e) {
        log.error(
          `importXArchive: Error parsing JSON in ${likesFilenames[i]}:`,
          e,
        );
        return {
          status: "error",
          errorMessage: "Error parsing JSON in like.js",
          importCount: importCount,
          skipCount: skipCount,
          updatedArchivePath: archivePath,
        };
      }

      // Loop through the likes and add them to the database
      try {
        likesData.forEach((likeContainer) => {
          let like: XArchiveLike;
          if (isXArchiveLikeContainer(likeContainer)) {
            like = likeContainer.like;
          } else {
            like = likeContainer;
          }

          // Is this like already there?
          const existingTweet = exec(
            controller.db,
            "SELECT * FROM tweet WHERE tweetID = ?",
            [like.tweetId],
            "get",
          ) as XTweetRow;
          if (existingTweet) {
            if (existingTweet.isLiked) {
              skipCount++;
            } else {
              // Set isLiked to true
              exec(
                controller.db,
                "UPDATE tweet SET isLiked = ? WHERE tweetID = ?",
                [1, like.tweetId],
              );
              importCount++;
            }
          } else {
            // Import it
            const url = new URL(like.expandedUrl);
            let tweetPath = url.pathname + url.search + url.hash;
            if (tweetPath.startsWith("/")) {
              tweetPath = tweetPath.substring(1);
            }
            exec(
              controller.db,
              "INSERT INTO tweet (tweetID, isLiked, text, path, addedToDatabaseAt) VALUES (?, ?, ?, ?, ?)",
              [like.tweetId, 1, like.fullText, tweetPath, new Date()],
            );
            importCount++;
          }
        });
      } catch (e) {
        return {
          status: "error",
          errorMessage: "Error importing tweets: " + e,
          importCount: importCount,
          skipCount: skipCount,
          updatedArchivePath: archivePath,
        };
      }
    }

    return {
      status: "success",
      errorMessage: "",
      importCount: importCount,
      skipCount: skipCount,
      updatedArchivePath: archivePath,
    };
  }

  return {
    status: "error",
    errorMessage: "Invalid data type.",
    importCount: importCount,
    skipCount: skipCount,
    updatedArchivePath: archivePath,
  };
}
