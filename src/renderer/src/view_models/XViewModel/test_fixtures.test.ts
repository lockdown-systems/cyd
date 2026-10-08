/**
 * Checks that the fixtures promoted from the capture of 2026-09-14 load, and
 * that they still show what the capture found. These assertions are the
 * findings in `docs/x-capture/findings-20260914.md` written down as code, so
 * that the work in #710 and #711 is built against ground truth rather than
 * against an assumed response shape.
 */

import { describe, it, expect } from "vitest";

import { XAPIFixtures } from "./test_fixtures";

interface TimelineEntry {
  entryId: string;
  content?: Record<string, never>;
  item?: Record<string, never>;
}

/** The top-level entries across every instruction in a timeline response. */
function timelineEntries(body: unknown): TimelineEntry[] {
  const search = (node: unknown): TimelineEntry[] | null => {
    if (node === null || typeof node !== "object") {
      return null;
    }
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.instructions)) {
      return record.instructions.flatMap((instruction) => {
        const entries = (instruction as Record<string, unknown>).entries;
        return Array.isArray(entries) ? (entries as TimelineEntry[]) : [];
      });
    }
    for (const value of Object.values(record)) {
      const found = search(value);
      if (found !== null) {
        return found;
      }
    }
    return null;
  };

  return search(body) ?? [];
}

/**
 * The posts in a timeline response, whether they are top-level entries or
 * items inside a `TimelineTimelineModule`. The replies timeline needs the
 * second case: its posts are only ever inside modules.
 */
function posts(body: unknown): TimelineEntry[] {
  return timelineEntries(body)
    .flatMap((entry) => {
      const items = entry.content?.["items"] as TimelineEntry[] | undefined;
      return Array.isArray(items) ? items : [entry];
    })
    .filter((entry) => /(^|-)tweet-\d+$/.test(entry.entryId));
}

