/**
 * Tests for the capture HAR decoder.
 */

import { test, expect, describe } from "vitest";

import {
  collectEmptyStateMarkers,
  countTimelineEntries,
  decodeHar,
  fixtureFilename,
  isXApiUrl,
  parseXOperation,
  type Har,
  type HarEntry,
} from "./har";

function harEntry(overrides: Partial<HarEntry> = {}): HarEntry {
  return {
    startedDateTime: "2026-09-14T10:00:00.000Z",
    request: {
      method: "GET",
      url: "https://x.com/i/api/graphql/QUERYID/UserTweets?variables=%7B%7D",
      headers: [{ name: "Referer", value: "https://x.com/testaccount" }],
    },
    response: {
      status: 200,
      headers: [],
      content: { mimeType: "application/json", text: '{"data":{}}' },
    },
    ...overrides,
  };
}

function har(entries: HarEntry[]): Har {
  return { log: { entries } };
}

describe("isXApiUrl", () => {
  test("accepts X API calls", () => {
    expect(isXApiUrl("https://x.com/i/api/graphql/ID/Bookmarks")).toBe(true);
    expect(isXApiUrl("https://api.x.com/graphql/ID/Viewer")).toBe(true);
    expect(isXApiUrl("https://x.com/i/api/1.1/jot/client_event.json")).toBe(
      true,
    );
  });

  test("rejects page loads, media, and other hosts", () => {
    expect(isXApiUrl("https://x.com/home")).toBe(false);
    expect(isXApiUrl("https://pbs.twimg.com/media/abc.jpg")).toBe(false);
    expect(isXApiUrl("not a url")).toBe(false);
  });
});

describe("parseXOperation", () => {
  test("reads the operation name and rotating identifier from a GraphQL path", () => {
    const operation = parseXOperation(
      "https://x.com/i/api/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets?variables=%7B%7D",
    );
    expect(operation).toMatchObject({
      kind: "graphql",
      operationName: "UserTweets",
      queryId: "E3opETHurmVJflFsUBVuUQ",
      route: "/i/api/graphql/E3opETHurmVJflFsUBVuUQ/UserTweets",
      host: "x.com",
    });
  });

  test("names REST calls after their path", () => {
    const operation = parseXOperation(
      "https://x.com/i/api/1.1/favorites/create.json",
    );
    expect(operation).toMatchObject({
      kind: "rest",
      operationName: "favorites_create",
      queryId: null,
    });
  });
});

describe("countTimelineEntries", () => {
  test("counts entries by their entryId prefix", () => {
    const body = {
      data: {
        instructions: [
          {
            entries: [
              { entryId: "tweet-1" },
              { entryId: "tweet-2" },
              { entryId: "cursor-bottom-3" },
            ],
          },
        ],
      },
    };
    expect(countTimelineEntries(body)).toEqual({ tweet: 2, cursor: 1 });
  });

  test("returns nothing for a response with no entries", () => {
    expect(countTimelineEntries({ data: {} })).toEqual({});
  });
});

describe("collectEmptyStateMarkers", () => {
  test("finds the explicit empty-state signal", () => {
    const body = {
      entries: [
        { entryId: "cursor-top-0" },
        {
          entryId: "noResults-1",
          content: { itemType: "TimelineTimelineItem", cursorType: "Bottom" },
        },
      ],
    };
    expect(collectEmptyStateMarkers(body)).toEqual(["entryId=noResults-1"]);
  });

  test("finds a signal carried by the key rather than the value", () => {
    const body = { data: { timeline: { noResultsMessage: { text: {} } } } };
    expect(collectEmptyStateMarkers(body)).toEqual(["noResultsMessage"]);
  });

  test("finds nothing in a populated timeline", () => {
    expect(
      collectEmptyStateMarkers({ entries: [{ entryId: "tweet-1" }] }),
    ).toEqual([]);
  });
});

