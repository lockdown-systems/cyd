import path from "path";
import fs from "fs";
import log from "electron-log/main";
import type { XAccountController } from "../../x_account_controller";
import type { XAPILegacyTweetMedia } from "../../types";
import { getMediaURL } from "../../utils";

/**
 * Saves media from an archive to the account's media directory.
 * Returns the filename if successful, null otherwise.
 */
export async function saveXArchiveMedia(
  controller: XAccountController,
  tweetID: string,
  media: XAPILegacyTweetMedia,
  archivePath: string,
): Promise<string | null> {
  if (!controller.account) {
    throw new Error("Account not found");
  }

  log.info(`saveXArchiveMedia: saving media: ${JSON.stringify(media)}`);

  const mediaURL = getMediaURL(media);
  const mediaExtension = mediaURL.substring(mediaURL.lastIndexOf(".") + 1);
  const filename = `${media["id_str"]}.${mediaExtension}`;

  let archiveMediaFilename = null;
  if (
    (media.type === "video" || media.type === "animated_gif") &&
    media.video_info?.variants
  ) {
    // For videos, find the highest quality MP4 variant
    const mp4Variants = media.video_info.variants
      .filter((v) => v.content_type === "video/mp4")
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (mp4Variants.length > 0) {
      const highestQualityVariant = mp4Variants[0];
      const videoFilename = highestQualityVariant.url
        .split("/")
        .pop()
        ?.split("?")[0];
      if (videoFilename) {
        archiveMediaFilename = path.join(
          archivePath,
          "data",
          "tweets_media",
          `${tweetID}-${videoFilename}`,
        );
      }
    }
  } else {
    // For non-videos
    archiveMediaFilename = path.join(
      archivePath,
      "data",
      "tweets_media",
      `${tweetID}-${mediaURL.substring(mediaURL.lastIndexOf("/") + 1)}`,
    );
  }

  // If file doesn't exist in archive, don't save information in db
  if (!archiveMediaFilename || !fs.existsSync(archiveMediaFilename)) {
    log.info(
      `saveXArchiveMedia: media file not found: ${archiveMediaFilename}`,
    );
    return null;
  }

  // Create path to store tweet media if it doesn't exist already
  const outputPath = await controller.getMediaPath();
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  // Copy media from archive
  fs.copyFileSync(archiveMediaFilename, path.join(outputPath, filename));

  return filename;
}
