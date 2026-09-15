/**
 * Integration tests for the Bluesky storage preflight.
 *
 * Bluesky publishes a post count and nothing else, so most of what a preflight
 * says is an estimate. These tests are about the difference between an estimate
 * and a certainty: a run is refused only when even the certain part does not
 * fit, and an unknown is reported as an unknown rather than as a refusal.
 */

import "../../../__tests__/platform-fixtures/electronMocks";

import fs from "fs";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";

const pathMocks = createPlatformPathMocks("account_bluesky_preflight");

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
import {
  createFakeATClient,
  type FakeATClient,
} from "../fixtures/fakeATClient";
import { fullAccountFixture, posts } from "../fixtures/blueskyTestData";

/** A volume with this much free, whatever the machine running the test has. */
const freeSpace = (bytes: number) =>
  vi.spyOn(fs, "statfsSync").mockReturnValue({
    bavail: bytes,
    bsize: 1,
    blocks: bytes,
    bfree: bytes,
    ffree: 0,
    files: 0,
    type: 0,
  } as unknown as ReturnType<typeof fs.statfsSync>);

describe("BlueskyAccountController - storage preflight", () => {
  let context: BlueskyControllerTestContext;
  let controller: BlueskyAccountController;
  let client: FakeATClient;

  beforeEach(() => {
    context = createBlueskyControllerTestContext();
    controller = context.createLocalAccount("alice.test").controller;
    client = createFakeATClient(fullAccountFixture());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    context.cleanup();
    pathMocks.cleanup();
  });

  test("says what each category needs, and which counts Bluesky does not publish", async () => {
    freeSpace(500 * 1024 * 1024 * 1024);

    const preflight = await controller.storagePreflight(client, [
      ...blueskyPublicCategories,
    ]);

    expect(preflight.categories).toEqual([
      { category: "posts", recordCount: posts.length },
      // Bluesky publishes no count for these, which is what makes the whole
      // estimate uncertain rather than wrong.
      { category: "reposts", recordCount: null },
      { category: "likes", recordCount: null },
      { category: "bookmarks", recordCount: null },
    ]);
    expect(preflight.uncertain).toBe(true);
    expect(preflight.estimatedBytes).toBeGreaterThanOrEqual(
      preflight.certainBytes,
    );
    expect(preflight.availableBytes).toEqual(500 * 1024 * 1024 * 1024);
  });

  test("refuses only when insufficiency is certain", async () => {
    freeSpace(1024);

    const preflight = await controller.storagePreflight(client, ["posts"]);

    expect(preflight.sufficiency).toEqual("insufficient");
    expect(preflight.certainBytes).toBeGreaterThan(preflight.availableBytes);
  });

  test("an uncertain estimate is reported as uncertain, never as a refusal", async () => {
    // Room for everything certain, and for far more than the estimate too.
    freeSpace(500 * 1024 * 1024 * 1024);

    const preflight = await controller.storagePreflight(client, ["likes"]);

    expect(preflight.sufficiency).toEqual("uncertain");
    expect(preflight.certainBytes).toBeLessThan(preflight.availableBytes);
  });

  test("a platform that will not report free space is an unknown, not a refusal", async () => {
    vi.spyOn(fs, "statfsSync").mockImplementation(() => {
      throw new Error("statfs is not supported here");
    });

    const preflight = await controller.storagePreflight(client, ["posts"]);

    expect(preflight.sufficiency).toEqual("uncertain");
    expect(preflight.uncertain).toBe(true);
  });

  test("media an interrupted run left to fetch counts as certain work", async () => {
    freeSpace(500 * 1024 * 1024 * 1024);
    const before = await controller.storagePreflight(client, ["posts"]);

    // Stop the run once it has enumerated media but before it has fetched it.
    client.failAsset(Object.keys(fullAccountFixture().assets ?? {})[0]);
    await controller.collect("posts", {
      client,
      pageLimit: 1,
      wait: async () => {},
    });

    const after = await controller.storagePreflight(client, ["posts"]);
    expect(after.certainBytes).toBeGreaterThan(before.certainBytes);
  });
});
