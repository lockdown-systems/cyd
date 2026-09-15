/**
 * Tests for the X test-account seed plan.
 */

import { test, expect, describe } from "vitest";

import {
  buildSeedPlan,
  shapeLabelFor,
  missingSeedPosts,
  seedPostNumbers,
  defaultSeedPlanOptions,
  isBulkKind,
  isManualKind,
  minimumForPages,
  summarizePlan,
  type SeedPlanOptions,
} from "./seed_plan";

function options(overrides: Partial<SeedPlanOptions> = {}): SeedPlanOptions {
  return {
    ...defaultSeedPlanOptions("20260914"),
    fillerPosts: 3,
    likes: 2,
    bookmarks: 2,
    follows: 1,
    targetUrls: ["https://x.com/someone/status/1"],
    ...overrides,
  };
}

describe("minimumForPages", () => {
  test("clears the page boundary rather than landing on it", () => {
    expect(minimumForPages(3, 20)).toBe(61);
  });
});

describe("defaultSeedPlanOptions", () => {
  test("seeds enough posts, likes, and bookmarks for three pages", () => {
    const defaults = defaultSeedPlanOptions("20260914");
    expect(defaults.fillerPosts).toBeGreaterThan(60);
    expect(defaults.likes).toBeGreaterThan(60);
    expect(defaults.bookmarks).toBeGreaterThan(60);
  });

  test("follows enough accounts for the following list to page", () => {
    expect(defaultSeedPlanOptions("20260914").follows).toBeGreaterThan(20);
  });
});

describe("reading seeded posts back", () => {
  test("finds the filler posts that exist on a timeline", () => {
    expect(
      seedPostNumbers([
        "Cyd seed post 001 of 20260914. Test account content, safe to delete.",
        "Cyd seed post 019 of 20260914. Test account content, safe to delete.",
        "something else entirely",
      ]),
    ).toEqual([1, 19]);
  });

  test("counts a post once however often it appears", () => {
    const text = "Cyd seed post 007 of 20260914.";
    expect(seedPostNumbers([text, text])).toEqual([7]);
  });

  test("names the posts the plan wanted but the timeline lacks", () => {
    expect(missingSeedPosts([1, 2, 4], 5)).toEqual(["post-003", "post-005"]);
  });

  test("names nothing when every post landed", () => {
    expect(missingSeedPosts([1, 2, 3], 3)).toEqual([]);
  });
});

describe("shapeLabelFor", () => {
  test("recognises each seeded shape by its text", () => {
    expect(shapeLabelFor("Cyd seed poll 20260914. Which one?")).toBe("Poll");
    expect(shapeLabelFor("Cyd seed media 20260914: four images.")).toBe(
      "Four images",
    );
    expect(shapeLabelFor("Cyd seed thread 20260914 1/3. Start of it.")).toBe(
      "Self-thread (first of three)",
    );
  });

  test("tells the single image apart from the four", () => {
    expect(shapeLabelFor("Cyd seed media 20260914: one image.")).toBe(
      "One image",
    );
  });

  test("ignores filler and anything else", () => {
    expect(shapeLabelFor("Cyd seed post 042 of 20260914.")).toBeNull();
    expect(shapeLabelFor("a post by somebody else")).toBeNull();
  });
});

describe("kinds", () => {
  test("names the kinds repeated in bulk", () => {
    expect(isBulkKind("post")).toBe(true);
    expect(isBulkKind("like")).toBe(true);
    expect(isBulkKind("poll")).toBe(false);
  });

  test("names the kinds a person has to do", () => {
    expect(isManualKind("longform")).toBe(true);
    expect(isManualKind("retweet-to-orphan")).toBe(true);
    expect(isManualKind("post")).toBe(false);
  });
});

describe("buildSeedPlan", () => {
  test("includes every content shape that has broken parsing", () => {
    const counts = summarizePlan(buildSeedPlan(options()));
    expect(counts.thread).toBe(1);
    expect(counts.poll).toBe(1);
    expect(counts.longform).toBe(1);
    expect(counts.link).toBe(1);
    expect(counts.quote).toBe(1);
    expect(counts.retweet).toBe(1);
    expect(counts["retweet-to-orphan"]).toBe(1);
    expect(counts.media).toBe(3);
  });

  test("covers one image, several images, and video", () => {
    const media = buildSeedPlan(options()).filter(
      (action) => action.kind === "media",
    );
    expect(media[0].mediaPaths).toHaveLength(1);
    expect(media[1].mediaPaths).toHaveLength(4);
    expect(media[2].mediaPaths?.[0]).toMatch(/\.mp4$/);
  });

  test("puts the awkward shapes before the filler, so they are not all on page one", () => {
    const plan = buildSeedPlan(options());
    const firstFiller = plan.findIndex((action) => action.kind === "post");
    const lastShape = plan.map((action) => action.kind).lastIndexOf("media");
    expect(lastShape).toBeLessThan(firstFiller);
  });

  test("numbers filler posts so pagination can be checked against the capture", () => {
    const plan = buildSeedPlan(options({ fillerPosts: 2 }));
    const filler = plan.filter((action) => action.kind === "post");
    expect(filler.map((action) => action.id)).toEqual(["post-001", "post-002"]);
    expect(filler[0].text).toContain("Cyd seed post 001 of 20260914");
  });

  test("gives every action an id unique enough to resume from", () => {
    const plan = buildSeedPlan(options());
    const ids = plan.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("skips quotes and retweets when no target posts were supplied", () => {
    const counts = summarizePlan(buildSeedPlan(options({ targetUrls: [] })));
    expect(counts.quote).toBeUndefined();
    expect(counts.retweet).toBeUndefined();
  });
});
