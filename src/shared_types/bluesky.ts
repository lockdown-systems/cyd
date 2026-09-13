import type { PlatformJob } from "./common";

// Types for Bluesky local accounts.
//
// A Bluesky local account is this installation's local representation of a
// Bluesky identity. It is identified inside Cyd by its Cyd UUID, while the
// Bluesky DID is the durable social identity. Handles and display names are
// mutable profile data and never appear in storage paths.

/**
 * Current profile data for a Bluesky identity, as fetched from its PDS.
 *
 * The DID is the identity; the handle, display name, and avatar are mutable
 * and are refreshed on every connection. None of them ever determines where
 * anything is stored.
 */
export type BlueskyIdentityProfile = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
};

/** Where one Bluesky local account keeps its isolated local resources. */
export type BlueskyLocalAccountPaths = {
  /** UUID-keyed root directory that owns everything below it. */
  accountPath: string;
  /** The account's private runtime database. */
  databasePath: string;
  /** Content-addressed media store for this account only. */
  mediaPath: string;
  /** Scratch space for in-progress work, safe to delete when idle. */
  stagingPath: string;
};

/** A media asset stored in one account's content-addressed media store. */
export type BlueskyStoredMedia = {
  /** Lowercase hex SHA-256 digest of the asset's bytes. */
  digest: string;
  byteLength: number;
  mediaType: string;
  /** Absolute path of the stored asset inside this account's media store. */
  path: string;
};

/** The result of saving media, which may already have been stored. */
export type BlueskySavedMedia = BlueskyStoredMedia & {
  /** True when this account already held the identical bytes. */
  deduplicated: boolean;
};

export type BlueskyJob = PlatformJob & {
  jobType: string; // "savePosts"
  scheduledAt: Date;
};

/**
 * Permanently deleting a Bluesky local account is irreversible, so the caller
 * must name the account UUID it means to destroy.
 */
export type BlueskyDeleteConfirmation = {
  confirmedAccountUUID: string;
};

/**
 * The AT Protocol collections Cyd saves from, which are also the record types a
 * saved record carries. Shared by both processes so the renderer recognizes a
 * repost or a like by the same name the collection engine wrote.
 */
export const BLUESKY_POST_COLLECTION = "app.bsky.feed.post";
export const BLUESKY_REPOST_COLLECTION = "app.bsky.feed.repost";
export const BLUESKY_LIKE_COLLECTION = "app.bsky.feed.like";

// Collection: the categories of public Bluesky records Cyd can save.

/**
 * A category of Bluesky saved data that can be enabled and collected on its
 * own. Every category is optional and independent, and turning one off only
 * stops future collection: it never deletes what is already saved.
 */
export const blueskyPublicCategories = [
  "posts",
  "reposts",
  "likes",
  "bookmarks",
] as const;

export type BlueskyCategory = (typeof blueskyPublicCategories)[number];

export const isBlueskyCategory = (value: string): value is BlueskyCategory =>
  (blueskyPublicCategories as readonly string[]).includes(value);

/**
 * The job type that saves one category.
 *
 * Both sides of the IPC boundary need to agree on this name — the renderer to
 * create the job, the main process to turn it back into a category — so it is
 * defined once, here.
 */
export const blueskySaveJobType = (category: BlueskyCategory): string =>
  `save${category.charAt(0).toUpperCase()}${category.slice(1)}`;

/** The category a save job is for, or null when the job type is not one. */
export const blueskyCategoryOfJobType = (
  jobType: string,
): BlueskyCategory | null => {
  const category = jobType.startsWith("save")
    ? `${jobType.charAt(4).toLowerCase()}${jobType.slice(5)}`
    : "";
  return isBlueskyCategory(category) ? category : null;
};

/** Which categories this account saves. Absent means not yet chosen. */
export type BlueskyCategorySettings = Record<BlueskyCategory, boolean>;

/**
 * Whether a media asset Cyd expects is actually here.
 *
 * `missing` and `unavailable` are both explicit and both retryable, and both
 * make the backup incomplete. They differ in what Cyd knows: `missing` means
 * the asset has not been fetched successfully yet, while `unavailable` means
 * the source said it is gone. Neither invalidates the record it belongs to.
 */
export type BlueskyAssetAvailability = "available" | "missing" | "unavailable";

/** A media asset one saved record or profile expects to have. */
export type BlueskyAsset = {
  id: string;
  kind: "image" | "preview" | "thumbnail" | "video";
  mediaType: string;
  availability: BlueskyAssetAvailability;
  /** Why the asset is not here, and always set when it is not. */
  unavailableReason: string | null;
  byteCount: number | null;
  /** Digest in this account's media store, once the bytes are here. */
  digest: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
};

/**
 * How far a category has got, durably enough to survive a restart.
 *
 * The stage is what a restart resumes: a job interrupted while fetching media
 * does not list the category's records again.
 */
