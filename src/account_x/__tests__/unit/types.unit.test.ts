/**
 * Unit tests for X API type guards and utility functions
 */

import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

import {
  isXAPIBookmarksData,
  isXAPIError,
  isXAPIData,
  isXAPIData_v2,
} from "../../types";

test("types.isXAPIBookmarksData() should recognize bookmarks data", async () => {
  const body = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "testdata",
      "x",
      "XBookmarks.json",
    ),
    "utf8",
  );
  const data = JSON.parse(body);
  expect(isXAPIBookmarksData(data)).toBe(true);
  expect(isXAPIError(data)).toBe(false);
  expect(isXAPIData(data)).toBe(false);
});

test("types.isXAPIError() should recognize errors", async () => {
  const body = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "testdata",
      "x",
      "XUserTweetsAndRepliesError.json",
    ),
    "utf8",
  );
  const data = JSON.parse(body);
  expect(isXAPIError(data)).toBe(true);
  expect(isXAPIBookmarksData(data)).toBe(false);
  expect(isXAPIData(data)).toBe(false);
});

test("types.isXAPIData() should recognize data", async () => {
  const body = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "testdata",
      "x",
      "XUserTweetsAndReplies1.json",
    ),
    "utf8",
  );
  const data = JSON.parse(body);
  expect(isXAPIData_v2(data)).toBe(false);
  expect(isXAPIData(data)).toBe(true);
  expect(isXAPIBookmarksData(data)).toBe(false);
  expect(isXAPIError(data)).toBe(false);
});
