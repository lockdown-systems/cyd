import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import fs from "fs";
import path from "path";
import archiver from "archiver";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";

import { exec } from "../../../database";
import * as Util from "../../../util";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";
import { seedTweet } from "../fixtures/tweetFactory";

async function createTestArchiveZip(targetDir: string): Promise<void> {
  await fs.promises.mkdir(targetDir, { recursive: true });
  const zipPath = path.join(targetDir, "x-archive.zip");

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const zip = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", (err) => reject(err));
    zip.on("error", (err) => reject(err));

    zip.pipe(output);
    zip.append("<html><body>Archive</body></html>", { name: "index.html" });
    zip.finalize().catch((err) => reject(err));
  });
}

describe("XAccountController - Archive integration", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
  });

  test("archiveTweetsStart returns sorted non-retweets and ensures output folder", async () => {
    const controller = controllerContext!.controller;
    const username = controller.account!.username;

    seedTweet(controller, {
      tweetID: "older",
      createdAt: new Date("2023-01-01T00:00:00.000Z").toISOString(),
      path: `${username}/status/older`,
    });
    seedTweet(controller, {
      tweetID: "newer",
      createdAt: new Date("2023-02-01T00:00:00.000Z").toISOString(),
      path: `${username}/status/newer`,
    });
    seedTweet(controller, {
      tweetID: "retweet",
      text: "RT @friend",
      path: `${username}/status/retweet`,
    });

    const result = await controller.archiveTweetsStart();

    expect(result.items.map((item) => item.tweetID)).toEqual([
      "older",
      "newer",
    ]);
    expect(result.items[0].basename).toContain("older");
    expect(result.items[1].basename).toContain("newer");
    expect(result.items[0].url).toBe(`https://x.com/${username}/status/older`);
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });

  test("archiveTweet and archiveTweetCheckDate persist archived timestamps", async () => {
    const controller = controllerContext!.controller;
    const missingID = seedTweet(controller, {
      tweetID: "needs-archive",
      archivedAt: null,
    });
    const existingTimestamp = new Date(
      "2024-05-01T00:00:00.000Z",
    ).toISOString();
    const existingID = seedTweet(controller, {
      tweetID: "has-archive",
      archivedAt: existingTimestamp,
    });

    await controller.archiveTweet(missingID);
    await controller.archiveTweetCheckDate(existingID);

    const rows = exec(
      controller.db!,
      "SELECT tweetID, archivedAt FROM tweet WHERE tweetID IN (?, ?)",
      [missingID, existingID],
      "all",
    ) as { tweetID: string; archivedAt: string | null }[];
    const map = Object.fromEntries(
      rows.map((row) => [row.tweetID, row.archivedAt]),
    );

    expect(map[missingID]).not.toBeNull();
    expect(map[existingID]).toBe(existingTimestamp);
  });

  test("archiveBuild streams archive.js and extracts static assets", async () => {
    const controller = controllerContext!.controller;
    const username = controller.account!.username;
    const accountDataPath = Util.getAccountDataPath("X", username);
    const assetsPath = path.join(accountDataPath, "assets");
    fs.rmSync(assetsPath, { recursive: true, force: true });
    fs.rmSync(path.join(accountDataPath, "index.html"), { force: true });

    seedTweet(controller, { tweetID: "archive-tweet" });
    seedTweet(controller, { tweetID: "retweet", text: "RT @friend" });
    seedTweet(controller, { tweetID: "like", isLiked: 1 });
    seedTweet(controller, { tweetID: "bookmark", isBookmarked: 1 });

    const resourcesPath = path.join(accountDataPath, "resources-fixture");
    await createTestArchiveZip(resourcesPath);
    const getResourcesPathSpy = vi
      .spyOn(Util, "getResourcesPath")
      .mockReturnValue(resourcesPath);

    await controller.archiveBuild();

    const archivePath = path.join(assetsPath, "archive.js");
    expect(fs.existsSync(archivePath)).toBe(true);
    const archiveContents = fs.readFileSync(archivePath, "utf-8");
    expect(archiveContents.startsWith("window.archiveData=")).toBe(true);
    expect(archiveContents).toContain("archive-tweet");
    expect(archiveContents).toContain("retweet");
    expect(archiveContents).toContain("bookmark");

    const extractedIndex = path.join(accountDataPath, "index.html");
    expect(fs.existsSync(extractedIndex)).toBe(true);

    getResourcesPathSpy.mockRestore();
  });
});
