import fs from "fs";
import path from "path";

/**
 * Test fixtures for XViewModel tests
 * Provides easy access to test data files
 */

// __dirname is <repo>/src/renderer/src/view_models/XViewModel, so five levels
// up is the repository root.
const TESTDATA_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "testdata",
  "x",
);

/**
 * Load a JSON test fixture file
 */
function loadFixture(filename: string): unknown {
  const filepath = path.join(TESTDATA_DIR, filename);
  const content = fs.readFileSync(filepath, "utf8");
  return JSON.parse(content);
}

/**
 * X API response fixtures for testing tweet parsing
 */
export const XAPIFixtures = {
  // User tweets and replies responses
  userTweetsAndReplies1: () => loadFixture("XUserTweetsAndReplies1.json"),
  userTweetsAndReplies2: () => loadFixture("XUserTweetsAndReplies2.json"),
  userTweetsAndReplies3: () => loadFixture("XUserTweetsAndReplies3.json"),
  userTweetsAndReplies18: () => loadFixture("XUserTweetsAndReplies18.json"),
  userTweetsAndRepliesMedia: () =>
    loadFixture("XUserTweetsAndRepliesMedia.json"),
  userTweetsAndRepliesError: () =>
    loadFixture("XUserTweetsAndRepliesError.json"),
  userTweetsAndReplies_20250404: () =>
    loadFixture("XUserTweetsAndReplies_20250404.json"),

  // DM (Direct Message) responses
  dmConversation1: () => loadFixture("XAPIDMConversation1.json"),
  dmConversation2: () => loadFixture("XAPIDMConversation2.json"),
  dmInboxTimeline1: () => loadFixture("XAPIDMInboxTimeline1.json"),
  dmInboxTimeline2: () => loadFixture("XAPIDMInboxTimeline2.json"),
  dmInitialInboxState: () => loadFixture("XAPIDMInitialInboxState.json"),

  // Bookmarks response
  bookmarks: () => loadFixture("XBookmarks.json"),

  // --- Capture of 2026-09-14 (see docs/x-capture/findings-20260914.md) ---
  //
  // X split UserTweetsAndReplies into UserOriginalsTimeline (posts),
  // UserRepliesTimeline (replies), and UserRepostsTimeline (reposts), and the
  // user objects in all three carry their author fields in `core` rather than
  // in `legacy`. Viewer is the exception and still returns `legacy`.

  // Posts. Pages 1-3 are populated (20, 20, 13 entries); page 4 is the
  // end-of-timeline response, which carries two cursors and no posts.
  userOriginalsTimeline_20260914_1: () =>
    loadFixture("XUserOriginalsTimeline_20260914_1.json"),
  userOriginalsTimeline_20260914_2: () =>
    loadFixture("XUserOriginalsTimeline_20260914_2.json"),
  userOriginalsTimeline_20260914_3: () =>
    loadFixture("XUserOriginalsTimeline_20260914_3.json"),
  userOriginalsTimeline_20260914_4: () =>
    loadFixture("XUserOriginalsTimeline_20260914_4.json"),

  // Likes. Pages 1-3 populated (20, 20, 16); page 4 is cursors only.
  likes_20260914_1: () => loadFixture("XLikes_20260914_1.json"),
  likes_20260914_2: () => loadFixture("XLikes_20260914_2.json"),
  likes_20260914_3: () => loadFixture("XLikes_20260914_3.json"),
  likes_20260914_4: () => loadFixture("XLikes_20260914_4.json"),

  // Bookmarks. Pages 1-3 populated (20, 20, 18); page 4 is cursors only.
  bookmarks_20260914_1: () => loadFixture("XBookmarks_20260914_1.json"),
  bookmarks_20260914_2: () => loadFixture("XBookmarks_20260914_2.json"),
  bookmarks_20260914_3: () => loadFixture("XBookmarks_20260914_3.json"),
  bookmarks_20260914_4: () => loadFixture("XBookmarks_20260914_4.json"),

  // Replies, from /<username>/with_replies, which now returns replies only.
  userRepliesTimeline_20260914: () =>
    loadFixture("XUserRepliesTimeline_20260914.json"),

  // Reposts, from /<username>/reposts. They are not on the profile timeline.
  userRepostsTimeline_20260914: () =>
    loadFixture("XUserRepostsTimeline_20260914.json"),

  // Every timeline as an empty account returns it. There is no empty-state
  // marker in any of them: an empty timeline is a recognised response with no
  // post entries. The profile timeline still returns a who-to-follow module,
  // so "no entries" is not the test either.
  userOriginalsTimelineEmpty_20260914: () =>
    loadFixture("XUserOriginalsTimelineEmpty_20260914.json"),
  userRepliesTimelineEmpty_20260914: () =>
    loadFixture("XUserRepliesTimelineEmpty_20260914.json"),
  userRepostsTimelineEmpty_20260914: () =>
    loadFixture("XUserRepostsTimelineEmpty_20260914.json"),
  likesEmpty_20260914: () => loadFixture("XLikesEmpty_20260914.json"),
  bookmarksEmpty_20260914: () => loadFixture("XBookmarksEmpty_20260914.json"),

  // Mutation responses. DeleteRetweet is its own operation, takes
  // `source_tweet_id`, and names the original post in its response.
  deleteTweet_20260914: () => loadFixture("XDeleteTweet_20260914.json"),
  unfavoriteTweet_20260914: () => loadFixture("XUnfavoriteTweet_20260914.json"),
  deleteBookmark_20260914: () => loadFixture("XDeleteBookmark_20260914.json"),
  deleteRetweet_20260914: () => loadFixture("XDeleteRetweet_20260914.json"),

  // Account lookup. Viewer still answers 200 and its user object still has
  // `legacy` with every field Cyd reads, so it does not share a parser with
  // the timeline operations above.
  viewer_20260914: () => loadFixture("XViewer_20260914.json"),
};

