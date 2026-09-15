import type {
  BlueskyBookmark,
  BlueskyPostView,
  BlueskyRepoRecord,
} from "../../at_protocol";
import type { FakeATClientOptions } from "./fakeATClient";

/**
 * One small Bluesky account covering every public category, so a single set of
 * fixtures can prove the engine is category-agnostic: own posts with blob
 * media, a repost of a live post and of a deleted one, a like of someone
 * else's video, a bookmark, and reply/quote/external context.
 */

export const ALICE_DID = "did:plc:examplealice";
export const BOB_DID = "did:plc:examplebob";

export const ALICE_AVATAR_URL = "https://cdn.example/avatar/alice.jpg";
export const BOB_AVATAR_URL = "https://cdn.example/avatar/bob.jpg";
export const OWN_IMAGE_BLOB = `blob:${ALICE_DID}/bafyownimage`;
export const QUOTED_IMAGE_URL = "https://cdn.example/full/quoted.jpg";
export const LIKED_VIDEO_BLOB = `blob:${BOB_DID}/bafylikedvideo`;
export const LIKED_VIDEO_THUMBNAIL_URL = "https://video.example/thumbnail.jpg";
export const EXTERNAL_PREVIEW_BLOB = `blob:${ALICE_DID}/bafyexternalthumb`;

export const POST_URIS = {
  withImage: `at://${ALICE_DID}/app.bsky.feed.post/withimage`,
  withContext: `at://${ALICE_DID}/app.bsky.feed.post/withcontext`,
  withExternal: `at://${ALICE_DID}/app.bsky.feed.post/withexternal`,
};

export const REPOST_URIS = {
  live: `at://${ALICE_DID}/app.bsky.feed.repost/live`,
  gone: `at://${ALICE_DID}/app.bsky.feed.repost/gone`,
};

export const LIKE_URI = `at://${ALICE_DID}/app.bsky.feed.like/video`;

export const BOB_URIS = {
  parent: `at://${BOB_DID}/app.bsky.feed.post/parent`,
  quoted: `at://${BOB_DID}/app.bsky.feed.post/quoted`,
  reposted: `at://${BOB_DID}/app.bsky.feed.post/reposted`,
  liked: `at://${BOB_DID}/app.bsky.feed.post/liked`,
  bookmarked: `at://${BOB_DID}/app.bsky.feed.post/bookmarked`,
  deleted: `at://${BOB_DID}/app.bsky.feed.post/deleted`,
};

const blob = (cid: string, mimeType: string) => ({
  $type: "blob",
  ref: { $link: cid },
  mimeType,
});

export const posts: BlueskyRepoRecord[] = [
  {
    uri: POST_URIS.withImage,
    cid: "bafypostimage",
    value: {
      $type: "app.bsky.feed.post",
      text: "A post with a picture",
      createdAt: "2026-01-01T10:00:00.000Z",
      embed: {
        $type: "app.bsky.embed.images",
        images: [
          {
            alt: "my picture",
            image: blob("bafyownimage", "image/jpeg"),
            aspectRatio: { width: 800, height: 600 },
          },
        ],
      },
    },
  },
  {
    uri: POST_URIS.withContext,
    cid: "bafypostcontext",
    value: {
      $type: "app.bsky.feed.post",
      text: "Replying to Bob and quoting him",
      createdAt: "2026-01-02T10:00:00.000Z",
      reply: {
        root: { uri: BOB_URIS.parent, cid: "bafyparent" },
        parent: { uri: BOB_URIS.parent, cid: "bafyparent" },
      },
      embed: {
        $type: "app.bsky.embed.record",
        record: { uri: BOB_URIS.quoted, cid: "bafyquoted" },
      },
    },
  },
  {
    uri: POST_URIS.withExternal,
    cid: "bafypostexternal",
    value: {
      $type: "app.bsky.feed.post",
      text: "A link worth keeping",
      createdAt: "2026-01-03T10:00:00.000Z",
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://example.com/article",
          title: "An article",
          description: "Worth keeping",
          thumb: blob("bafyexternalthumb", "image/jpeg"),
        },
      },
    },
  },
];

export const reposts: BlueskyRepoRecord[] = [
  {
    uri: REPOST_URIS.live,
    cid: "bafyrepostlive",
    value: {
      $type: "app.bsky.feed.repost",
      subject: { uri: BOB_URIS.reposted, cid: "bafyreposted" },
      createdAt: "2026-01-04T10:00:00.000Z",
    },
  },
  {
    // A repost of a post Bluesky no longer has: the relationship is still real.
    uri: REPOST_URIS.gone,
    cid: "bafyrepostgone",
    value: {
      $type: "app.bsky.feed.repost",
      subject: { uri: BOB_URIS.deleted, cid: "bafydeleted" },
      createdAt: "2026-01-05T10:00:00.000Z",
    },
  },
];

