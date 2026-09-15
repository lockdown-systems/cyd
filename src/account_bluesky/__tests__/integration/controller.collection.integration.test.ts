/**
 * Integration tests for the Bluesky collection engine, driven through the
 * controller against a fake AT Protocol client and real temporary storage.
 *
 * The engine's whole point is that it survives interruption, so these tests
 * interrupt it: they restart it, retry failed media, rate limit it, cancel it,
 * and fill its disk — for every category — and then check the account's actual
 * database and media store.
 */

import "../../../__tests__/platform-fixtures/electronMocks";

import fs from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";

const pathMocks = createPlatformPathMocks("account_bluesky_collection");

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
import {
  blueskyPublicCategories,
  type BlueskyCategory,
  type BlueskyCollectionProgress,
} from "../../../shared_types";
import {
  createBlueskyControllerTestContext,
  type BlueskyControllerTestContext,
} from "../fixtures/accountTestHarness";
import {
  createFakeATClient,
  type FakeATClient,
} from "../fixtures/fakeATClient";
import {
  ALICE_AVATAR_URL,
  ALICE_DID,
  BOB_AVATAR_URL,
  BOB_URIS,
  EXTERNAL_PREVIEW_BLOB,
  LIKED_VIDEO_BLOB,
  LIKE_URI,
  OWN_IMAGE_BLOB,
  POST_URIS,
  REPOST_URIS,
  fullAccountFixture,
} from "../fixtures/blueskyTestData";

/** Waiting is never real in a test; the delay asked for is what matters. */
const recordedWaits = (): {
  waits: number[];
  wait: (ms: number) => Promise<void>;
} => {
  const waits: number[] = [];
  return {
    waits,
    wait: async (milliseconds: number) => {
      waits.push(milliseconds);
    },
  };
};

/** The whole of a category, read back the way a Browse view reads it. */
const allRecords = (
  controller: BlueskyAccountController,
  category: BlueskyCategory,
) => {
  const records = [];
  let before: string | null = null;
  for (;;) {
    const page = controller.browse({ category, before, limit: 2 });
    records.push(...page.records);
    if (!page.nextCursor) {
      return records;
    }
    before = page.nextCursor;
  }
};

/**
 * Every asset a category's records expect, avatars and context included, which
 * is the same set the engine's derived queue works from.
 */
const allAssets = (
  controller: BlueskyAccountController,
  category: BlueskyCategory,
) =>
  allRecords(controller, category).flatMap((record) => {
    const summaries = [
      record,
      ...(record.subject ? [record.subject] : []),
      ...record.context.flatMap((each) => (each.record ? [each.record] : [])),
    ];
    return summaries.flatMap((summary) => [
      ...summary.assets,
      ...(summary.author?.avatar ? [summary.author.avatar] : []),
    ]);
  });

/**
 * Everything an account holds for a category, in a form two accounts can be
 * compared by. Observation times differ between runs, so they are left out:
 * what must match is the records, their subjects, and their media.
 */
const savedState = (
  controller: BlueskyAccountController,
  category: BlueskyCategory,
) =>
  allRecords(controller, category).map((record) => ({
    uri: record.uri,
    text: record.text,
    author: record.author?.handle ?? null,
    sourceDeletedAt: record.sourceDeletedAt,
    subject: record.subject?.uri ?? null,
    subjectDeleted: record.subject?.sourceDeletedAt !== null,
    context: record.context.map((each) => [
      each.kind,
      each.record?.uri ?? null,
    ]),
    assets: record.assets.map((asset) => [asset.availability, asset.digest]),
    subjectAssets: (record.subject?.assets ?? []).map((asset) => [
      asset.availability,
      asset.digest,
    ]),
  }));

const collectEverything = async (
  controller: BlueskyAccountController,
  client: FakeATClient,
  category: BlueskyCategory,
  overrides: Parameters<BlueskyAccountController["collect"]>[1] extends infer O
    ? Partial<O>
    : never = {},
) =>
  controller.collect(category, {
    client,
    pageLimit: 1,
    wait: async () => {},
    ...overrides,
  });