/**
 * Sample tweet data for testing
 */
export const SampleTweets = {
  /**
   * A simple tweet with no media
   */
  simple: {
    id: "1234567890",
    text: "This is a test tweet",
    likeCount: 10,
    retweetCount: 5,
    createdAt: new Date("2024-01-01T12:00:00Z"),
  },

  /**
   * A tweet with high engagement
   */
  popular: {
    id: "9876543210",
    text: "This is a popular tweet",
    likeCount: 1000,
    retweetCount: 500,
    createdAt: new Date("2024-01-15T12:00:00Z"),
  },

  /**
   * An old tweet
   */
  old: {
    id: "1111111111",
    text: "This is an old tweet",
    likeCount: 2,
    retweetCount: 0,
    createdAt: new Date("2020-01-01T12:00:00Z"),
  },

  /**
   * A tweet with media
   */
  withMedia: {
    id: "2222222222",
    text: "Check out this image!",
    likeCount: 50,
    retweetCount: 20,
    createdAt: new Date("2024-02-01T12:00:00Z"),
    images: ["image1.jpg", "image2.jpg"],
  },

  /**
   * A retweet
   */
  retweet: {
    id: "3333333333",
    text: "RT @someone: Original tweet",
    likeCount: 5,
    retweetCount: 0,
    createdAt: new Date("2024-03-01T12:00:00Z"),
    isRetweet: true,
  },
};

/**
 * Sample user data for testing
 */
export const SampleUsers = {
  /**
   * A standard user
   */
  standard: {
    username: "testuser",
    userID: "123456789",
    bio: "Test user bio",
    followersCount: 200,
    followingCount: 100,
    tweetsCount: 500,
    likesCount: 300,
  },

  /**
   * A premium user
   */
  premium: {
    username: "premiumuser",
    userID: "987654321",
    bio: "Premium user bio",
    followersCount: 10000,
    followingCount: 500,
    tweetsCount: 5000,
    likesCount: 3000,
  },

  /**
   * A new user with minimal data
   */
  newUser: {
    username: "newuser",
    userID: "111111111",
    bio: "",
    followersCount: 0,
    followingCount: 0,
    tweetsCount: 0,
    likesCount: 0,
  },
};

/**
 * Sample GraphQL responses for testing
 */
export const GraphQLResponses = {
  /**
   * Successful delete tweet response
   */
  deleteTweetSuccess: {
    status: 200,
    body: JSON.stringify({
      data: {
        delete_tweet: {
          tweet_results: {},
        },
      },
    }),
  },

  /**
   * Rate limit response, as observed in the capture of 2026-09-14: an HTTP 429
   * whose body is the plain text `Rate limit exceeded`, not JSON. The numbers
   * a caller needs are in the headers, so they are carried here too.
   *
   * There is no fixture file for this because the body is not JSON. The
   * disguised form — a successful status carrying an `errors` array — was not
   * seen once across roughly 2,500 captured calls, so nothing here stands in
   * for it; see finding 12 in docs/x-capture/findings-20260914.md.
   */
  rateLimitError: {
    status: 429,
    body: "Rate limit exceeded",
    headers: {
      "x-rate-limit-limit": "50",
      "x-rate-limit-remaining": "0",
      "x-rate-limit-reset": "1789429535",
    },
  },

  /**
   * Successful viewer user response
   */
  viewerUserSuccess: {
    data: {
      viewer: {
        user_results: {
          result: {
            rest_id: "123456789",
            legacy: {
              screen_name: "testuser",
              description: "Test bio",
              profile_image_url_https: "https://example.com/profile.jpg",
              friends_count: 100,
              followers_count: 200,
              statuses_count: 500,
              favourites_count: 300,
            },
          },
        },
      },
    },
  },
};

/**
 * Sample job configurations for testing
 */
export const SampleJobConfigs = {
  /**
   * Save everything configuration
   */
  saveAll: {
    saveMyData: true,
    archiveTweets: true,
    archiveTweetsHTML: true,
    archiveLikes: true,
    archiveBookmarks: true,
    archiveDMs: true,
    deleteMyData: false,
  },

  /**
   * Delete everything configuration
   */
  deleteAll: {
    saveMyData: false,
    deleteMyData: true,
    deleteTweets: true,
    deleteRetweets: true,
    deleteLikes: true,
    deleteBookmarks: true,
    deleteDMs: true,
    unfollowEveryone: true,
  },

  /**
   * Tombstone configuration
   */
  tombstone: {
    tombstoneUpdateBanner: true,
    tombstoneUpdateBio: true,
    tombstoneUpdateBioText: "Follow me on Bluesky: @user.bsky.social",
    tombstoneUpdateBioCreditCyd: true,
    tombstoneLockAccount: true,
  },

  /**
   * Migrate to Bluesky configuration
   */
  migrateBluesky: {
    saveMyData: true,
    archiveTweets: true,
  },
};

/**
 * Helper to check if test data directory exists
 */
export function hasTestData(): boolean {
  return fs.existsSync(TESTDATA_DIR);
}

/**
 * Get the path to a test data file
 */
export function getTestDataPath(filename: string): string {
  return path.join(TESTDATA_DIR, filename);
}
