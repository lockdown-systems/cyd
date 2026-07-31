import fs from "fs";
import os from "os";
import path from "path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";
import unzipper from "unzipper";

const contractRoot = path.resolve("docs/archive/bluesky/v2");
const fixtureRoot = path.join(contractRoot, "fixtures");
const temporaryDirectories: string[] = [];

type JsonObject = Record<string, unknown>;

type SemanticExpectations = {
  archiveFormat: JsonObject;
  desktopBlueskyVersionBehavior: Record<string, string>;
  commonSemantics: JsonObject;
  fixtures: Record<
    "complete.cyd" | "incomplete.cyd",
    { completeness: string; assets: JsonObject[] }
  >;
};

function readExpectations(): SemanticExpectations {
  return JSON.parse(
    fs.readFileSync(
      path.join(fixtureRoot, "semantic-expectations.json"),
      "utf8",
    ),
  ) as SemanticExpectations;
}

function rows(database: Database.Database, sql: string): JsonObject[] {
  return database.prepare(sql).all() as JsonObject[];
}

function parseJsonFields(values: JsonObject[], fields: string[]): JsonObject[] {
  return values.map((value) => ({
    ...value,
    ...Object.fromEntries(
      fields.map((field) => [
        field,
        value[field] === null ? null : JSON.parse(value[field] as string),
      ]),
    ),
  }));
}

function normalizeSemantics(database: Database.Database): JsonObject {
  const archive = database
    .prepare(
      `SELECT created_at AS createdAt, account_did AS accountDid,
        account_uuid AS accountUuid FROM archive`,
    )
    .get() as JsonObject;
  const identity = database
    .prepare("SELECT did, current_profile_id AS currentProfileId FROM identity")
    .get() as JsonObject;

  return {
    archive,
    identity,
    profiles: rows(
      database,
      `SELECT id, did, handle, display_name AS displayName,
        description, avatar_asset_id AS avatarAssetId,
        banner_asset_id AS bannerAssetId, captured_at AS capturedAt
      FROM profiles ORDER BY id`,
    ),
    records: parseJsonFields(
      rows(
        database,
        `SELECT uri, cid, record_type AS recordType,
          author_profile_id AS authorProfileId, indexed_at AS indexedAt,
          created_at AS createdAt, first_observed_at AS firstObservedAt,
          observed_at AS observedAt, source_deleted_at AS sourceDeletedAt,
          text, facets_json AS facets, payload_json AS payload
        FROM records ORDER BY uri`,
      ),
      ["facets", "payload"],
    ),
    selections: rows(
      database,
      `SELECT category, subject_id AS subjectId, selected_at AS selectedAt
      FROM selections ORDER BY category`,
    ),
    recordSubjects: rows(
      database,
      `SELECT relationship_uri AS relationshipUri,
        subject_record_uri AS subjectRecordUri
      FROM record_subjects ORDER BY relationship_uri`,
    ),
    recordContext: parseJsonFields(
      rows(
        database,
        `SELECT record_uri AS recordUri, kind,
          context_record_uri AS contextRecordUri,
          context_profile_id AS contextProfileId, external_json AS external
        FROM record_context ORDER BY record_uri, kind`,
      ),
      ["external"],
    ),
    conversations: rows(
      database,
      `SELECT id, rev, first_observed_at AS firstObservedAt,
        observed_at AS observedAt, source_deleted_at AS sourceDeletedAt
      FROM conversations ORDER BY id`,
    ),
    conversationMembers: rows(
      database,
      `SELECT conversation_id AS conversationId, profile_id AS profileId
      FROM conversation_members ORDER BY conversation_id, profile_id`,
    ),
    messages: parseJsonFields(
      rows(
        database,
        `SELECT id, conversation_id AS conversationId,
          sender_profile_id AS senderProfileId, sent_at AS sentAt,
          observed_at AS observedAt, source_deleted_at AS sourceDeletedAt,
          text, facets_json AS facets, payload_json AS payload
        FROM messages ORDER BY id`,
      ),
      ["facets", "payload"],
    ),
    relationships: rows(
      database,
      `SELECT uri, kind, actor_did AS actorDid, subject_did AS subjectDid,
        created_at AS createdAt, observed_at AS observedAt,
        source_deleted_at AS sourceDeletedAt
      FROM relationships ORDER BY uri`,
    ),
    recordAssets: rows(
      database,
      `SELECT owner_type AS ownerType, owner_id AS ownerId,
        asset_id AS assetId, role, position
      FROM record_assets ORDER BY owner_type, owner_id, role, position`,
    ),
    portableSettings: parseJsonFields(
      rows(
        database,
        `SELECT key, value_json AS value
        FROM portable_settings ORDER BY key`,
      ),
      ["value"],
    ),
  };
}

function normalizeAssets(database: Database.Database): JsonObject[] {
  return rows(
    database,
    `SELECT id, kind, media_type AS mediaType, byte_count AS byteCount,
      sha256, archive_path AS archivePath, availability,
      unavailable_reason AS unavailableReason, source_url AS sourceUrl,
      width, height, alt_text AS altText
    FROM assets ORDER BY id`,
  );
}

