import {
    XAPILegacyTweetMedia,
    XAPILegacyTweetMediaVideoVariant,
} from "./types";

/**
 * Get the media URL from a Twitter/X API legacy tweet media object.
 * Handles photos, videos, and animated GIFs, selecting the highest quality variant for videos.
 */
export function getMediaURL(media: XAPILegacyTweetMedia): string {
    // Get the HTTPS URL of the media -- this works for photos
    let mediaURL = media["media_url_https"];

    // If it's a video, set mediaURL to the video variant with the highest bitrate
    if (media["type"] === "video") {
        let highestBitrate = 0;
        if (media["video_info"] && media["video_info"]["variants"]) {
            media["video_info"]["variants"].forEach(
                (variant: XAPILegacyTweetMediaVideoVariant) => {
                    if (variant["bitrate"] && variant["bitrate"] > highestBitrate) {
                        highestBitrate = variant["bitrate"];
                        mediaURL = variant["url"];

                        // Stripe query parameters from the URL.
                        // For some reason video variants end with `?tag=12`, and when we try downloading with that
                        // it responds with 404.
                        const queryIndex = mediaURL.indexOf("?");
                        if (queryIndex > -1) {
                            mediaURL = mediaURL.substring(0, queryIndex);
                        }
                    }
                },
            );
        }
    }
    // If it's a GIF, there is only one video variant with a bitrate of 0, so select the first item
    else if (media["type"] === "animated_gif") {
        if (media["video_info"] && media["video_info"]["variants"]) {
            mediaURL = media["video_info"]["variants"]?.[0]["url"];

            // Stripe query parameters from the URL.
            // For some reason video variants end with `?tag=12`, and when we try downloading with that
            // it responds with 404.
            const queryIndex = mediaURL.indexOf("?");
            if (queryIndex > -1) {
                mediaURL = mediaURL.substring(0, queryIndex);
            }
        }
    }
    return mediaURL;
}