describe("fixtureFilename", () => {
  test("follows the existing dated convention", () => {
    expect(fixtureFilename("UserTweetsAndReplies", "20250404")).toBe(
      "XUserTweetsAndReplies_20250404.json",
    );
  });

  test("numbers multiple pages of the same operation", () => {
    expect(fixtureFilename("Bookmarks", "20260914", 1, 3)).toBe(
      "XBookmarks_20260914_2.json",
    );
  });

  test("does not double the X prefix", () => {
    expect(fixtureFilename("XBookmarks", "20260914")).toBe(
      "XBookmarks_20260914.json",
    );
  });
});

describe("decodeHar", () => {
  test("keeps only X API calls", () => {
    const report = decodeHar(
      har([
        harEntry(),
        harEntry({
          request: { method: "GET", url: "https://x.com/home" },
        }),
      ]),
    );
    expect(report.totalEntries).toBe(2);
    expect(report.capturedEntries).toBe(1);
    expect(report.calls[0].operationName).toBe("UserTweets");
  });

  test("records the referrer a delete mutation was sent with", () => {
    const report = decodeHar(
      har([
        harEntry({
          request: {
            method: "POST",
            url: "https://x.com/i/api/graphql/DELETEID/DeleteTweet",
            headers: [{ name: "referer", value: "https://x.com/testaccount" }],
            postData: { text: '{"variables":{"tweet_id":"1"}}' },
          },
        }),
      ]),
    );
    expect(report.calls[0].referrer).toBe("https://x.com/testaccount");
    expect(report.calls[0].requestBody).toEqual({
      variables: { tweet_id: "1" },
    });
  });

  test("flags a rate limit reported inside a successful response", () => {
    const report = decodeHar(
      har([
        harEntry({
          response: {
            status: 200,
            headers: [{ name: "x-rate-limit-remaining", value: "0" }],
            content: {
              text: '{"errors":[{"code":88,"message":"Rate limit exceeded."}]}',
            },
          },
        }),
      ]),
    );
    expect(report.calls[0].successWithErrors).toBe(true);
    expect(report.calls[0].errorMessages).toEqual(["88: Rate limit exceeded."]);
    expect(report.calls[0].rateLimit).toEqual({ remaining: "0" });
    expect(report.rateLimitCandidates).toEqual([0]);
  });

  test("groups repeated calls into one operation summary", () => {
    const report = decodeHar(
      har([
        harEntry(),
        harEntry({
          request: {
            method: "GET",
            url: "https://x.com/i/api/graphql/OTHERID/UserTweets?cursor=1",
            headers: [],
          },
        }),
        harEntry({
          request: {
            method: "GET",
            url: "https://x.com/i/api/graphql/BOOKMARKID/Bookmarks",
            headers: [],
          },
        }),
      ]),
    );
    expect(report.operations.map((o) => o.operationName)).toEqual([
      "Bookmarks",
      "UserTweets",
    ]);
    const userTweets = report.operations[1];
    expect(userTweets.count).toBe(2);
    expect(userTweets.queryIds).toEqual(["QUERYID", "OTHERID"]);
  });

  test("dates the capture from the earliest call", () => {
    const report = decodeHar(
      har([
        harEntry({ startedDateTime: "2026-09-14T23:30:00.000Z" }),
        harEntry({ startedDateTime: "2026-09-14T09:00:00.000Z" }),
      ]),
    );
    expect(report.capturedAt).toBe("2026-09-14T09:00:00.000Z");
    expect(report.dateStamp).toBe("20260914");
  });

  test("keeps a non-JSON response body as text", () => {
    const report = decodeHar(
      har([
        harEntry({
          response: {
            status: 429,
            headers: [],
            content: { text: "Rate limit exceeded" },
          },
        }),
      ]),
    );
    expect(report.calls[0].responseBody).toBeNull();
    expect(report.calls[0].responseText).toBe("Rate limit exceeded");
  });
});