export type BlueskyCollectionStage = "listing" | "media" | "done";

export type BlueskyCollectionCheckpoint = {
  category: BlueskyCategory;
  stage: BlueskyCollectionStage;
  /** Where the next page of listing starts, or null when listing finished. */
  cursor: string | null;
  pagesListed: number;
  recordsSaved: number;
  mediaSaved: number;
  mediaFailed: number;
  updatedAt: Date;
};

/**
 * Progress of one collection job.
 *
 * This is operational metadata only — category, stage, counts, and timing. It
 * carries no record text, media, handles, DIDs, or local paths, so it is safe
 * to show, log, and put in an automatic diagnostic.
 *
 * See docs/adr/0029-minimize-bluesky-diagnostics.md.
 */
export type BlueskyCollectionProgress = {
  category: BlueskyCategory;
  stage: BlueskyCollectionStage;
  pagesListed: number;
  recordsSaved: number;
  mediaSaved: number;
  mediaFailed: number;
  mediaPending: number;
  rateLimitedUntil: string | null;
  rateLimitOccurrences: number;
  cancelled: boolean;
};

export const emptyBlueskyCollectionProgress = (
  category: BlueskyCategory,
): BlueskyCollectionProgress => ({
  category,
  stage: "listing",
  pagesListed: 0,
  recordsSaved: 0,
  mediaSaved: 0,
  mediaFailed: 0,
  mediaPending: 0,
  rateLimitedUntil: null,
  rateLimitOccurrences: 0,
  cancelled: false,
});

/** Why a collection job stopped. */
export type BlueskyCollectionOutcome =
  | "finished"
  | "cancelled"
  | "outOfSpace"
  | "failed";

export type BlueskyCollectionResult = {
  outcome: BlueskyCollectionOutcome;
  progress: BlueskyCollectionProgress;
  /** The class of error that stopped the job, never its message. */
  errorClass: string | null;
};

/**
 * What a collection run is expected to need on disk, and what is there.
 *
 * Cyd cannot know how much a Bluesky account will take before it reads it:
 * only its own post count is published, and media sizes are not. So an
 * estimate is offered as an estimate, `certainBytes` is the part Cyd already
 * knows it must fetch, and a run is refused only when even that certain part
 * does not fit.
 */
export type BlueskyStoragePreflight = {
  categories: {
    category: BlueskyCategory;
    /** Records to collect, or null when Bluesky does not publish a count. */
    recordCount: number | null;
  }[];
  /** Bytes Cyd has already enumerated and knows it still has to fetch. */
  certainBytes: number;
  /** Best estimate of the whole run, certain part included. */
  estimatedBytes: number;
  /** Free space on the volume holding this account's storage. */
  availableBytes: number;
  /** True when at least one category's size could not be known in advance. */
  uncertain: boolean;
  /** Refuse to start only when insufficiency is certain. */
  sufficiency: "sufficient" | "uncertain" | "insufficient";
};

// Browse: reading Bluesky saved data offline.

/** A captured author, as it was observed when the record was saved. */
export type BlueskySavedAuthor = {
  profileID: string;
  did: string;
  handle: string | null;
  displayName: string | null;
  avatar: BlueskyAsset | null;
};

/** The bounded context captured so a saved record still renders faithfully. */
export type BlueskySavedContext = {
  kind: "reply_parent" | "quote" | "external";
  /** The referenced record, when Cyd captured it. */
  record: BlueskySavedRecordSummary | null;
  external: {
    uri: string;
    title: string | null;
    description: string | null;
  } | null;
};

export type BlueskySavedRecordSummary = {
  uri: string;
  recordType: string;
  author: BlueskySavedAuthor | null;
  createdAt: string;
  text: string | null;
  sourceDeletedAt: string | null;
  assets: BlueskyAsset[];
};

/** One entry in a Browse view, complete enough to render without the network. */
export type BlueskySavedRecord = BlueskySavedRecordSummary & {
  cid: string | null;
  indexedAt: string | null;
  firstObservedAt: string;
  observedAt: string;
  /** For reposts, likes, and bookmarks: the record the relationship is about. */
  subject: BlueskySavedRecordSummary | null;
  context: BlueskySavedContext[];
  /** Where to read it on Bluesky, when it has a public address. */
  sourceURL: string | null;
};

/** One chronological page of a Browse view. */
export type BlueskyBrowsePage = {
  category: BlueskyCategory;
  records: BlueskySavedRecord[];
  /** Pass back as `before` to get the next, older page. */
  nextCursor: string | null;
  totalRecords: number;
};

/** How much of each category this account has saved, and how complete it is. */
export type BlueskySavedDataSummary = {
  categories: {
    category: BlueskyCategory;
    recordCount: number;
    assetsExpected: number;
    assetsAvailable: number;
  }[];
  /** True when every expected asset for every saved record is here. */
  complete: boolean;
};
