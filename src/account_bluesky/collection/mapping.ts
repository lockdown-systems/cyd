import {
  BLUESKY_LIKE_COLLECTION,
  BLUESKY_POST_COLLECTION,
  BLUESKY_REPOST_COLLECTION,
} from "../../shared_types";
import type { BlueskyPostView, BlueskyRepoRecord } from "../at_protocol";

/**
 * Turning AT Protocol shapes into Bluesky saved records.
 *
 * Everything here is pure: it reads lexicon values and produces observations,
 * touching neither the network nor storage. That is what keeps the collection
 * engine category-agnostic — a new category supplies a mapping here and an API
 * surface in its collector, and inherits durability for free.
 */

/** A captured author's labels at the moment a record was observed. */
export type BlueskyProfileObservation = {
  did: string;
  handle: string | null;
  displayName: string | null;
  description: string | null;
  avatarSourceURL: string | null;
  bannerSourceURL: string | null;
};

/** Where an asset's bytes come from. */
export type BlueskyAssetSource =
  | { type: "url"; url: string }
  /** A blob, which is the only place a full video's bytes exist. */
  | { type: "blob"; did: string; cid: string };

/**
 * How an asset's source is written down for storage, and read back.
 *
 * A stored asset keeps one address rather than a column per kind of source, so
 * encoding and decoding it are defined together here: splitting them across the
 * writer and the reader is how the two drift apart.
 */
export const blueskyAssetAddress = (source: BlueskyAssetSource): string =>
  source.type === "url" ? source.url : `blob:${source.did}/${source.cid}`;

export const blueskyAssetSourceFromAddress = (
  address: string,
): BlueskyAssetSource | null => {
  if (!address) {
    return null;
  }
  const blob = /^blob:([^/]+)\/(.+)$/.exec(address);
  return blob
    ? { type: "blob", did: blob[1], cid: blob[2] }
    : { type: "url", url: address };
};

/** An asset a saved record or profile is expected to have. */
export type BlueskyExpectedAsset = {
  kind: "image" | "preview" | "thumbnail" | "video";
  role: "content" | "preview" | "thumbnail" | "avatar" | "banner";
  position: number;
  /** What Cyd expects the bytes to be; the fetch corrects it. */
  mediaType: string;
  source: BlueskyAssetSource;
  width: number | null;
  height: number | null;
  altText: string | null;
};

/** One piece of directly referenced context, never a whole thread. */
export type BlueskyContextObservation = {
  kind: "reply_parent" | "quote" | "external";
  /** The referenced record, for a reply parent or a quote. */
  recordURI: string | null;
  external: {
    uri: string;
    title: string | null;
    description: string | null;
  } | null;
};

