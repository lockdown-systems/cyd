import fs from "fs";
import os from "os";
import path from "path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";
import unzipper from "unzipper";

const contractRoot = path.resolve("docs/archive/v2");
const fixtureRoot = path.join(contractRoot, "fixtures");
const temporaryDirectories: string[] = [];

async function openFixture(name: "complete" | "incomplete") {
  const archivePath = path.join(fixtureRoot, `${name}.cyd`);
  const directory = await unzipper.Open.file(archivePath);
  const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), `cyd-v2-${name}-`));
  temporaryDirectories.push(outputPath);
  await directory.extract({ path: outputPath });
  const database = new Database(path.join(outputPath, "data.db"), {
    readonly: true,
  });
  return { database, directory, outputPath };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("canonical Cyd archive v2 fixtures", () => {
  test.each(["complete", "incomplete"] as const)(
    "%s fixture represents every portable category and direct context",
    async (fixtureName) => {
      const { database } = await openFixture(fixtureName);

      expect(
        database
          .prepare("SELECT category FROM selections ORDER BY category")
          .pluck()
          .all(),
      ).toEqual(["bookmarks", "chats", "likes", "posts", "reposts"]);
      expect(
        database
          .prepare("SELECT kind FROM record_context ORDER BY kind")
          .pluck()
          .all(),
      ).toEqual(["external", "quote", "reply_parent"]);
      expect(
        database.prepare("SELECT kind FROM assets ORDER BY kind").pluck().all(),
      ).toEqual(["image", "preview", "thumbnail", "video"]);
      expect(
        database.prepare("SELECT COUNT(*) FROM relationships").pluck().get(),
      ).toBeGreaterThan(0);
      expect(
        database.prepare("SELECT COUNT(*) FROM messages").pluck().get(),
      ).toBeGreaterThan(0);
      expect(
        database.prepare("SELECT COUNT(*) FROM record_subjects").pluck().get(),
      ).toBe(3);
      expect(
        database
          .prepare(
            "SELECT COUNT(*) FROM profiles WHERE avatar_asset_id IS NOT NULL",
          )
          .pluck()
          .get(),
      ).toBeGreaterThan(0);
      database.close();
    },
  );

  test.each([
    ["complete", "complete", 0],
    ["incomplete", "incomplete", 1],
  ] as const)(
    "%s fixture describes asset completeness honestly",
    async (fixtureName, expectedState, unavailableCount) => {
      const { database } = await openFixture(fixtureName);
      expect(
        database.prepare("SELECT completeness FROM archive").pluck().get(),
      ).toBe(expectedState);
      expect(
        database
          .prepare(
            "SELECT COUNT(*) FROM assets WHERE availability != 'available'",
          )
          .pluck()
          .get(),
      ).toBe(unavailableCount);
      database.close();
    },
  );

  test.each(["complete", "incomplete"] as const)(
    "%s fixture manifest covers every payload with correct size and digest",
    async (fixtureName) => {
      const { directory } = await openFixture(fixtureName);
      const entries = new Map(
        directory.files.map((entry) => [entry.path, entry]),
      );
      const manifest = JSON.parse(
        (await entries.get("manifest.json")!.buffer()).toString("utf8"),
      ) as {
        payloads: Array<{ path: string; bytes: number; sha256: string }>;
      };
      const crypto = await import("crypto");

      expect(
        manifest.payloads.map(({ path: payloadPath }) => payloadPath),
      ).toEqual(
        [...entries.keys()].filter((entry) => entry !== "manifest.json").sort(),
      );
      for (const payload of manifest.payloads) {
        const bytes = await entries.get(payload.path)!.buffer();
        expect(payload.bytes).toBe(bytes.byteLength);
        expect(crypto.createHash("sha256").update(bytes).digest("hex")).toBe(
          payload.sha256,
        );
      }
    },
  );

  test("semantic expectations make Desktop version support explicit", () => {
    const expectations = JSON.parse(
      fs.readFileSync(
        path.join(fixtureRoot, "semantic-expectations.json"),
        "utf8",
      ),
    ) as {
      desktopVersionBehavior: Record<string, string>;
    };

    expect(expectations.desktopVersionBehavior).toEqual({
      unversionedV1: "reject_unsupported_legacy_format",
      v2Import: "accept",
      v2Export: "write_only_v2",
      newerVersion: "reject_unsupported_newer_version",
    });
  });
});
