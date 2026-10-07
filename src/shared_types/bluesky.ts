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