describe("BlueskyAccountController - collecting public records", () => {
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

  test("a category is off until it is chosen, and choosing it never touches saved data", async () => {
    expect(controller.getCategorySettings()).toEqual({
      posts: false,
      reposts: false,
      likes: false,
      bookmarks: false,
    });

    controller.setCategoryEnabled("posts", true);
    expect(controller.getCategorySettings().posts).toBe(true);

    await collectEverything(controller, client, "posts");
    const before = savedState(controller, "posts");

    controller.setCategoryEnabled("posts", false);

    expect(controller.getCategorySettings().posts).toBe(false);
    expect(savedState(controller, "posts")).toEqual(before);
  });

  test("saved posts keep their AT URIs, captured authors, bounded context, and media", async () => {
    const result = await collectEverything(controller, client, "posts");

    expect(result.outcome).toEqual("finished");

    const records = allRecords(controller, "posts");
    expect(records.map((record) => record.uri)).toEqual([
      POST_URIS.withExternal,
      POST_URIS.withContext,
      POST_URIS.withImage,
    ]);

    const withImage = records.find(
      (record) => record.uri === POST_URIS.withImage,
    )!;
    expect(withImage.cid).toEqual("bafypostimage");
    expect(withImage.author?.handle).toEqual("alice.test");
    expect(withImage.sourceURL).toEqual(
      `https://bsky.app/profile/${ALICE_DID}/post/withimage`,
    );
    expect(withImage.assets).toHaveLength(1);
    expect(withImage.assets[0].availability).toEqual("available");
    expect(withImage.assets[0].altText).toEqual("my picture");

    // Every stored asset is in the account's own content-addressed store.
    const stored = controller.getMedia(withImage.assets[0].digest!);
    expect(stored).not.toBeNull();
    expect(fs.existsSync(stored!.path)).toBe(true);
    expect(stored!.path.startsWith(controller.getPaths().mediaPath)).toBe(true);

    const withContext = records.find(
      (record) => record.uri === POST_URIS.withContext,
    )!;
    expect(
      withContext.context.map((each) => [each.kind, each.record?.uri]),
    ).toEqual([
      ["quote", BOB_URIS.quoted],
      ["reply_parent", BOB_URIS.parent],
    ]);
    expect(withContext.context[0].record?.author?.handle).toEqual("bob.test");

    const withExternal = records.find(
      (record) => record.uri === POST_URIS.withExternal,
    )!;
    expect(withExternal.context).toEqual([
      {
        kind: "external",
        record: null,
        external: {
          uri: "https://example.com/article",
          title: "An article",
          description: "Worth keeping",
        },
      },
    ]);

    expect(controller.savedDataSummary().complete).toBe(true);
  });

  test("a repost of a deleted post keeps the relationship and says the source is gone", async () => {
    await collectEverything(controller, client, "reposts");

    const records = allRecords(controller, "reposts");
    const gone = records.find((record) => record.uri === REPOST_URIS.gone)!;

    expect(gone.subject?.uri).toEqual(BOB_URIS.deleted);
    expect(gone.subject?.sourceDeletedAt).not.toBeNull();

    const live = records.find((record) => record.uri === REPOST_URIS.live)!;
    expect(live.subject?.text).toEqual("Bob's post that Alice reposted");
    expect(live.subject?.sourceDeletedAt).toBeNull();
  });

  test("a bookmark selects the bookmarked post, as Cyd Mobile writes it", async () => {
    await collectEverything(controller, client, "bookmarks");

    const records = allRecords(controller, "bookmarks");

    // Bluesky gives a bookmark no AT URI of its own, so the selection names the
    // post. Minting an identifier here would make a Cyd Bluesky archive mean
    // one thing on desktop and another on mobile.
    expect(records.map((record) => record.uri)).toEqual([BOB_URIS.bookmarked]);
    expect(records[0].recordType).toEqual("app.bsky.feed.post");
    expect(records[0].text).toEqual("Bob's post that Alice bookmarked");
    expect(records[0].subject).toBeNull();
    expect(records[0].sourceURL).toEqual(
      `https://bsky.app/profile/${"did:plc:examplebob"}/post/bookmarked`,
    );

    // Nothing invented an `app.cyd.*` record for it.
    for (const record of records) {
      expect(record.recordType.startsWith("app.cyd.")).toBe(false);
    }
  });

  test("a liked video is saved whole, not just the thumbnail a client would show", async () => {
    await collectEverything(controller, client, "likes");

    const like = allRecords(controller, "likes").find(
      (record) => record.uri === LIKE_URI,
    )!;
    const kinds = (like.subject?.assets ?? []).map((asset) => [
      asset.kind,
      asset.availability,
    ]);

    expect(kinds).toEqual(
      expect.arrayContaining([
        ["video", "available"],
        ["thumbnail", "available"],
      ]),
    );
    expect(client.calls.fetched).toContain(LIKED_VIDEO_BLOB);
  });

  test("refreshing a profile does not rewrite the author a record was captured with", async () => {
    await collectEverything(controller, client, "posts");

    const captured = allRecords(controller, "posts")[0].author!;
    expect(captured.handle).toEqual("alice.test");

    // The identity keeps its DID and changes its handle, as a rename does, and
    // the account is collected again afterwards.
    client.setProfile({
      handle: "alice.example.com",
      displayName: "Alice Again",
    });
    await collectEverything(controller, client, "posts");

    // Every saved record still shows the author it was captured with.
    for (const record of allRecords(controller, "posts")) {
      expect(record.author?.handle).toEqual("alice.test");
      expect(record.author?.profileID).toEqual(captured.profileID);
    }
  });

  test("a record Cyd could not read at first takes its real author once it can", async () => {
    // The repost of a deleted post is saved with a bare DID for an author.
    await collectEverything(controller, client, "reposts");

    const beforeAuthor = allRecords(controller, "reposts").find(
      (record) => record.uri === REPOST_URIS.gone,
    )!.subject?.author;
    expect(beforeAuthor?.handle).toBeNull();
    expect(beforeAuthor?.did).toEqual("did:plc:examplebob");

    // Bluesky starts answering for it, so the placeholder is filled in rather
    // than kept forever.
    const readable = createFakeATClient({
      ...fullAccountFixture(),
      postViews: [
        ...(fullAccountFixture().postViews ?? []),
        {
          uri: BOB_URIS.deleted,
          cid: "bafydeleted",
          author: {
            did: "did:plc:examplebob",
            handle: "bob.test",
            displayName: "Bob",
          },
          record: {
            $type: "app.bsky.feed.post",
            text: "Back again",
            createdAt: "2026-01-02T09:00:00.000Z",
          },
        },
      ],
    });
    await collectEverything(controller, readable, "reposts");

    const subject = allRecords(controller, "reposts").find(
      (record) => record.uri === REPOST_URIS.gone,
    )!.subject;
    expect(subject?.author?.handle).toEqual("bob.test");
    expect(subject?.text).toEqual("Back again");
    // Reading it again means it is there, so it is no longer marked as gone.
    expect(subject?.sourceDeletedAt).toBeNull();
  });

  test("a save interrupted mid-run is offered back, and carries on", async () => {
    const [job] = controller.createJobs(["savePosts"]);
    job.status = "running";
    job.startedAt = new Date();
    controller.updateJob(job);

    // Cyd stops while the job is running, then the account is opened again.
    const accountID = controller.accountID;
    controller.cleanup();
    const reopened = context.reopenLocalAccount(accountID);

    const pending = reopened.resumeInterruptedJobs();
    expect(pending.map((each) => each.jobType)).toEqual(["savePosts"]);
    expect(pending[0].startedAt).toBeNull();

    // Nothing is left claiming to be running, so nothing is stranded.
    expect(
      reopened.getJobs().filter((each) => each.status === "running"),
    ).toEqual([]);

    const result = await collectEverything(reopened, client, "posts");
    expect(result.outcome).toEqual("finished");
  });

  test("progress carries operational metadata only", async () => {
    const reported: BlueskyCollectionProgress[] = [];
    await collectEverything(controller, client, "posts", {
      onProgress: (progress) => reported.push(progress),
    });

    expect(reported.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(reported);

    // Nothing that identifies a person, quotes their data, or points at their
    // disk. See docs/adr/0029-minimize-bluesky-diagnostics.md.
    for (const forbidden of [
      ALICE_DID,
      "alice.test",
      "A post with a picture",
      ALICE_AVATAR_URL,
      controller.getPaths().accountPath,
      "at://",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(Object.keys(reported[0]).sort()).toEqual([
      "cancelled",
      "category",
      "mediaFailed",
      "mediaPending",
      "mediaSaved",
      "pagesListed",
      "rateLimitOccurrences",
      "rateLimitedUntil",
      "recordsSaved",
      "stage",
    ]);
  });
});

describe.each(blueskyPublicCategories)(
  "BlueskyAccountController - durability of collecting %s",
  (category) => {
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

    /** What running the category straight through, in one go, produces. */
    const referenceState = async () => {
      const reference = context.createLocalAccount("alice.test").controller;
      await collectEverything(
        reference,
        createFakeATClient(fullAccountFixture()),
        category,
      );
      return savedState(reference, category);
    };

    test("resuming after a restart reaches the same data, without duplicate work", async () => {
      const expected = await referenceState();

      // Stop at the first checkpoint, as quitting Cyd mid-run would.
      const interrupted = await collectEverything(
        controller,
        client,
        category,
        {
          onProgress: () => controller.cancelCollection(),
        },
      );
      expect(interrupted.outcome).toEqual("cancelled");

      const fetchedBeforeRestart = [...client.calls.fetched];

      // Reopening the account is what a restarted Cyd does.
      const accountID = controller.accountID;
      controller.cleanup();
      const reopened = context.reopenLocalAccount(accountID);

      const resumed = await collectEverything(reopened, client, category);
      expect(resumed.outcome).toEqual("finished");
      expect(savedState(reopened, category)).toEqual(expected);

      // Nothing already in the media store was fetched a second time.
      const refetched = client.calls.fetched
        .slice(fetchedBeforeRestart.length)
        .filter((address) => fetchedBeforeRestart.includes(address));
      expect(refetched).toEqual([]);
    });

    test("a failed asset stays explicit and retryable, and a retry upgrades completeness", async () => {
      const expected = await referenceState();

      // Bob authors the record every category reaches — the reply parent and
      // quote for posts, the subject for reposts, likes, and bookmarks — so his
      // avatar is an asset all four are expected to have.
      client.failAsset(BOB_AVATAR_URL, 500);

      const failed = await collectEverything(controller, client, category);
      expect(failed.outcome).toEqual("finished");
      expect(failed.progress.mediaFailed).toBeGreaterThan(0);
      expect(controller.savedDataSummary().complete).toBe(false);

      // The failure is on the asset, named without a URL, and still pending.
      const stillMissing = allAssets(controller, category).filter(
        (asset) => asset.availability !== "available",
      );
      expect(stillMissing.length).toBeGreaterThan(0);
      for (const asset of stillMissing) {
        expect(asset.unavailableReason).toBeTruthy();
        expect(asset.unavailableReason).not.toContain("http");
      }

      client.allowAsset(BOB_AVATAR_URL);
      const retried = await collectEverything(controller, client, category);

      expect(retried.progress.mediaFailed).toEqual(0);
      expect(controller.savedDataSummary().complete).toBe(true);
      expect(savedState(controller, category)).toEqual(expected);
    });

    test("an asset Bluesky says is gone is recorded as unavailable, not as missing", async () => {
      client.failAsset(BOB_AVATAR_URL, 410);

      await collectEverything(controller, client, category);

      const unavailable = allAssets(controller, category).filter(
        (asset) => asset.availability === "unavailable",
      );
      expect(unavailable.length).toBeGreaterThan(0);
    });

    test("a rate limit shows a backoff with a time on it, then resumes", async () => {
      const { waits, wait } = recordedWaits();
      const reported: BlueskyCollectionProgress[] = [];

      client.rateLimitListing(2, 5_000);
      const result = await collectEverything(controller, client, category, {
        wait,
        onProgress: (progress) => reported.push(progress),
      });

      expect(result.outcome).toEqual("finished");
      expect(result.progress.rateLimitOccurrences).toEqual(2);
      expect(waits.length).toEqual(2);
      for (const waited of waits) {
        expect(waited).toBeGreaterThan(0);
      }

      // A waiting job says when it will resume rather than going quiet.
      const waiting = reported.filter((progress) => progress.rateLimitedUntil);
      expect(waiting.length).toEqual(2);
      expect(new Date(waiting[0].rateLimitedUntil!).getTime()).toBeGreaterThan(
        Date.now(),
      );
      expect(result.progress.rateLimitedUntil).toBeNull();
    });

    test("cancelling keeps everything committed and leaves only staging behind", async () => {
      const result = await collectEverything(controller, client, category, {
        onProgress: () => controller.cancelCollection(),
      });

      expect(result.outcome).toEqual("cancelled");
      expect(result.progress.cancelled).toBe(true);

      const committed = savedState(controller, category);
      const storedDigests = committed
        .flatMap((record) => [...record.assets, ...record.subjectAssets])
        .map(([, digest]) => digest)
        .filter((digest): digest is string => Boolean(digest));

      // Clearing staging reclaims the scratch space and touches nothing saved.
      controller.clearStagingAreas();

      expect(fs.readdirSync(controller.getPaths().stagingPath)).toEqual([]);
      expect(savedState(controller, category)).toEqual(committed);
      for (const digest of storedDigests) {
        expect(fs.existsSync(controller.getMedia(digest)!.path)).toBe(true);
      }
    });

    test("running out of disk keeps committed data and says why it stopped", async () => {
      // A full volume shows up where media is committed into the store.
      const renameSync = vi
        .spyOn(fs, "renameSync")
        .mockImplementation((...args: Parameters<typeof fs.renameSync>) => {
          const error: NodeJS.ErrnoException = new Error(
            "no space left on device",
          );
          error.code = "ENOSPC";
          void args;
          throw error;
        });

      const result = await collectEverything(controller, client, category);

      expect(result.outcome).toEqual("outOfSpace");
      expect(result.errorClass).toEqual("ENOSPC");

      // The records committed before the disk filled are still saved.
      const records = allRecords(controller, category);
      expect(records.length).toBeGreaterThan(0);
      expect(controller.savedDataSummary().complete).toBe(false);

      renameSync.mockRestore();

      // With room again, the same run finishes what it started.
      controller.clearStagingAreas();
      const recovered = await collectEverything(controller, client, category);
      expect(recovered.outcome).toEqual("finished");
      expect(controller.savedDataSummary().complete).toBe(true);
    });
  },
);

describe("BlueskyAccountController - the engine is category-agnostic", () => {
  let context: BlueskyControllerTestContext;

  beforeEach(() => {
    context = createBlueskyControllerTestContext();
  });

  afterEach(() => {
    context.cleanup();
    pathMocks.cleanup();
  });

  test("every category collects, and each one is saved on its own", async () => {
    const controller = context.createLocalAccount("alice.test").controller;
    const client = createFakeATClient(fullAccountFixture());

    for (const category of blueskyPublicCategories) {
      const result = await collectEverything(controller, client, category);
      expect(result.outcome).toEqual("finished");
    }

    const summary = controller.savedDataSummary();
    expect(
      summary.categories.map((each) => [each.category, each.recordCount]),
    ).toEqual([
      ["posts", 3],
      ["reposts", 2],
      ["likes", 1],
      ["bookmarks", 1],
    ]);
    expect(summary.complete).toBe(true);

    // Identical bytes are stored once, and only inside this account.
    const mediaRoot = path.join(controller.getPaths().mediaPath, "sha256");
    const storedFiles = fs
      .readdirSync(mediaRoot)
      .flatMap((prefix) => fs.readdirSync(path.join(mediaRoot, prefix)));
    expect(new Set(storedFiles).size).toEqual(storedFiles.length);
  });

  test("two local accounts collecting the same identity keep separate stores", async () => {
    const first = context.createLocalAccount("alice.test").controller;
    const second = context.createLocalAccount("alice.test").controller;

    await collectEverything(
      first,
      createFakeATClient(fullAccountFixture()),
      "posts",
    );

    expect(allRecords(first, "posts").length).toEqual(3);
    expect(allRecords(second, "posts").length).toEqual(0);
    expect(
      fs.existsSync(path.join(second.getPaths().mediaPath, "sha256")),
    ).toBe(false);
  });
});

describe("BlueskyAccountController - media and assets", () => {
  let context: BlueskyControllerTestContext;

  beforeEach(() => {
    context = createBlueskyControllerTestContext();
  });

  afterEach(() => {
    context.cleanup();
    pathMocks.cleanup();
  });

  test("all required images, previews, thumbnails, and full videos are stored", async () => {
    const controller = context.createLocalAccount("alice.test").controller;
    const client = createFakeATClient(fullAccountFixture());

    for (const category of blueskyPublicCategories) {
      await collectEverything(controller, client, category);
    }

    expect(client.calls.fetched).toEqual(
      expect.arrayContaining([
        ALICE_AVATAR_URL,
        OWN_IMAGE_BLOB,
        EXTERNAL_PREVIEW_BLOB,
        LIKED_VIDEO_BLOB,
      ]),
    );

    const summary = controller.savedDataSummary();
    for (const each of summary.categories) {
      expect(each.assetsAvailable).toEqual(each.assetsExpected);
    }
  });
});
