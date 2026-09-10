/**
 * Unit tests for Bluesky local account storage layout and its defensive
 * handling of untrusted-looking names.
 */

import "../../../__tests__/platform-fixtures/electronMocks";

import path from "path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";

const pathMocks = createPlatformPathMocks("account_bluesky_storage");

vi.mock("../../../util", async () => {
  const actual =
    await vi.importActual<typeof import("../../../util")>("../../../util");
  return {
    ...actual,
    getDataPath: () => pathMocks.getDataPath(),
  };
});

import {
  blueskyAccountPaths,
  blueskyMediaPath,
  createBlueskyStagingArea,
  ensureBlueskyAccountStorage,
} from "../../storage";

const ACCOUNT_UUID = "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12";

describe("Bluesky local account storage", () => {
  afterEach(() => {
    pathMocks.cleanup();
  });

  test("an account's resources all live under its UUID-keyed directory", () => {
    const paths = blueskyAccountPaths(ACCOUNT_UUID);

    expect(path.basename(path.dirname(paths.accountPath))).toEqual("Bluesky");
    expect(path.basename(paths.accountPath)).toEqual(ACCOUNT_UUID);
    for (const resource of [
      paths.databasePath,
      paths.mediaPath,
      paths.stagingPath,
      paths.connectionPath,
    ]) {
      expect(path.dirname(resource)).toEqual(paths.accountPath);
    }
  });

  test("only real UUIDs can name an account directory", () => {
    for (const notAUUID of [
      "",
      "alice.bsky.social",
      "..",
      `../../${ACCOUNT_UUID}`,
      `${ACCOUNT_UUID}/../../etc`,
    ]) {
      expect(() => blueskyAccountPaths(notAUUID)).toThrow(
        /Invalid Bluesky local account UUID/,
      );
    }
  });

  test("media is addressed by digest, matching the Cyd Bluesky archive layout", () => {
    const digest = "a".repeat(64);
    const mediaPath = blueskyAccountPaths(ACCOUNT_UUID).mediaPath;

    expect(blueskyMediaPath(mediaPath, digest)).toEqual(
      path.join(mediaPath, "sha256", "aa", digest),
    );
    expect(() => blueskyMediaPath(mediaPath, "../escape")).toThrow(
      /Invalid media digest/,
    );
  });

  test("staging area labels cannot escape the staging directory", () => {
    const paths = ensureBlueskyAccountStorage(ACCOUNT_UUID);

    expect(createBlueskyStagingArea(paths.stagingPath, "import-1")).toEqual(
      path.join(paths.stagingPath, "import-1"),
    );
    expect(() =>
      createBlueskyStagingArea(paths.stagingPath, "../elsewhere"),
    ).toThrow(/Invalid staging area label/);
  });
});