function crc32(bytes: Buffer): number {
  let checksum = 0xffffffff;
  for (const byte of bytes) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1));
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function expectValidPng(bytes: Buffer): void {
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const chunkTypes: string[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataEnd = typeStart + 4 + length;
    const chunkEnd = dataEnd + 4;
    expect(chunkEnd).toBeLessThanOrEqual(bytes.length);
    const typeAndData = bytes.subarray(typeStart, dataEnd);
    chunkTypes.push(typeAndData.subarray(0, 4).toString("ascii"));
    expect(bytes.readUInt32BE(dataEnd)).toBe(crc32(typeAndData));
    offset = chunkEnd;
  }
  expect(offset).toBe(bytes.length);
  expect(chunkTypes[0]).toBe("IHDR");
  expect(chunkTypes).toContain("IDAT");
  expect(chunkTypes.at(-1)).toBe("IEND");
}

function expectPlayableMp4Structure(bytes: Buffer): void {
  const boxes = new Map<string, Buffer>();
  let offset = 0;
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    expect(size).toBeGreaterThanOrEqual(8);
    expect(offset + size).toBeLessThanOrEqual(bytes.length);
    boxes.set(type, bytes.subarray(offset, offset + size));
    offset += size;
  }
  expect(offset).toBe(bytes.length);
  expect([...boxes.keys()]).toEqual(
    expect.arrayContaining(["ftyp", "mdat", "moov"]),
  );
  const movie = boxes.get("moov")!;
  expect(movie.includes(Buffer.from("mvhd"))).toBe(true);
  expect(movie.includes(Buffer.from("trak"))).toBe(true);
  expect(movie.includes(Buffer.from("stbl"))).toBe(true);
}

async function openFixture(name: "complete" | "incomplete") {
  const archivePath = path.join(fixtureRoot, `${name}.cyd`);
  const directory = await unzipper.Open.file(archivePath);
  const outputPath = fs.mkdtempSync(
    path.join(os.tmpdir(), `cyd-bluesky-v2-${name}-`),
  );
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

describe("canonical Cyd Bluesky archive v2 fixtures", () => {
  test.each(["complete", "incomplete"] as const)(
    "%s fixture matches every normalized semantic expectation",
    async (fixtureName) => {
      const { database } = await openFixture(fixtureName);
      const expectations = readExpectations();
      const fixtureExpectations = expectations.fixtures[`${fixtureName}.cyd`];

      expect(normalizeSemantics(database)).toEqual(
        expectations.commonSemantics,
      );
      expect(normalizeAssets(database)).toEqual(fixtureExpectations.assets);
      expect(
        database.prepare("SELECT completeness FROM archive").pluck().get(),
      ).toBe(fixtureExpectations.completeness);
      database.close();
    },
  );

  test("complete fixture contains valid PNGs and a structured playable MP4", async () => {
    const { database, directory } = await openFixture("complete");
    const entries = new Map(
      directory.files.map((entry) => [entry.path, entry]),
    );
    const assets = rows(
      database,
      "SELECT kind, archive_path AS archivePath FROM assets ORDER BY kind",
    );

    for (const asset of assets) {
      const bytes = await entries.get(asset.archivePath as string)!.buffer();
      if (asset.kind === "video") {
        expectPlayableMp4Structure(bytes);
      } else {
        expectValidPng(bytes);
      }
    }
    database.close();
  });

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

  test("metadata and database scope version 2 to Bluesky", async () => {
    const { database, directory } = await openFixture("complete");
    const metadataEntry = directory.files.find(
      (entry) => entry.path === "metadata.json",
    );
    const metadata = JSON.parse(
      (await metadataEntry!.buffer()).toString("utf8"),
    ) as Record<string, unknown>;

    expect(metadata).toEqual({
      format: "cyd-archive",
      platform: "bluesky",
      version: 2,
      createdAt: "2026-01-15T12:00:00.000Z",
      accountDid: "did:plc:canonicalalice",
      accountUuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
      completeness: "complete",
    });
    expect(
      database
        .prepare(
          `SELECT format, platform, version, created_at AS createdAt,
            account_did AS accountDid, account_uuid AS accountUuid,
            completeness FROM archive`,
        )
        .get(),
    ).toEqual(metadata);
    expect(database.pragma("application_id", { simple: true })).toBe(
      0x43594232,
    );
    database.close();
  });

  test("semantic expectations make Desktop Bluesky version support explicit", () => {
    const expectations = readExpectations();

    expect(expectations.archiveFormat).toEqual({
      format: "cyd-archive",
      platform: "bluesky",
      version: 2,
    });
    expect(expectations.desktopBlueskyVersionBehavior).toEqual({
      unversionedV1: "reject_unsupported_legacy_format",
      blueskyV2Import: "accept",
      blueskyV2Export: "write_only_bluesky_v2",
      otherPlatform: "reject_unsupported_archive_platform",
      newerVersion: "reject_unsupported_newer_version",
    });
  });
});