/** The latest observation of one record at a stable AT URI. */
export type BlueskyRecordObservation = {
  uri: string;
  cid: string | null;
  recordType: string;
  author: BlueskyProfileObservation;
  createdAt: string;
  indexedAt: string | null;
  /**
   * When Cyd saw that Bluesky no longer had this record, for a record it knows
   * of but could not read. Null means it was there when it was observed.
   */
  sourceDeletedAt: string | null;
  text: string | null;
  facets: unknown[] | null;
  payload: Record<string, unknown>;
  assets: BlueskyExpectedAsset[];
  context: BlueskyContextObservation[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" ? value : null;

/**
 * The CID inside a blob reference. Lexicon values arrive with the reference
 * already parsed into a CID object or still in its JSON `$link` form depending
 * on how they were transported, and both mean the same blob.
 */
const blobCID = (blob: unknown): string | null => {
  const record = asRecord(blob);
  if (!record) {
    return null;
  }
  const ref = record.ref;
  if (typeof ref === "string") {
    return ref;
  }
  const refRecord = asRecord(ref);
  if (!refRecord) {
    return null;
  }
  const link = asString(refRecord.$link);
  if (link) {
    return link;
  }
  return typeof refRecord.toString === "function" &&
    refRecord.toString !== Object.prototype.toString
    ? refRecord.toString()
    : null;
};

const aspectRatio = (
  value: unknown,
): { width: number | null; height: number | null } => {
  const ratio = asRecord(value);
  return {
    width: ratio ? asNumber(ratio.width) : null,
    height: ratio ? asNumber(ratio.height) : null,
  };
};

const DEFAULT_IMAGE_MEDIA_TYPE = "image/jpeg";
const DEFAULT_VIDEO_MEDIA_TYPE = "video/mp4";

/** The embed value, whether it is on the record itself or on a hydrated view. */
const embedOf = (
  value: Record<string, unknown>,
): Record<string, unknown> | null => asRecord(value.embed);

/**
 * An embed's lexicon type without its `#view` suffix, so a record embed and the
 * view the AppView renders for it are recognized by the same name.
 */
const embedType = (embed: Record<string, unknown>): string =>
  (asString(embed.$type) ?? "").split("#")[0];

/**
 * The quoted record inside an embed, whether it stands alone or sits beside
 * media in a `recordWithMedia` embed.
 */
const quotedRecordURI = (embed: Record<string, unknown>): string | null => {
  const type = embedType(embed);
  if (type === "app.bsky.embed.record") {
    const inner = asRecord(embed.record);
    // A record embed holds a strong ref; the view holds a whole record view
    // that carries its own URI.
    return inner ? asString(inner.uri) : null;
  }
  if (type === "app.bsky.embed.recordWithMedia") {
    const inner = asRecord(embed.record);
    return inner ? quotedRecordURI(inner) : null;
  }
  return null;
};

/** The media half of an embed, which `recordWithMedia` nests one level down. */
const mediaEmbed = (
  embed: Record<string, unknown>,
): Record<string, unknown> | null =>
  embedType(embed) === "app.bsky.embed.recordWithMedia"
    ? asRecord(embed.media)
    : embed;

const externalObservation = (
  embed: Record<string, unknown>,
): BlueskyContextObservation | null => {
  const external = asRecord(embed.external);
  const uri = external ? asString(external.uri) : null;
  if (!external || !uri) {
    return null;
  }
  return {
    kind: "external",
    recordURI: null,
    external: {
      uri,
      title: asString(external.title),
      description: asString(external.description),
    },
  };
};

/**
 * The assets an embed expects.
 *
 * `ownRepoDID` is set when the embed came from a raw repository record, whose
 * media is still in blob form: those bytes are fetched from the repository
 * itself, which is both the original quality and the only way to get a full
 * video. A hydrated view instead publishes URLs, except for video, where the
 * view offers a streaming playlist and a thumbnail and the whole file remains
 * a blob in its author's repository.
 */
const embedAssets = (
  embed: Record<string, unknown>,
  authorDID: string,
  ownRepoDID: string | null,
): BlueskyExpectedAsset[] => {
  const media = mediaEmbed(embed);
  if (!media) {
    return [];
  }

  switch (embedType(media)) {
    case "app.bsky.embed.images": {
      const images = Array.isArray(media.images) ? media.images : [];
      return images.flatMap((image, position) => {
        const value = asRecord(image);
        if (!value) {
          return [];
        }
        const ratio = aspectRatio(value.aspectRatio);
        const source = ownRepoDID
          ? blobSource(value.image, ownRepoDID)
          : urlSource(value.fullsize);
        if (!source) {
          return [];
        }
        return [
          {
            kind: "image" as const,
            role: "content" as const,
            position,
            mediaType: blobMediaType(value.image) ?? DEFAULT_IMAGE_MEDIA_TYPE,
            source,
            width: ratio.width,
            height: ratio.height,
            altText: asString(value.alt),
          },
        ];
      });
    }

    case "app.bsky.embed.video": {
      const assets: BlueskyExpectedAsset[] = [];
      const ratio = aspectRatio(media.aspectRatio);
      const videoSource = ownRepoDID
        ? blobSource(media.video, ownRepoDID)
        : blobFromViewCID(media.cid, authorDID);
      if (videoSource) {
        assets.push({
          kind: "video",
          role: "content",
          position: 0,
          mediaType: blobMediaType(media.video) ?? DEFAULT_VIDEO_MEDIA_TYPE,
          source: videoSource,
          width: ratio.width,
          height: ratio.height,
          altText: asString(media.alt),
        });
      }
      const thumbnail = urlSource(media.thumbnail);
      if (thumbnail) {
        assets.push({
          kind: "thumbnail",
          role: "thumbnail",
          position: 0,
          mediaType: DEFAULT_IMAGE_MEDIA_TYPE,
          source: thumbnail,
          width: null,
          height: null,
          altText: null,
        });
      }
      return assets;
    }

    case "app.bsky.embed.external": {
      const external = asRecord(media.external);
      if (!external) {
        return [];
      }
      const source = ownRepoDID
        ? blobSource(external.thumb, ownRepoDID)
        : urlSource(external.thumb);
      if (!source) {
        return [];
      }
      return [
        {
          kind: "preview",
          role: "preview",
          position: 0,
          mediaType: blobMediaType(external.thumb) ?? DEFAULT_IMAGE_MEDIA_TYPE,
          source,
          width: null,
          height: null,
          altText: null,
        },
      ];
    }

    default:
      return [];
  }
};

const blobSource = (blob: unknown, did: string): BlueskyAssetSource | null => {
  const cid = blobCID(blob);
  return cid ? { type: "blob", did, cid } : null;
};

const blobFromViewCID = (
  cid: unknown,
  did: string,
): BlueskyAssetSource | null => {
  const value = asString(cid);
  return value ? { type: "blob", did, cid: value } : null;
};

const urlSource = (url: unknown): BlueskyAssetSource | null => {
  const value = asString(url);
  return value ? { type: "url", url: value } : null;
};

const blobMediaType = (blob: unknown): string | null => {
  const record = asRecord(blob);
  return record ? asString(record.mimeType) : null;
};

/** The avatar a captured author is expected to have. */
export const profileAssets = (
  profile: BlueskyProfileObservation,
): BlueskyExpectedAsset[] => {
  const assets: BlueskyExpectedAsset[] = [];
  if (profile.avatarSourceURL) {
    assets.push({
      kind: "image",
      role: "avatar",
      position: 0,
      mediaType: DEFAULT_IMAGE_MEDIA_TYPE,
      source: { type: "url", url: profile.avatarSourceURL },
      width: null,
      height: null,
      altText: null,
    });
  }
  if (profile.bannerSourceURL) {
    assets.push({
      kind: "image",
      role: "banner",
      position: 0,
      mediaType: DEFAULT_IMAGE_MEDIA_TYPE,
      source: { type: "url", url: profile.bannerSourceURL },
      width: null,
      height: null,
      altText: null,
    });
  }
  return assets;
};

const postContext = (
  value: Record<string, unknown>,
): BlueskyContextObservation[] => {
  const context: BlueskyContextObservation[] = [];

  // Only the direct parent, never the root and never the thread above it.
  const reply = asRecord(value.reply);
  const parent = reply ? asRecord(reply.parent) : null;
  const parentURI = parent ? asString(parent.uri) : null;
  if (parentURI) {
    context.push({
      kind: "reply_parent",
      recordURI: parentURI,
      external: null,
    });
  }

  const embed = embedOf(value);
  if (embed) {
    const quoted = quotedRecordURI(embed);
    if (quoted) {
      context.push({ kind: "quote", recordURI: quoted, external: null });
    }
    const media = mediaEmbed(embed);
    const external = media ? externalObservation(media) : null;
    if (external) {
      context.push(external);
    }
  }

  return context;
};

const facetsOf = (value: Record<string, unknown>): unknown[] | null =>
  Array.isArray(value.facets) ? value.facets : null;

/**
 * A post from the account's own repository.
 *
 * Raw repository records are the authoritative form of what the account
 * published, and their media is still in blob form, so this is what saves an
 * own post's images and videos at their original quality.
 */
export const observationFromRepoPost = (
  repoRecord: BlueskyRepoRecord,
  author: BlueskyProfileObservation,
): BlueskyRecordObservation => {
  const value = repoRecord.value;
  const embed = embedOf(value);
  return {
    uri: repoRecord.uri,
    cid: repoRecord.cid,
    recordType: BLUESKY_POST_COLLECTION,
    author,
    createdAt: asString(value.createdAt) ?? new Date().toISOString(),
    indexedAt: null,
    sourceDeletedAt: null,
    text: asString(value.text),
    facets: facetsOf(value),
    payload: value,
    assets: embed ? embedAssets(embed, author.did, author.did) : [],
    context: postContext(value),
  };
};

/** The author a hydrated view was observed with. */
const authorFromPostView = (
  post: BlueskyPostView,
): BlueskyProfileObservation => ({
  did: post.author.did,
  handle: post.author.handle ?? null,
  displayName: post.author.displayName ?? null,
  description: null,
  avatarSourceURL: post.author.avatar ?? null,
  bannerSourceURL: null,
});

/**
 * A post Cyd hydrated by AT URI: the subject of a repost, like, or bookmark,
 * or a reply parent or quoted record captured as context.
 *
 * Its media comes from the URLs the AppView publishes, except a video, whose
 * full bytes still live as a blob in its author's repository — which is how a
 * liked video is saved whole rather than as a thumbnail.
 */
export const observationFromPostView = (
  post: BlueskyPostView,
): BlueskyRecordObservation => {
  const author = authorFromPostView(post);
  const value = post.record;
  const embed = asRecord(post.embed);
  return {
    uri: post.uri,
    cid: post.cid,
    recordType: asString(value.$type) ?? BLUESKY_POST_COLLECTION,
    author,
    createdAt:
      asString(value.createdAt) ?? post.indexedAt ?? new Date().toISOString(),
    indexedAt: post.indexedAt ?? null,
    sourceDeletedAt: null,
    text: asString(value.text),
    facets: facetsOf(value),
    payload: value,
    assets: embed ? embedAssets(embed, author.did, null) : [],
    context: postContext(value),
  };
};

/**
 * A repost or like from the account's own repository.
 *
 * The relationship is a record in its own right, with its own AT URI, and the
 * post it is about is a separate saved record linked to it.
 */
export const observationFromRelationshipRecord = (
  repoRecord: BlueskyRepoRecord,
  recordType: typeof BLUESKY_REPOST_COLLECTION | typeof BLUESKY_LIKE_COLLECTION,
  author: BlueskyProfileObservation,
): { observation: BlueskyRecordObservation; subjectURI: string | null } => {
  const value = repoRecord.value;
  const subject = asRecord(value.subject);
  return {
    observation: {
      uri: repoRecord.uri,
      cid: repoRecord.cid,
      recordType,
      author,
      createdAt: asString(value.createdAt) ?? new Date().toISOString(),
      indexedAt: null,
      sourceDeletedAt: null,
      text: null,
      facets: null,
      payload: value,
      assets: [],
      context: [],
    },
    subjectURI: subject ? asString(subject.uri) : null,
  };
};
