/**
 * Integration tests for the Bluesky local account lifecycle, using a real
 * temporary main database and real temporary per-account storage:
 * - creating, reopening, and permanently deleting a local account
 * - UUID-keyed storage that survives handle changes
 * - isolation of databases, media, jobs, and staging between local accounts
 * - owner-only permissions on everything Cyd creates
 */

import "../../../__tests__/platform-fixtures/electronMocks";

import fs from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";

const pathMocks = createPlatformPathMocks("account_bluesky");

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

import { getAccount, getAccounts, deleteAccount } from "../../../database";
import {
  createBlueskyControllerTestContext,
  type BlueskyControllerTestContext,
} from "../fixtures/accountTestHarness";

const isWindows = process.platform === "win32";

const permissionsOf = (target: string): number =>
  fs.statSync(target).mode & 0o777;

describe("BlueskyAccountController - local account lifecycle", () => {
  let context: BlueskyControllerTestContext;

  beforeEach(() => {
    context = createBlueskyControllerTestContext();
  });

  afterEach(() => {
    context.cleanup();
    pathMocks.cleanup();
  });

  test("a new local account has a Cyd UUID, no Bluesky identity, and its own private storage", () => {
    const { account, controller } = context.createLocalAccount();

    expect(account.uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(controller.account?.did).toBeNull();
    expect(controller.account?.uuid).toEqual(account.uuid);

    const paths = controller.getPaths();
    expect(paths.accountPath).toContain(account.uuid);
    expect(fs.existsSync(paths.databasePath)).toBe(true);
    expect(fs.existsSync(paths.mediaPath)).toBe(true);
    expect(fs.existsSync(paths.stagingPath)).toBe(true);
    expect(fs.existsSync(paths.connectionPath)).toBe(true);
  });

  test("storage is keyed by UUID, so a handle change moves nothing", () => {
    const { account, controller } =
      context.createLocalAccount("alice.bsky.social");
    const pathsBefore = controller.getPaths();
    const media = controller.saveMedia(Buffer.from("an image"), "image/jpeg");

    controller.updateProfile({ handle: "alice.example.com" });

    expect(controller.account?.handle).toEqual("alice.example.com");
    expect(controller.getPaths()).toEqual(pathsBefore);
    expect(pathsBefore.accountPath).not.toContain("alice");
    expect(pathsBefore.accountPath).toContain(account.uuid);
    expect(controller.getMedia(media.digest)?.path).toEqual(media.path);
  });

  test("a Bluesky identity belongs to exactly one local account", () => {
    const first = context.createLocalAccount("alice.bsky.social");
    const second = context.createLocalAccount("bob.bsky.social");

    first.controller.setDID("did:plc:examplealice");
    expect(first.controller.account?.did).toEqual("did:plc:examplealice");

    expect(() => second.controller.setDID("did:plc:examplealice")).toThrow(
      /already belongs to another/,
    );

    // Reconnecting the same identity to the same local account is fine.
    expect(() => first.controller.setDID("did:plc:examplealice")).not.toThrow();
  });

  test("reopening a local account keeps its saved media, jobs, and settings", () => {
    const { account, controller } = context.createLocalAccount();
    const media = controller.saveMedia(Buffer.from("full video"), "video/mp4");
    const [job] = controller.createJobs(["savePosts"]);
    controller.setConfig("lastSaveCursor", "cursor-1");
    controller.cleanup();

    const reopened = context.reopenLocalAccount(account.id);

    expect(reopened.getMedia(media.digest)).toEqual(
      expect.objectContaining({
        digest: media.digest,
        mediaType: "video/mp4",
        byteLength: media.byteLength,
      }),
    );
    expect(reopened.getJobs().map((each) => each.jobType)).toEqual([
      "savePosts",
    ]);
    expect(reopened.getJobs()[0].id).toEqual(job.id);
    expect(reopened.getConfig("lastSaveCursor")).toEqual("cursor-1");
  });

  test("job state survives a restart mid-job", () => {
    const { account, controller } = context.createLocalAccount();
    const [job] = controller.createJobs(["savePosts"]);

    controller.updateJob({
      ...job,
      status: "running",
      startedAt: new Date("2026-01-15T12:00:00.000Z"),
      progressJSON: JSON.stringify({ postsSaved: 12 }),
    });
    controller.cleanup();

    const [resumed] = context.reopenLocalAccount(account.id).getJobs();
    expect(resumed.status).toEqual("running");
    expect(resumed.startedAt).toEqual(new Date("2026-01-15T12:00:00.000Z"));
    expect(resumed.finishedAt).toBeNull();
    expect(JSON.parse(resumed.progressJSON)).toEqual({ postsSaved: 12 });
  });

  test("media is content-addressed and deduplicated within one account", () => {
    const { controller } = context.createLocalAccount();
    const bytes = Buffer.from("a video that two records share");

    const first = controller.saveMedia(bytes, "video/mp4");
    const second = controller.saveMedia(bytes, "video/mp4");

    expect(second.digest).toEqual(first.digest);
    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(first.path).toContain(first.digest);
    expect(fs.readFileSync(first.path)).toEqual(bytes);

    const storedFiles = fs
      .readdirSync(path.join(controller.getPaths().mediaPath, "sha256"), {
        recursive: true,
        withFileTypes: true,
      })
      .filter((entry) => entry.isFile());
    expect(storedFiles).toHaveLength(1);
  });

  test("two local accounts keep separate databases, media, jobs, and staging", () => {
    const alice = context.createLocalAccount("alice.bsky.social");
    const bob = context.createLocalAccount("bob.bsky.social");
    const sharedBytes = Buffer.from("the same picture, saved by both");

    expect(alice.controller.getPaths().accountPath).not.toEqual(
      bob.controller.getPaths().accountPath,
    );

    const aliceMedia = alice.controller.saveMedia(sharedBytes, "image/jpeg");
    const bobMedia = bob.controller.saveMedia(sharedBytes, "image/jpeg");
    alice.controller.createJobs(["savePosts"]);
    alice.controller.createStagingArea("import-1");

    // Identical bytes are not shared across accounts: each account owns a copy.
    expect(bobMedia.digest).toEqual(aliceMedia.digest);
    expect(bobMedia.deduplicated).toBe(false);
    expect(bobMedia.path).not.toEqual(aliceMedia.path);
    expect(bob.controller.getJobs()).toEqual([]);
    expect(fs.readdirSync(bob.controller.getPaths().stagingPath)).toEqual([]);
  });

  test("staged work can be discarded without touching saved data", () => {
    const { controller } = context.createLocalAccount();
    const media = controller.saveMedia(Buffer.from("kept"), "image/png");

    const staging = controller.createStagingArea("import-1");
    fs.writeFileSync(path.join(staging, "partial.zip"), "in progress");
    expect(fs.existsSync(staging)).toBe(true);

    controller.clearStagingAreas();

    expect(fs.existsSync(staging)).toBe(false);
    expect(fs.existsSync(controller.getPaths().stagingPath)).toBe(true);
    expect(controller.getMedia(media.digest)).not.toBeNull();
  });

  test.skipIf(isWindows)("local resources are owner-only on disk", () => {
    const { controller } = context.createLocalAccount();
    const paths = controller.getPaths();
    const media = controller.saveMedia(Buffer.from("private"), "image/png");
    const staging = controller.createStagingArea("import-1");

    expect(permissionsOf(paths.accountPath)).toEqual(0o700);
    expect(permissionsOf(paths.mediaPath)).toEqual(0o700);
    expect(permissionsOf(paths.stagingPath)).toEqual(0o700);
    expect(permissionsOf(paths.connectionPath)).toEqual(0o700);
    expect(permissionsOf(staging)).toEqual(0o700);
    expect(permissionsOf(paths.databasePath)).toEqual(0o600);
    expect(permissionsOf(media.path)).toEqual(0o600);
  });

  test("deleting a local account requires confirming its UUID", () => {
    const { account, controller } = context.createLocalAccount();
    const media = controller.saveMedia(Buffer.from("still here"), "image/png");

    expect(() =>
      controller.deleteLocalAccount({
        confirmedAccountUUID: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
      }),
    ).toThrow(/requires confirming/);

    expect(fs.existsSync(controller.getPaths().accountPath)).toBe(true);
    expect(controller.getMedia(media.digest)).not.toBeNull();
    expect(getAccount(account.id)).not.toBeNull();
  });

  test("a confirmed deletion removes only that account's local resources", () => {
    const alice = context.createLocalAccount("alice.bsky.social");
    const bob = context.createLocalAccount("bob.bsky.social");

    const alicePaths = alice.controller.getPaths();
    const bobPaths = bob.controller.getPaths();
    const bobMedia = bob.controller.saveMedia(
      Buffer.from("bob's picture"),
      "image/jpeg",
    );
    alice.controller.saveMedia(Buffer.from("alice's picture"), "image/jpeg");
    alice.controller.createStagingArea("import-1");
    fs.writeFileSync(
      path.join(alicePaths.connectionPath, "session.json"),
      "connection material",
    );

    alice.controller.deleteLocalAccount({
      confirmedAccountUUID: alice.account.uuid,
    });

    // Alice's connection material, database, media, jobs, and staging are gone.
    expect(fs.existsSync(alicePaths.accountPath)).toBe(false);
    expect(getAccount(alice.account.id)).toBeNull();
    expect(getAccounts().map((each) => each.id)).toEqual([bob.account.id]);

    // Bob is untouched.
    expect(fs.existsSync(bobPaths.accountPath)).toBe(true);
    expect(bob.controller.getMedia(bobMedia.digest)).not.toBeNull();
  });

  test("Cyd's account list cannot delete a Bluesky account without confirming it", () => {
    const { account, controller } = context.createLocalAccount();
    const paths = controller.getPaths();

    expect(() => deleteAccount(account.id)).toThrow(/requires confirming/);

    expect(fs.existsSync(paths.accountPath)).toBe(true);
    expect(getAccount(account.id)).not.toBeNull();
  });

  test("removing the account through Cyd's account list also removes its local resources", () => {
    const { account, controller } = context.createLocalAccount();
    const paths = controller.getPaths();
    controller.saveMedia(Buffer.from("saved data"), "image/png");
    controller.cleanup();

    deleteAccount(account.id, account.uuid);

    expect(fs.existsSync(paths.accountPath)).toBe(false);
    expect(getAccount(account.id)).toBeNull();
  });
});