export const likes: BlueskyRepoRecord[] = [
  {
    uri: LIKE_URI,
    cid: "bafylike",
    value: {
      $type: "app.bsky.feed.like",
      subject: { uri: BOB_URIS.liked, cid: "bafyliked" },
      createdAt: "2026-01-06T10:00:00.000Z",
    },
  },
];

const bobAuthor = {
  did: BOB_DID,
  handle: "bob.test",
  displayName: "Bob",
  avatar: BOB_AVATAR_URL,
};

export const postViews: BlueskyPostView[] = [
  {
    uri: BOB_URIS.parent,
    cid: "bafyparent",
    author: bobAuthor,
    record: {
      $type: "app.bsky.feed.post",
      text: "Bob started this",
      createdAt: "2026-01-01T09:00:00.000Z",
    },
    indexedAt: "2026-01-01T09:00:01.000Z",
  },
  {
    uri: BOB_URIS.quoted,
    cid: "bafyquoted",
    author: bobAuthor,
    record: {
      $type: "app.bsky.feed.post",
      text: "Bob's quotable post",
      createdAt: "2026-01-01T09:30:00.000Z",
    },
    embed: {
      $type: "app.bsky.embed.images#view",
      images: [
        {
          thumb: "https://cdn.example/thumb/quoted.jpg",
          fullsize: QUOTED_IMAGE_URL,
          alt: "Bob's picture",
        },
      ],
    },
    indexedAt: "2026-01-01T09:30:01.000Z",
  },
  {
    uri: BOB_URIS.reposted,
    cid: "bafyreposted",
    author: bobAuthor,
    record: {
      $type: "app.bsky.feed.post",
      text: "Bob's post that Alice reposted",
      createdAt: "2026-01-03T09:00:00.000Z",
    },
    indexedAt: "2026-01-03T09:00:01.000Z",
  },
  {
    uri: BOB_URIS.liked,
    cid: "bafyliked",
    author: bobAuthor,
    record: {
      $type: "app.bsky.feed.post",
      text: "Bob's video that Alice liked",
      createdAt: "2026-01-05T09:00:00.000Z",
    },
    embed: {
      $type: "app.bsky.embed.video#view",
      cid: "bafylikedvideo",
      playlist: "https://video.example/playlist.m3u8",
      thumbnail: LIKED_VIDEO_THUMBNAIL_URL,
      alt: "Bob's clip",
    },
    indexedAt: "2026-01-05T09:00:01.000Z",
  },
  {
    uri: BOB_URIS.bookmarked,
    cid: "bafybookmarked",
    author: bobAuthor,
    record: {
      $type: "app.bsky.feed.post",
      text: "Bob's post that Alice bookmarked",
      createdAt: "2026-01-07T09:00:00.000Z",
    },
    indexedAt: "2026-01-07T09:00:01.000Z",
  },
];

export const bookmarks: BlueskyBookmark[] = [
  {
    subject: { uri: BOB_URIS.bookmarked, cid: "bafybookmarked" },
    createdAt: "2026-01-08T10:00:00.000Z",
    post: postViews.find((post) => post.uri === BOB_URIS.bookmarked),
  },
];

const bytes = (label: string, size: number): Buffer =>
  Buffer.concat([Buffer.from(label), Buffer.alloc(size, 7)]);

export const assets: NonNullable<FakeATClientOptions["assets"]> = {
  [ALICE_AVATAR_URL]: {
    bytes: bytes("alice-avatar", 64),
    mediaType: "image/jpeg",
  },
  [BOB_AVATAR_URL]: { bytes: bytes("bob-avatar", 64), mediaType: "image/jpeg" },
  [OWN_IMAGE_BLOB]: { bytes: bytes("own-image", 256), mediaType: "image/jpeg" },
  [QUOTED_IMAGE_URL]: {
    bytes: bytes("quoted-image", 256),
    mediaType: "image/jpeg",
  },
  [EXTERNAL_PREVIEW_BLOB]: {
    bytes: bytes("external-preview", 128),
    mediaType: "image/jpeg",
  },
  [LIKED_VIDEO_BLOB]: {
    bytes: bytes("liked-video", 4096),
    mediaType: "video/mp4",
  },
  [LIKED_VIDEO_THUMBNAIL_URL]: {
    bytes: bytes("liked-thumbnail", 96),
    mediaType: "image/jpeg",
  },
};

/** Everything a fake client needs to serve this whole account. */
export const fullAccountFixture = (): FakeATClientOptions => ({
  did: ALICE_DID,
  profile: {
    did: ALICE_DID,
    handle: "alice.test",
    displayName: "Alice",
    avatar: ALICE_AVATAR_URL,
    postsCount: posts.length,
  },
  posts,
  reposts,
  likes,
  bookmarks,
  postViews,
  assets,
});
