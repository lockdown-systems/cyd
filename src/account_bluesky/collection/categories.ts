import type { BlueskyCategory } from "../../shared_types";
import type { BlueskyATClient, BlueskyPostView } from "../at_protocol";
import {
  BLUESKY_LIKE_COLLECTION,
  BLUESKY_POST_COLLECTION,
  BLUESKY_REPOST_COLLECTION,
} from "../at_protocol";
import type {
  BlueskyProfileObservation,
  BlueskyRecordObservation,
} from "./mapping";
import {
  observationFromBookmark,
  observationFromPostView,
  observationFromRelationshipRecord,
  observationFromRepoPost,
} from "./mapping";

/**
 * What each category of public Bluesky record has to supply.
 *
 * This is the whole extent of a category: which AT Protocol calls list it and
 * how its results become observations. Durability, checkpointing, rate-limit
 * backoff, media fetching, cancellation, and storage preflight all live in the
 * engine, so adding a category adds a collector here and nothing else.
 */

/** One page of a category, ready for the engine to commit as a unit. */
export type BlueskyCategoryPage = {
  /**
   * Records to save, ordered so that a record appears after anything it
   * references. Context authorship is resolved from the referenced record, so
   * the order is what makes a single pass enough.
   */
  records: BlueskyRecordObservation[];
  /** The records this category selected on this page. */
  selections: string[];
  /** Relationships and the records they are about. */
  subjects: { relationshipURI: string; subjectRecordURI: string }[];
  /** Where the next page starts, or null at the end of the category. */
  cursor: string | null;
};

export type BlueskyCategoryCollector = {
  category: BlueskyCategory;
  listPage(input: {
    client: BlueskyATClient;
    /** The account's own captured profile, the author of its own records. */
    author: BlueskyProfileObservation;
    cursor: string | null;
    limit: number;
  }): Promise<BlueskyCategoryPage>;
};

/** The repository and record key inside an AT URI. */
const parseATURI = (
  uri: string,
): { did: string; collection: string } | null => {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/(.+)$/.exec(uri);
  return match ? { did: match[1], collection: match[2] } : null;
};

/**
 * A record Cyd knows a relationship points at but could not read.
 *
 * A like whose post has been deleted is still a like, so the relationship
 * keeps a subject: a saved record carrying only what its AT URI says about it,
 * marked as gone from Bluesky. Losing the relationship instead would quietly
 * discard data the account really has.
 */
const tombstoneObservation = (
  uri: string,
  createdAt: string,
  observedAt = new Date().toISOString(),
): BlueskyRecordObservation | null => {
  const parsed = parseATURI(uri);
  if (!parsed) {
    return null;
  }
  return {
    uri,
    cid: null,
    recordType: parsed.collection,
    author: {
      did: parsed.did,
      handle: null,
      displayName: null,
      description: null,
      avatarSourceURL: null,
      bannerSourceURL: null,
    },
    createdAt,
    indexedAt: null,
    sourceDeletedAt: observedAt,
    text: null,
    facets: null,
    payload: {},
    assets: [],
    context: [],
  };
};

/** The URIs a set of observations reference directly, and nothing deeper. */
const directContextURIs = (
  observations: BlueskyRecordObservation[],
): string[] => {
  const uris = new Set<string>();
  for (const observation of observations) {
    for (const context of observation.context) {
      if (context.recordURI) {
        uris.add(context.recordURI);
      }
    }
  }
  return [...uris];
};

/** `getPosts` accepts a bounded number of URIs per call. */
const HYDRATION_BATCH = 25;

const hydrate = async (
  client: BlueskyATClient,
  uris: string[],
): Promise<BlueskyPostView[]> => {
  const posts: BlueskyPostView[] = [];
  for (let index = 0; index < uris.length; index += HYDRATION_BATCH) {
    posts.push(
      ...(await client.getPosts(uris.slice(index, index + HYDRATION_BATCH))),
    );
  }
  return posts;
};

/**
 * The context records a page needs, one level deep.
 *
 * A reply parent's own parent, and a quoted record's own quote, are not
 * followed: context is bounded, so a single post cannot pull a whole
 * conversation into Bluesky saved data.
 */
const hydrateContext = async (
  client: BlueskyATClient,
  observations: BlueskyRecordObservation[],
): Promise<BlueskyRecordObservation[]> => {
  const uris = directContextURIs(observations);
  if (uris.length === 0) {
    return [];
  }
  const posts = await hydrate(client, uris);
  const found = new Set(posts.map((post) => post.uri));
  const context = posts.map((post) => observationFromPostView(post));

  // A context record that has since been deleted is still context: it is kept
  // as a tombstone so the record that referenced it still renders.
  for (const uri of uris) {
    if (!found.has(uri)) {
      const tombstone = tombstoneObservation(uri, new Date().toISOString());
      if (tombstone) {
        context.push(tombstone);
      }
    }
  }
  return context;
};

