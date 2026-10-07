import { describe, it, expect } from "vitest";
import {
  X_DELETE_OPERATION_SEEDS,
  resolveXDeleteOperation,
} from "./operations";

describe("resolveXDeleteOperation", () => {
  it("falls back to the seeded identifier when the session has observed none", () => {
    const operation = resolveXDeleteOperation("DeleteTweet", "testuser", {});

    expect(operation.queryID).toBe(
      X_DELETE_OPERATION_SEEDS.DeleteTweet.queryID,
    );
    expect(operation.url).toBe(
      `https://x.com/i/api/graphql/${X_DELETE_OPERATION_SEEDS.DeleteTweet.queryID}/DeleteTweet`,
    );
  });

  it("prefers an identifier observed in this session's traffic", () => {
    const operation = resolveXDeleteOperation("DeleteTweet", "testuser", {
      DeleteTweet: "rotated-identifier",
    });

    expect(operation.queryID).toBe("rotated-identifier");
    expect(operation.url).toBe(
      "https://x.com/i/api/graphql/rotated-identifier/DeleteTweet",
    );
  });

  it("only takes the identifier observed for its own operation", () => {
    const operation = resolveXDeleteOperation("DeleteBookmark", "testuser", {
      DeleteTweet: "rotated-identifier",
    });

    expect(operation.queryID).toBe(
      X_DELETE_OPERATION_SEEDS.DeleteBookmark.queryID,
    );
  });

  it("sends the referrers X's own client sends", () => {
    expect(
      resolveXDeleteOperation("DeleteTweet", "testuser", {}).referrer,
    ).toBe("https://x.com/testuser");
    expect(
      resolveXDeleteOperation("DeleteRetweet", "testuser", {}).referrer,
    ).toBe("https://x.com/testuser/reposts");
    expect(
      resolveXDeleteOperation("UnfavoriteTweet", "testuser", {}).referrer,
    ).toBe("https://x.com/i/history/likes");
    expect(
      resolveXDeleteOperation("DeleteBookmark", "testuser", {}).referrer,
    ).toBe("https://x.com/i/history");
  });
});
