/**
 * Unit tests for XAccountController core functionality:
 * - Constructor behavior and database initialization
 * - Account property access
 * - Database lifecycle methods
 */

import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import fs from "fs";
import path from "path";
import { beforeEach, afterEach, test, expect, vi } from "vitest";

import { XAccountController } from "../../x_account_controller";
import { createPlatformPathMocks } from "../../../__tests__/platform-fixtures/tempPaths";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

vi.mock("../../controller/index/saveTweetMedia", () => {
  return {
    saveTweetMedia: vi.fn(async () => ""),
  };
});

// Mock the util module
const pathMocks = createPlatformPathMocks("account_x");

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

import { getAccountDataPath } from "../../../util";
import * as database from "../../../database";

let controllerContext: XControllerTestContext | null = null;
let controller: XAccountController;

beforeEach(() => {
  controllerContext = createXControllerTestContext();
  controller = controllerContext.controller;
});

afterEach(() => {
  controllerContext?.cleanup();
  controllerContext = null;
  pathMocks.cleanup();
});

test("XAccountController.constructor() creates a database for the user", async () => {
  // The controller in beforeEach uses a unique UUID username, so we need to get the actual username
  const username = controller.account?.username || "test";
  // There should be a file called data.sqlite3 in the account data directory
  const files = fs.readdirSync(getAccountDataPath("X", username));
  expect(files).toContain("data.sqlite3");
});

test("test migration: 20241016_add_config", async () => {
  // Clean up the beforeEach context first to avoid database conflicts
  controllerContext?.cleanup();
  controllerContext = null;

  // This test needs a fresh controller with static "test" username
  const migrationContext = createXControllerTestContext("test");
  const testController = migrationContext.controller;

  // Close the X account database
  testController.cleanup();

  // Replace it with test data
  const accountDataPath = getAccountDataPath("X", "test");
  fs.mkdirSync(accountDataPath, { recursive: true });
  fs.copyFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "testdata",
      "x",
      "migrations",
      "initial.sqlite3",
    ),
    path.join(accountDataPath, "data.sqlite3"),
  );

  // Run the migrations
  testController.initDB();

  // The config table should exist
  const rows = database.exec(
    testController.db,
    "SELECT * FROM config",
    [],
    "all",
  ) as Record<string, string>[];
  expect(rows.length).toBe(0);

  // Cleanup
  migrationContext.cleanup();
});

test("test migration: 20241127_add_deletedAt_fields", async () => {
  // Clean up the beforeEach context first to avoid database conflicts
  controllerContext?.cleanup();
  controllerContext = null;

  // This test needs a fresh controller with static "test" username
  const migrationContext = createXControllerTestContext("test");
  const testController = migrationContext.controller;

  // Close the X account database
  testController.cleanup();

  // Replace it with test data
  const accountDataPath = getAccountDataPath("X", "test");
  fs.mkdirSync(accountDataPath, { recursive: true });
  fs.copyFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "testdata",
      "x",
      "migrations",
      "20241127_add_deletedAt_fields.sqlite3",
    ),
    path.join(accountDataPath, "data.sqlite3"),
  );

  // Before the migration, there is only deletedAt fields
  // Run the migrations
  testController.initDB();

  // The tweets should all have deletedTweetAt, deletedRetweetAt, and deletedLikeAt values
  const afterTweetRows = database.exec(
    testController.db,
    "SELECT * FROM tweet WHERE deletedAt IS NOT NULL ORDER BY id",
    [],
    "all",
  ) as Record<string, string>[];
  expect(afterTweetRows.length).toBe(6);

  expect(afterTweetRows[0].deletedTweetAt).toBe(null);
  expect(afterTweetRows[0].deletedRetweetAt).toBeDefined();
  expect(afterTweetRows[0].deletedLikeAt).toBe(null);

  expect(afterTweetRows[1].deletedTweetAt).toBe(null);
  expect(afterTweetRows[1].deletedRetweetAt).toBeDefined();
  expect(afterTweetRows[1].deletedLikeAt).toBeDefined();

  expect(afterTweetRows[2].deletedTweetAt).toBeDefined();
  expect(afterTweetRows[2].deletedRetweetAt).toBe(null);
  expect(afterTweetRows[2].deletedLikeAt).toBe(null);

  expect(afterTweetRows[3].deletedTweetAt).toBeDefined();
  expect(afterTweetRows[3].deletedRetweetAt).toBe(null);
  expect(afterTweetRows[3].deletedLikeAt).toBe(null);

  expect(afterTweetRows[4].deletedTweetAt).toBe(null);
  expect(afterTweetRows[4].deletedRetweetAt).toBe(null);
  expect(afterTweetRows[4].deletedLikeAt).toBeDefined();

  expect(afterTweetRows[5].deletedTweetAt).toBe(null);
  expect(afterTweetRows[5].deletedRetweetAt).toBeDefined();
  expect(afterTweetRows[5].deletedLikeAt).toBeDefined();

  // Cleanup
  migrationContext.cleanup();
});
