import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import fs from "fs";
import path from "path";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import unzipper from "unzipper";

import { exec } from "../../../database";
import * as Util from "../../../util";
import { archiveTweetsStart } from "../../controller/archive/archiveTweetsStart";
import { archiveTweetsOutputPath } from "../../controller/archive/archiveTweetsOutputPath";
import { archiveTweet } from "../../controller/archive/archiveTweet";
import { archiveTweetCheckDate } from "../../controller/archive/archiveTweetCheckDate";
import { archiveBuild } from "../../controller/archive/archiveBuild";
import * as ArchiveModule from "../../archive";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";
import { seedTweet } from "../fixtures/tweetFactory";

describe("XAccountController - Archive", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
    vi.restoreAllMocks();
  });

  test("archiveTweetsStart returns non-retweet items and output path", async () => {
    const controller = controllerContext!.controller;
    const username = controller.account!.username;

    seedTweet(controller, {
      tweetID: "old",
      createdAt: Util.getTimestampDaysAgo(90),
      path: `${username}/status/old`,
    });
    seedTweet(controller, {
      tweetID: "new",
      createdAt: Util.getTimestampDaysAgo(10),
      path: `${username}/status/new`,
    });
    seedTweet(controller, {
      tweetID: "retweet",
      text: "RT @someone",
      path: `${username}/status/retweet`,
    });

    const result = await archiveTweetsStart(controller);

    expect(result.items.map((item) => item.tweetID)).toEqual(["old", "new"]);
    expect(result.items[0].url).toBe(`https://x.com/${username}/status/old`);
    expect(fs.existsSync(result.outputPath)).toBe(true);
  });

  test("archiveTweetsOutputPath creates directory when missing", async () => {
    const controller = controllerContext!.controller;
    const accountDataPath = Util.getAccountDataPath(
      "X",
      controller.account!.username,
    );
    const archiveDir = path.join(accountDataPath, "Archived Tweets");
    fs.rmSync(archiveDir, { recursive: true, force: true });

    const outputPath = await archiveTweetsOutputPath(controller);

    expect(outputPath).toBe(archiveDir);
    expect(fs.existsSync(archiveDir)).toBe(true);
  });

  test("archiveTweet sets archivedAt timestamp", async () => {
    const controller = controllerContext!.controller;
    const tweetID = seedTweet(controller, { archivedAt: null });

    await archiveTweet(controller, tweetID);

    const row = exec(
      controller.db!,
      "SELECT archivedAt FROM tweet WHERE tweetID = ?",
      [tweetID],
      "get",
    ) as { archivedAt: string | null };

    expect(row.archivedAt).not.toBeNull();
  });

  test("archiveTweetCheckDate sets timestamp only when missing", async () => {
    const controller = controllerContext!.controller;
    const missingTweet = seedTweet(controller, {
      tweetID: "needs-date",
      archivedAt: null,
    });
    const existingTimestamp = new Date(
      "2023-01-01T00:00:00.000Z",
    ).toISOString();
    const existingTweet = seedTweet(controller, {
      tweetID: "has-date",
      archivedAt: existingTimestamp,
    });

    await archiveTweetCheckDate(controller, missingTweet);
    await archiveTweetCheckDate(controller, existingTweet);

    const rows = exec(
      controller.db!,
      "SELECT tweetID, archivedAt FROM tweet WHERE tweetID IN (?, ?)",
      [missingTweet, existingTweet],
      "all",
    ) as { tweetID: string; archivedAt: string | null }[];
    const byID = Object.fromEntries(
      rows.map((row) => [row.tweetID, row.archivedAt]),
    );

    expect(byID[missingTweet]).not.toBeNull();
    expect(byID[existingTweet]).toBe(existingTimestamp);
  });

  test("archiveBuild saves archive and extracts static assets", async () => {
    const controller = controllerContext!.controller;
    const username = controller.account!.username;
    const accountDataPath = Util.getAccountDataPath("X", username);
    const assetsPath = path.join(accountDataPath, "assets");
    fs.rmSync(assetsPath, { recursive: true, force: true });

    const extractMock = vi.fn().mockResolvedValue(undefined);
    const openSpy = vi.spyOn(unzipper.Open, "file").mockResolvedValue({
      extract: extractMock,
    } as unknown as unzipper.CentralDirectory);

    const saveArchiveSpy = vi
      .spyOn(ArchiveModule, "saveArchive")
      .mockImplementation(() => undefined);

    const resourcesPath = path.join(accountDataPath, "resources");
    const getResourcesPathSpy = vi
      .spyOn(Util, "getResourcesPath")
      .mockReturnValue(resourcesPath);

    await archiveBuild(controller);

    expect(saveArchiveSpy).toHaveBeenCalledTimes(1);
    const [, appVersion, calledUsername, archivePath] =
      saveArchiveSpy.mock.calls[0];
    expect(appVersion).toBe("test-version");
    expect(calledUsername).toBe(username);
    expect(archivePath).toBe(path.join(assetsPath, "archive.js"));

    expect(openSpy).toHaveBeenCalledWith(
      path.join(resourcesPath, "x-archive.zip"),
    );
    expect(extractMock).toHaveBeenCalledWith({ path: accountDataPath });
    expect(fs.existsSync(assetsPath)).toBe(true);

    getResourcesPathSpy.mockRestore();
  });
});
