import log from "electron-log/main";

import { Agent } from "@atproto/api";

import { restoreBlueskySession } from "../bluesky_oauth";

/**
 * The AT Protocol surface the Bluesky collection engine uses.
 *
 * Cyd reads Bluesky through authenticated AT Protocol calls: there is no
 * scraping, no interception, and no app password. This interface is the single
 * seam between the engine and the network, which is what lets controller tests
 * drive the whole engine against a fake while still writing to real storage.
 *
 * The shapes it returns are AT Protocol shapes, not Cyd shapes. Translating
 * them into Bluesky saved records is `collection/mapping.ts`'s job, so a fake
 * exercises that translation instead of standing in for it.
 */

/** A record as it exists in a repository: its AT URI, CID, and raw value. */
export type BlueskyRepoRecord = {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
};

export type BlueskyRepoRecordPage = {
  records: BlueskyRepoRecord[];
  /** Where the next page starts, or undefined at the end of the collection. */
  cursor?: string;
};

/** A hydrated post, as the AppView renders it. Structurally a `PostView`. */
export type BlueskyPostView = {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  record: Record<string, unknown>;
  embed?: Record<string, unknown>;
  indexedAt?: string;
};

/** One bookmark from the account's private bookmark stash. */
export type BlueskyBookmark = {
  subject: { uri: string; cid?: string };
  createdAt?: string;
  /** The bookmarked post, absent when it is blocked or no longer there. */
  post?: BlueskyPostView;
};

export type BlueskyBookmarkPage = {
  bookmarks: BlueskyBookmark[];
  cursor?: string;
};

/** An identity's current profile, including its published post count. */
export type BlueskyProfileView = {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  postsCount?: number;
};

/** Bytes Cyd fetched for one asset. */
export type BlueskyFetchedMedia = {
  bytes: Buffer;
  mediaType: string;
};

export interface BlueskyATClient {
  /** The identity Cyd is acting as. */
  readonly did: string;

  /** One page of a collection in this identity's own repository. */
  listRecords(input: {
    collection: string;
    cursor?: string;
    limit: number;
  }): Promise<BlueskyRepoRecordPage>;

  /**
   * Hydrated views of records by AT URI. A URI that comes back missing was
   * deleted or hidden at the source, which is a fact to record rather than an
   * error.
   */
  getPosts(uris: string[]): Promise<BlueskyPostView[]>;

  /** One page of the account's bookmarks. */
  listBookmarks(input: {
    cursor?: string;
    limit: number;
  }): Promise<BlueskyBookmarkPage>;

  /** This identity's current profile. */
  getProfile(): Promise<BlueskyProfileView>;

  /** Fetch an asset the AppView published a URL for. */
  fetchMedia(url: string): Promise<BlueskyFetchedMedia>;

  /**
   * Fetch a blob from the repository that holds it. Full videos only exist as
   * blobs, so this is how a liked video gets saved whole rather than as the
   * thumbnail the AppView hands out.
   */
  fetchBlob(did: string, cid: string): Promise<BlueskyFetchedMedia>;
}

/** Collections in a repository, one per category of public record. */
export const BLUESKY_POST_COLLECTION = "app.bsky.feed.post";
export const BLUESKY_REPOST_COLLECTION = "app.bsky.feed.repost";
export const BLUESKY_LIKE_COLLECTION = "app.bsky.feed.like";

/**
 * Cyd's own record type for a bookmark.
 *
 * Bookmarks live in a private stash rather than the repository, so Bluesky
 * gives the bookmark itself no AT URI — only the post it points at. Cyd mints
 * one deterministically from the subject so the bookmark still has the stable
 * identifier every saved record needs, and so collecting twice recognizes the
 * same bookmark instead of saving a second one.
 */
export const BLUESKY_BOOKMARK_COLLECTION = "app.cyd.bookmark";

const DEFAULT_MEDIA_TYPE = "application/octet-stream";

const fetchedMedia = async (
  response: Response,
): Promise<BlueskyFetchedMedia> => {
  if (!response.ok) {
    throw new BlueskyMediaFetchError(response.status);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mediaType: response.headers.get("content-type") ?? DEFAULT_MEDIA_TYPE,
  };
};

/**
 * An asset Bluesky would not hand over. The status is what tells the engine
 * whether the asset is gone for good or merely out of reach for now, and it
 * carries no URL, so it is safe in a diagnostic.
 */
export class BlueskyMediaFetchError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Bluesky refused a media request with status ${status}`);
    this.name = "BlueskyMediaFetchError";
    this.status = status;
  }
}

/**
 * A client bound to one authorized identity.
 *
 * Every call goes through the shared Bluesky OAuth session for that DID, so
 * collection uses the same authorization the rest of Cyd does and one identity
 * is never signed in twice.
 */
export const createBlueskyATClient = async (
  did: string,
): Promise<BlueskyATClient> => {
  const session = await restoreBlueskySession(did);
  const agent = new Agent(session);

  return {
    did,

    listRecords: async ({ collection, cursor, limit }) => {
      const response = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection,
        cursor,
        limit,
      });
      return {
        records: response.data.records.map((record) => ({
          uri: record.uri,
          cid: record.cid,
          value: record.value as Record<string, unknown>,
        })),
        cursor: response.data.cursor,
      };
    },

    getPosts: async (uris) => {
      if (uris.length === 0) {
        return [];
      }
      const response = await agent.app.bsky.feed.getPosts({ uris });
      return response.data.posts as unknown as BlueskyPostView[];
    },

    listBookmarks: async ({ cursor, limit }) => {
      const response = await agent.app.bsky.bookmark.getBookmarks({
        cursor,
        limit,
      });
      return {
        bookmarks: response.data.bookmarks.map((bookmark) => ({
          subject: bookmark.subject,
          createdAt: bookmark.createdAt,
          // A blocked or deleted bookmarked post comes back as a different
          // union member, and there is nothing to hydrate from it.
          post:
            bookmark.item?.$type === "app.bsky.feed.defs#postView"
              ? (bookmark.item as unknown as BlueskyPostView)
              : undefined,
        })),
        cursor: response.data.cursor,
      };
    },

    getProfile: async () => {
      const response = await agent.getProfile({ actor: did });
      return response.data as BlueskyProfileView;
    },

    fetchMedia: async (url) => fetchedMedia(await fetch(url)),

    fetchBlob: async (blobDID, cid) => {
      try {
        const response = await agent.com.atproto.sync.getBlob({
          did: blobDID,
          cid,
        });
        return {
          bytes: Buffer.from(response.data),
          mediaType: response.headers["content-type"] ?? DEFAULT_MEDIA_TYPE,
        };
      } catch (error) {
        // The blob's own repository is the only place it exists, so a refusal
        // here is the asset being unavailable rather than a bug. The error is
        // logged without the identity or the CID.
        log.info("Bluesky: a blob could not be fetched");
        throw error;
      }
    },
  };
};