function countByKind(body: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of timelineEntries(body)) {
    const kind = entry.entryId.split("-")[0];
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

/** The author of the first post in a timeline response. */
function firstPostAuthor(body: unknown): Record<string, unknown> {
  const post = posts(body)[0];
  expect(post).toBeDefined();
  // A module's items carry their content under `item`, top-level entries
  // under `content`.
  const holder = post.item ?? post.content;
  const result = holder!["itemContent"]["tweet_results"]["result"];
  return result["core"]["user_results"]["result"];
}

describe("timeline fixtures from the capture of 2026-09-14", () => {
  it("pages the profile timeline three times and then returns cursors only", () => {
    expect(
      countByKind(XAPIFixtures.userOriginalsTimeline_20260914_1()),
    ).toMatchObject({ tweet: 20 });
    expect(
      countByKind(XAPIFixtures.userOriginalsTimeline_20260914_2()),
    ).toMatchObject({ tweet: 20 });
    expect(
      countByKind(XAPIFixtures.userOriginalsTimeline_20260914_3()),
    ).toMatchObject({ tweet: 13 });

    // The end of a timeline is a page with cursors and no posts. That is the
    // "no more" signal, and it is not an error.
    const end = countByKind(XAPIFixtures.userOriginalsTimeline_20260914_4());
    expect(end.tweet).toBeUndefined();
    expect(end.cursor).toBe(2);
  });

  it("pages likes and bookmarks the same way", () => {
    expect(countByKind(XAPIFixtures.likes_20260914_1())).toMatchObject({
      tweet: 20,
    });
    expect(countByKind(XAPIFixtures.likes_20260914_3())).toMatchObject({
      tweet: 16,
    });
    expect(countByKind(XAPIFixtures.likes_20260914_4()).tweet).toBeUndefined();

    expect(countByKind(XAPIFixtures.bookmarks_20260914_1())).toMatchObject({
      tweet: 20,
    });
    expect(countByKind(XAPIFixtures.bookmarks_20260914_3())).toMatchObject({
      tweet: 18,
    });
    expect(
      countByKind(XAPIFixtures.bookmarks_20260914_4()).tweet,
    ).toBeUndefined();
  });

  it("carries reposts as ordinary top-level entries", () => {
    expect(
      countByKind(XAPIFixtures.userRepostsTimeline_20260914()),
    ).toMatchObject({ tweet: 2 });
  });

  it("nests replies inside profile-conversation modules", () => {
    // /with_replies returns no top-level `tweet-` entries at all. Each reply
    // arrives as a TimelineTimelineModule holding the parent post and the
    // reply, so a parser that only walks top-level entries finds nothing.
    const body = XAPIFixtures.userRepliesTimeline_20260914();
    expect(countByKind(body).tweet).toBeUndefined();
    expect(countByKind(body).profile).toBe(2);
    expect(posts(body)).toHaveLength(4);
  });

  it("puts the author's fields in core, with no legacy at all", () => {
    for (const body of [
      XAPIFixtures.userOriginalsTimeline_20260914_1(),
      XAPIFixtures.userRepliesTimeline_20260914(),
      XAPIFixtures.userRepostsTimeline_20260914(),
      XAPIFixtures.likes_20260914_1(),
      XAPIFixtures.bookmarks_20260914_1(),
    ]) {
      const author = firstPostAuthor(body);
      expect(author).not.toHaveProperty("legacy");
      expect(author.core).toMatchObject({
        screen_name: expect.any(String),
        name: expect.any(String),
        created_at: expect.any(String),
      });
    }
  });
});

describe("empty-account fixtures", () => {
  it("returns no posts, and no empty-state marker anywhere", () => {
    const bodies = [
      XAPIFixtures.userOriginalsTimelineEmpty_20260914(),
      XAPIFixtures.userRepliesTimelineEmpty_20260914(),
      XAPIFixtures.userRepostsTimelineEmpty_20260914(),
      XAPIFixtures.likesEmpty_20260914(),
      XAPIFixtures.bookmarksEmpty_20260914(),
    ];
    for (const body of bodies) {
      expect(countByKind(body).tweet).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain("noResults");
    }
  });

  it("still returns a who-to-follow module on the empty profile timeline", () => {
    // So "the response has no entries" is not the emptiness test either.
    const counts = countByKind(
      XAPIFixtures.userOriginalsTimelineEmpty_20260914(),
    );
    expect(counts.tweet).toBeUndefined();
    expect(counts.who).toBe(1);
  });
});

describe("mutation fixtures", () => {
  it("answers each delete in its own shape", () => {
    expect(XAPIFixtures.deleteTweet_20260914()).toEqual({
      data: { delete_tweet: { tweet_results: {} } },
    });
    expect(XAPIFixtures.unfavoriteTweet_20260914()).toEqual({
      data: { unfavorite_tweet: "Done" },
    });
    expect(XAPIFixtures.deleteBookmark_20260914()).toEqual({
      data: { tweet_bookmark_delete: "Done" },
    });
  });

  it("names the original post when a repost is undone", () => {
    // DeleteRetweet is its own operation, and it answers with the original
    // post's id rather than the repost's — so the saved data has to carry it.
    const body = XAPIFixtures.deleteRetweet_20260914() as Record<string, never>;
    expect(
      body["data"]["unretweet"]["source_tweet_results"]["result"]["rest_id"],
    ).toEqual(expect.any(String));
  });
});

describe("the Viewer fixture", () => {
  it("still returns legacy, so it does not share a parser with the timelines", () => {
    const body = XAPIFixtures.viewer_20260914() as Record<string, never>;
    const user = body["data"]["viewer"]["user_results"]["result"];
    expect(user).not.toHaveProperty("core");
    expect(user["legacy"]).toMatchObject({
      screen_name: expect.any(String),
      description: expect.any(String),
      friends_count: expect.any(Number),
      statuses_count: expect.any(Number),
      favourites_count: expect.any(Number),
      profile_image_url_https: expect.any(String),
    });
  });
});
