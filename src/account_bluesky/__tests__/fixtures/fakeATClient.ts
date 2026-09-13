import type {
  BlueskyATClient,
  BlueskyBookmark,
  BlueskyFetchedMedia,
  BlueskyPostView,
  BlueskyProfileView,
  BlueskyRepoRecord,
} from "../../at_protocol";
import { BlueskyMediaFetchError } from "../../at_protocol";

/**
 * A fake AT Protocol client.
 *
 * It stands in for the network and nothing else: storage is real, mapping is
 * real, and so is every checkpoint. That is what lets one test drive a whole
 * collection run and then assert on the account's actual database and media
 * store.
 */

export type FakeATClientOptions = {
  did?: string;
  profile?: Partial<BlueskyProfileView>;
  posts?: BlueskyRepoRecord[];
  reposts?: BlueskyRepoRecord[];
  likes?: BlueskyRepoRecord[];
  bookmarks?: BlueskyBookmark[];
  /** Hydrated views `getPosts` can answer with, keyed by AT URI. */
  postViews?: BlueskyPostView[];
  /** Bytes behind each asset address: a URL, or `blob:<did>/<cid>`. */
  assets?: Record<string, { bytes: Buffer; mediaType: string }>;
  /** Records per listing page, so pagination and resuming are exercised. */
  pageSize?: number;
};

/** A rate limit the fake will answer with, as Bluesky's PDS does. */
const rateLimitError = (resumeAtSeconds: number) =>
  Object.assign(new Error("Rate Limit Exceeded"), {
    name: "XRPCError",
    status: 429,
    error: "RateLimitExceeded",
    headers: { "ratelimit-reset": String(resumeAtSeconds) },
  });

export type FakeATClient = BlueskyATClient & {
  calls: {
    listRecords: number;
    getPosts: number;
    listBookmarks: number;
    getProfile: number;
    /** Every asset address the engine asked for, in order. */
    fetched: string[];
  };
  /** Rate limit the next `times` listing calls, resetting `afterMS` later. */
  rateLimitListing(times: number, afterMS: number): void;
  /** Refuse this asset address until `allowAsset` is called for it. */
  failAsset(address: string, status?: number): void;
  allowAsset(address: string): void;
  /** Replace the identity's current profile, as a rename would. */
  setProfile(profile: Partial<BlueskyProfileView>): void;
};

export const createFakeATClient = (
  options: FakeATClientOptions = {},
): FakeATClient => {
  const did = options.did ?? "did:plc:examplealice";
  const pageSize = options.pageSize ?? 50;
  const assets = options.assets ?? {};
  const failures = new Map<string, number>();
  let rateLimitsLeft = 0;
  let rateLimitAfterMS = 0;

  let profile: BlueskyProfileView = {
    did,
    handle: "alice.test",
    displayName: "Alice",
    ...options.profile,
  };

  const collections: Record<string, BlueskyRepoRecord[]> = {
    "app.bsky.feed.post": options.posts ?? [],
    "app.bsky.feed.repost": options.reposts ?? [],
    "app.bsky.feed.like": options.likes ?? [],
  };

  const postViews = new Map(
    (options.postViews ?? []).map((post) => [post.uri, post]),
  );

  const calls = {
    listRecords: 0,
    getPosts: 0,
    listBookmarks: 0,
    getProfile: 0,
    fetched: [] as string[],
  };

  /** A cursor is the index of the next item, which is all a fake needs. */
  const pageOf = <T>(items: T[], cursor?: string) => {
    const start = cursor ? Number(cursor) : 0;
    const slice = items.slice(start, start + pageSize);
    const next = start + slice.length;
    return { slice, cursor: next < items.length ? String(next) : undefined };
  };

  const applyRateLimit = () => {
    if (rateLimitsLeft > 0) {
      rateLimitsLeft -= 1;
      throw rateLimitError(Math.ceil((Date.now() + rateLimitAfterMS) / 1000));
    }
  };

  const fetchAddress = async (
    address: string,
  ): Promise<BlueskyFetchedMedia> => {
    calls.fetched.push(address);
    const failure = failures.get(address);
    if (failure !== undefined) {
      throw new BlueskyMediaFetchError(failure);
    }
    const asset = assets[address];
    if (!asset) {
      throw new BlueskyMediaFetchError(404);
    }
    return { bytes: asset.bytes, mediaType: asset.mediaType };
  };

  return {
    did,
    calls,

    rateLimitListing: (times, afterMS) => {
      rateLimitsLeft = times;
      rateLimitAfterMS = afterMS;
    },
    failAsset: (address, status = 500) => failures.set(address, status),
    allowAsset: (address) => failures.delete(address),
    setProfile: (update) => {
      profile = { ...profile, ...update };
    },

    listRecords: async ({ collection, cursor }) => {
      calls.listRecords += 1;
      applyRateLimit();
      const page = pageOf(collections[collection] ?? [], cursor);
      return { records: page.slice, cursor: page.cursor };
    },

    getPosts: async (uris) => {
      calls.getPosts += 1;
      return uris
        .map((uri) => postViews.get(uri))
        .filter((post): post is BlueskyPostView => Boolean(post));
    },

    listBookmarks: async ({ cursor }) => {
      calls.listBookmarks += 1;
      applyRateLimit();
      const page = pageOf(options.bookmarks ?? [], cursor);
      return { bookmarks: page.slice, cursor: page.cursor };
    },

    getProfile: async () => {
      calls.getProfile += 1;
      return profile;
    },

    fetchMedia: (url) => fetchAddress(url),
    fetchBlob: (blobDID, cid) => fetchAddress(`blob:${blobDID}/${cid}`),
  };
};
