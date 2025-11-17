/**
 * Unit tests for X account utility functions
 */

import { test, expect, describe } from "vitest";
import { getMediaURL } from "../../utils";
import type { XAPILegacyTweetMedia } from "../../types";

// Helper function to create base media object with required fields
function createBaseMedia(
  overrides: Partial<XAPILegacyTweetMedia> = {},
): XAPILegacyTweetMedia {
  return {
    display_url: "pic.x.com/example",
    expanded_url: "https://twitter.com/user/status/123/photo/1",
    id_str: "123456789",
    indices: [0, 23],
    media_key: "3_123456789",
    media_url_https: "https://pbs.twimg.com/media/example.jpg",
    type: "photo",
    url: "https://t.co/example",
    additional_media_info: {},
    ext_media_availability: { status: "available" },
    sizes: {},
    original_info: {},
    ...overrides,
  };
}

describe("getMediaURL", () => {
  test("should return HTTPS URL for photo media", () => {
    const photoMedia = createBaseMedia({
      type: "photo",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
    });

    const url = getMediaURL(photoMedia);
    expect(url).toBe("https://pbs.twimg.com/media/example.jpg");
  });

  test("should return highest bitrate variant URL for video media", () => {
    const videoMedia = createBaseMedia({
      type: "video",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
      video_info: {
        aspect_ratio: [16, 9],
        duration_millis: 10000,
        variants: [
          {
            bitrate: 632000,
            content_type: "video/mp4",
            url: "https://video.twimg.com/low.mp4?tag=12",
          },
          {
            bitrate: 2176000,
            content_type: "video/mp4",
            url: "https://video.twimg.com/high.mp4?tag=12",
          },
          {
            bitrate: 832000,
            content_type: "video/mp4",
            url: "https://video.twimg.com/medium.mp4?tag=12",
          },
        ],
      },
    });

    const url = getMediaURL(videoMedia);
    // Should select highest bitrate (2176000) and strip query params
    expect(url).toBe("https://video.twimg.com/high.mp4");
  });

  test("should strip query parameters from video URLs", () => {
    const videoMedia = createBaseMedia({
      type: "video",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
      video_info: {
        aspect_ratio: [16, 9],
        duration_millis: 10000,
        variants: [
          {
            bitrate: 1000000,
            content_type: "video/mp4",
            url: "https://video.twimg.com/video.mp4?tag=12&other=param",
          },
        ],
      },
    });

    const url = getMediaURL(videoMedia);
    expect(url).toBe("https://video.twimg.com/video.mp4");
  });

  test("should return first variant URL for animated_gif media", () => {
    const gifMedia = createBaseMedia({
      type: "animated_gif",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
      video_info: {
        aspect_ratio: [16, 9],
        duration_millis: 5000,
        variants: [
          {
            bitrate: 0,
            content_type: "video/mp4",
            url: "https://video.twimg.com/gif.mp4?tag=12",
          },
        ],
      },
    });

    const url = getMediaURL(gifMedia);
    // Should select first variant and strip query params
    expect(url).toBe("https://video.twimg.com/gif.mp4");
  });

  test("should strip query parameters from GIF URLs", () => {
    const gifMedia = createBaseMedia({
      type: "animated_gif",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
      video_info: {
        aspect_ratio: [16, 9],
        duration_millis: 5000,
        variants: [
          {
            bitrate: 0,
            content_type: "video/mp4",
            url: "https://video.twimg.com/gif.mp4?tag=12&extra=stuff",
          },
        ],
      },
    });

    const url = getMediaURL(gifMedia);
    expect(url).toBe("https://video.twimg.com/gif.mp4");
  });

  test("should handle video media with no variants", () => {
    const videoMedia = createBaseMedia({
      type: "video",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
      video_info: {
        aspect_ratio: [16, 9],
        duration_millis: 10000,
        variants: [],
      },
    });

    const url = getMediaURL(videoMedia);
    // Should fall back to media_url_https
    expect(url).toBe("https://pbs.twimg.com/media/example.jpg");
  });

  test("should handle GIF media with no variants", () => {
    const gifMedia = createBaseMedia({
      type: "animated_gif",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
      video_info: {
        aspect_ratio: [16, 9],
        duration_millis: 5000,
        variants: [],
      },
    });

    const url = getMediaURL(gifMedia);
    // Should fall back to media_url_https when variants array is empty
    expect(url).toBe("https://pbs.twimg.com/media/example.jpg");
  });

  test("should handle video with no video_info", () => {
    const videoMedia = createBaseMedia({
      type: "video",
      media_url_https: "https://pbs.twimg.com/media/example.jpg",
    });

    const url = getMediaURL(videoMedia);
    // Should fall back to media_url_https
    expect(url).toBe("https://pbs.twimg.com/media/example.jpg");
  });
});