const postsCollector: BlueskyCategoryCollector = {
  category: "posts",

  listPage: async ({ client, author, cursor, limit }) => {
    // The repository is the authoritative record of what the account
    // published, and its media is still in blob form there, which is what lets
    // Cyd save an own post's images and video at original quality.
    const page = await client.listRecords({
      collection: BLUESKY_POST_COLLECTION,
      cursor: cursor ?? undefined,
      limit,
    });
    const posts = page.records.map((record) =>
      observationFromRepoPost(record, author),
    );
    const context = await hydrateContext(client, posts);

    return {
      records: [...context, ...posts],
      selections: posts.map((post) => post.uri),
      subjects: [],
      cursor: page.cursor ?? null,
    };
  },
};

/**
 * Reposts and likes are the same shape of work: a relationship record in the
 * account's own repository, and the post it is about.
 */
const relationshipCollector = (
  category: "reposts" | "likes",
  collection: typeof BLUESKY_REPOST_COLLECTION | typeof BLUESKY_LIKE_COLLECTION,
): BlueskyCategoryCollector => ({
  category,

  listPage: async ({ client, author, cursor, limit }) => {
    const page = await client.listRecords({
      collection,
      cursor: cursor ?? undefined,
      limit,
    });

    const relationships = page.records.map((record) =>
      observationFromRelationshipRecord(record, collection, author),
    );

    const subjectURIs = [
      ...new Set(
        relationships
          .map((each) => each.subjectURI)
          .filter((uri): uri is string => Boolean(uri)),
      ),
    ];
    const subjectPosts = await hydrate(client, subjectURIs);
    const hydrated = new Map(
      subjectPosts.map((post) => [post.uri, observationFromPostView(post)]),
    );

    const subjects: BlueskyRecordObservation[] = [];
    for (const uri of subjectURIs) {
      const observation = hydrated.get(uri);
      if (observation) {
        subjects.push(observation);
        continue;
      }
      const tombstone = tombstoneObservation(uri, new Date().toISOString());
      if (tombstone) {
        subjects.push(tombstone);
      }
    }

    const context = await hydrateContext(client, subjects);

    return {
      records: [
        ...context,
        ...subjects,
        ...relationships.map((each) => each.observation),
      ],
      selections: relationships.map((each) => each.observation.uri),
      subjects: relationships.flatMap((each) =>
        each.subjectURI
          ? [
              {
                relationshipURI: each.observation.uri,
                subjectRecordURI: each.subjectURI,
              },
            ]
          : [],
      ),
      cursor: page.cursor ?? null,
    };
  },
});

const bookmarksCollector: BlueskyCategoryCollector = {
  category: "bookmarks",

  listPage: async ({ client, author, cursor, limit }) => {
    // Bookmarks are private and come back with the bookmarked post already
    // hydrated, so this needs no second call to read the subjects.
    const page = await client.listBookmarks({
      cursor: cursor ?? undefined,
      limit,
    });

    const bookmarks = page.bookmarks.map((bookmark) => ({
      ...observationFromBookmark(bookmark, author),
      post: bookmark.post,
    }));

    const subjects: BlueskyRecordObservation[] = [];
    for (const bookmark of bookmarks) {
      if (bookmark.post) {
        subjects.push(observationFromPostView(bookmark.post));
        continue;
      }
      const tombstone = tombstoneObservation(
        bookmark.subjectURI,
        bookmark.observation.createdAt,
      );
      if (tombstone) {
        subjects.push(tombstone);
      }
    }

    const context = await hydrateContext(client, subjects);

    return {
      records: [
        ...context,
        ...subjects,
        ...bookmarks.map((each) => each.observation),
      ],
      selections: bookmarks.map((each) => each.observation.uri),
      subjects: bookmarks.map((each) => ({
        relationshipURI: each.observation.uri,
        subjectRecordURI: each.subjectURI,
      })),
      cursor: page.cursor ?? null,
    };
  },
};

const collectors: Record<BlueskyCategory, BlueskyCategoryCollector> = {
  posts: postsCollector,
  reposts: relationshipCollector("reposts", BLUESKY_REPOST_COLLECTION),
  likes: relationshipCollector("likes", BLUESKY_LIKE_COLLECTION),
  bookmarks: bookmarksCollector,
};

export const blueskyCategoryCollector = (
  category: BlueskyCategory,
): BlueskyCategoryCollector => collectors[category];
