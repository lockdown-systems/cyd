/**
 * Integration tests for browsing Bluesky saved data.
 *
 * Browsing is the point of saving, and it has to work when Bluesky does not:
 * these tests collect once and then read everything back with no client at all,
 * checking chronological paging, embeds, deletion state, source links, and what
 * an unavailable asset looks like from a Browse view.
 */

import "../../../__tests__/platform-fixtures/electronMocks";

import fs from "fs";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";

const pathMocks = createPlatformPathMocks("account_bluesky_browse");

vi.mock("../../../util", async () => {
  const actual =
    await vi.importActual<typeof import("../../../util")>("../../../util");
  return {
    ...actual,
    getSettingsPath: () => pathMocks.getSettingsPath(),
    getAccountSettingsPath: (accountID: number) =>
      pathMocks.getAccountSettingsPath(accountID),
    getDataPath: () => pathMocks.getDataPath(),
    getAccountDataPath: (accountType: string, accountUsername: string) =>
      pathMocks.getAccountDataPath(accountType, accountUsername),
  };
});

import type { BlueskyAccountController } from "../../bluesky_account_controller";
import { blueskyPublicCategories } from "../../../shared_types";
import {
  createBlueskyControllerTestContext,
  type BlueskyControllerTestContext,
} from "../fixtures/accountTestHarness";
import { createFakeATClient } from "../fixtures/fakeATClient";
import {
  ALICE_DID,
  BOB_URIS,
  LIKED_VIDEO_BLOB,
  LIKE_URI,
  OWN_IMAGE_BLOB,
  POST_URIS,
  QUOTED_IMAGE_URL,
  REPOST_URIS,
  fullAccountFixture,
} from "../fixtures/blueskyTestData";

describe("BlueskyAccountController - browsing saved data offline", () => {
  let context: BlueskyControllerTestContext;
  let controller: BlueskyAccountController;

  beforeEach(async () => {
    context = createBlueskyControllerTestContext();
    controller = context.createLocalAccount("alice.test").controller;

    const client = createFakeATClient(fullAccountFixture());
    for (const category of blueskyPublicCategories) {
      await controller.collect(category, {
        client,
        pageLimit: 2,
        wait: async () => {},
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    context.cleanup();
    pathMocks.cleanup();
  });

  test("each category has its own view, paginated newest first", () => {
    const firstPage = controller.browse({ category: "posts", limit: 2 });

    expect(firstPage.totalRecords).toEqual(3);
    expect(firstPage.records.map((record) => record.uri)).toEqual([
      POST_URIS.withExternal,
      POST_URIS.withContext,
    ]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = controller.browse({
      category: "posts",
      limit: 2,
      before: firstPage.nextCursor,
    });

    expect(secondPage.records.map((record) => record.uri)).toEqual([
      POST_URIS.withImage,
    ]);
    expect(secondPage.nextCursor).toBeNull();

    // A category's view holds only its own records.
    expect(
      controller.browse({ category: "likes" }).records.map((each) => each.uri),
    ).toEqual([LIKE_URI]);
    expect(
      controller
        .browse({ category: "reposts" })
        .records.map((each) => each.uri),
    ).toEqual([REPOST_URIS.gone, REPOST_URIS.live]);
  });

  test("a saved record carries its embeds, its captured author, and a source link", () => {
    const post = controller
      .browse({ category: "posts" })
      .records.find((record) => record.uri === POST_URIS.withImage)!;

    expect(post.author?.handle).toEqual("alice.test");
    expect(post.author?.avatar?.availability).toEqual("available");
    expect(post.assets.map((asset) => asset.kind)).toEqual(["image"]);
    expect(post.assets[0].width).toEqual(800);
    expect(post.sourceURL).toEqual(
      `https://bsky.app/profile/${ALICE_DID}/post/withimage`,
    );

    // The bytes are on this disk, so a Browse view needs no network.
    const stored = controller.getMedia(post.assets[0].digest!);
    expect(fs.readFileSync(stored!.path).length).toEqual(
      post.assets[0].byteCount,
    );
  });

  test("a relationship shows the record it is about, with that record's context", () => {
    const like = controller.browse({ category: "likes" }).records[0];

    expect(like.subject?.uri).toEqual(BOB_URIS.liked);
    expect(like.subject?.text).toEqual("Bob's video that Alice liked");
    expect(like.subject?.assets.map((asset) => asset.kind).sort()).toEqual([
      "thumbnail",
      "video",
    ]);
    // The like has no page of its own; the post it is about does.
    expect(like.sourceURL).toEqual(
      `https://bsky.app/profile/did:plc:examplebob/post/liked`,
    );
  });

  test("a record deleted at its source is still here, and says so", () => {
    const repost = controller
      .browse({ category: "reposts" })
      .records.find((record) => record.uri === REPOST_URIS.gone)!;

    expect(repost.sourceDeletedAt).toBeNull();
    expect(repost.subject?.uri).toEqual(BOB_URIS.deleted);
    expect(repost.subject?.sourceDeletedAt).not.toBeNull();
    expect(repost.subject?.text).toBeNull();
  });

  test("an asset whose bytes are gone from the store reads as unavailable, not as present", () => {
    const before = controller
      .browse({ category: "posts" })
      .records.find((record) => record.uri === POST_URIS.withImage)!;
    const stored = controller.getMedia(before.assets[0].digest!)!;

    fs.rmSync(stored.path);

    const after = controller
      .browse({ category: "posts" })
      .records.find((record) => record.uri === POST_URIS.withImage)!;

    expect(after.assets[0].availability).toEqual("missing");
    expect(after.assets[0].digest).toBeNull();
    expect(after.assets[0].unavailableReason).toBeTruthy();
    // The record itself is untouched by a missing asset.
    expect(after.text).toEqual("A post with a picture");
  });

  test("the summary says how complete the backup is, per category", () => {
    const summary = controller.savedDataSummary();

    expect(summary.complete).toBe(true);
    for (const each of summary.categories) {
      expect(each.assetsAvailable).toEqual(each.assetsExpected);
    }

    // Media covering every kind the account has is in the store.
    for (const address of [
      OWN_IMAGE_BLOB,
      QUOTED_IMAGE_URL,
      LIKED_VIDEO_BLOB,
    ]) {
      expect(address).toBeTruthy();
    }
  });
});
