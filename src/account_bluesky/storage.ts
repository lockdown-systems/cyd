import fs from "fs";
import path from "path";
import crypto from "crypto";

import { getDataPath } from "../util";
import type {
  BlueskyLocalAccountPaths,
  BlueskySavedMedia,
} from "../shared_types";

// Every Bluesky local account owns one UUID-keyed directory. Handles are
// mutable profile data, so they never appear in a path: renaming a Bluesky
// handle must never move a byte on disk.

const ACCOUNT_TYPE_DIRECTORY = "Bluesky";

// Saved data relies on operating-system permissions rather than application
// level encryption, so every directory and file Cyd creates here is owner-only.
const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Windows has no POSIX permission bits, and chmod there is a lie that can
// throw on some filesystems.
const supportsOwnerOnlyPermissions = (): boolean =>
  process.platform !== "win32";

const assertAccountUUID = (accountUUID: string): string => {
  if (!UUID_PATTERN.test(accountUUID)) {
    throw new Error(`Invalid Bluesky local account UUID: ${accountUUID}`);
  }
  return accountUUID.toLowerCase();
};

export const ensureOwnerOnlyDirectory = (directory: string): string => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true, mode: OWNER_ONLY_DIRECTORY });
  }
  if (supportsOwnerOnlyPermissions()) {
    fs.chmodSync(directory, OWNER_ONLY_DIRECTORY);
  }
  return directory;
};

export const ensureOwnerOnlyFile = (filePath: string): string => {
  if (supportsOwnerOnlyPermissions() && fs.existsSync(filePath)) {
    fs.chmodSync(filePath, OWNER_ONLY_FILE);
  }
  return filePath;
};

/**
 * SQLite creates the database and its write-ahead log side by side with
 * default permissions, and saved data lives in the log until it is
 * checkpointed. All three files must be owner-only.
 */
export const ensureOwnerOnlyDatabase = (databasePath: string): string => {
  for (const suffix of ["", "-wal", "-shm"]) {
    ensureOwnerOnlyFile(`${databasePath}${suffix}`);
  }
  return databasePath;
};

/**
 * Where one Bluesky local account keeps its local resources. This only
 * computes paths; nothing is created.
 */
export const blueskyAccountPaths = (
  accountUUID: string,
): BlueskyLocalAccountPaths => {
  const uuid = assertAccountUUID(accountUUID);
  const accountPath = path.join(getDataPath(), ACCOUNT_TYPE_DIRECTORY, uuid);
  return {
    accountPath,
    databasePath: path.join(accountPath, "data.sqlite3"),
    mediaPath: path.join(accountPath, "media"),
    stagingPath: path.join(accountPath, "staging"),
    connectionPath: path.join(accountPath, "connection"),
  };
};

/** Create this account's private directories, owner-only, if they are missing. */
export const ensureBlueskyAccountStorage = (
  accountUUID: string,
): BlueskyLocalAccountPaths => {
  const paths = blueskyAccountPaths(accountUUID);
  ensureOwnerOnlyDirectory(paths.accountPath);
  ensureOwnerOnlyDirectory(paths.mediaPath);
  ensureOwnerOnlyDirectory(paths.stagingPath);
  ensureOwnerOnlyDirectory(paths.connectionPath);
  return paths;
};

/**
 * Permanently remove one account's local resources. Only this account's
 * UUID-keyed directory is touched, so sibling accounts are unaffected.
 */
export const removeBlueskyAccountStorage = (accountUUID: string): void => {
  const paths = blueskyAccountPaths(accountUUID);
  fs.rmSync(paths.accountPath, { recursive: true, force: true });
};

const sha256Digest = (data: Buffer): string =>
  crypto.createHash("sha256").update(data).digest("hex");

/**
 * Where an asset with this digest lives inside an account's media store. The
 * layout matches the Cyd Bluesky archive v2 media layout so translation
 * between runtime storage and an archive stays mechanical.
 */
export const blueskyMediaPath = (mediaPath: string, digest: string): string => {
  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error(`Invalid media digest: ${digest}`);
  }
  return path.join(mediaPath, "sha256", digest.slice(0, 2), digest);
};

export type StoredMediaFile = Omit<BlueskySavedMedia, "mediaType">;

/**
 * Write bytes into an account's content-addressed media store. Storing the
 * same bytes twice reuses the single stored copy.
 */
export const storeBlueskyMediaFile = (
  mediaPath: string,
  data: Buffer,
): StoredMediaFile => {
  const digest = sha256Digest(data);
  const assetPath = blueskyMediaPath(mediaPath, digest);
  ensureOwnerOnlyDirectory(path.dirname(assetPath));

  // Create the asset exclusively, so two jobs saving the same bytes at once
  // cannot half-overwrite one file.
  let deduplicated = false;
  try {
    fs.writeFileSync(assetPath, data, { flag: "wx", mode: OWNER_ONLY_FILE });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    deduplicated = true;
  }
  ensureOwnerOnlyFile(assetPath);

  return {
    digest,
    byteLength: data.length,
    path: assetPath,
    deduplicated,
  };
};

/**
 * Create an isolated scratch directory for one piece of in-progress work.
 * Staging data is disposable: nothing outside it may depend on it.
 */
export const createBlueskyStagingArea = (
  stagingPath: string,
  label: string,
): string => {
  if (!/^[A-Za-z0-9_-]+$/.test(label)) {
    throw new Error(`Invalid staging area label: ${label}`);
  }
  ensureOwnerOnlyDirectory(stagingPath);
  return ensureOwnerOnlyDirectory(path.join(stagingPath, label));
};

/** Remove all staged work for one account, leaving the staging root in place. */
export const clearBlueskyStagingAreas = (stagingPath: string): void => {
  if (!fs.existsSync(stagingPath)) {
    return;
  }
  for (const entry of fs.readdirSync(stagingPath)) {
    fs.rmSync(path.join(stagingPath, entry), { recursive: true, force: true });
  }
};
