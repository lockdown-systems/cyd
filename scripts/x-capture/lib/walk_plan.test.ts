/**
 * Tests for the read walk plan.
 */

import { test, expect, describe } from "vitest";

import { buildReadWalk, formatCensus, parsePermalinks } from "./walk_plan";

describe("parsePermalinks", () => {
  test("reads the permalinks the lister wrote", () => {
    const markdown = [
      "# Seeded shape permalinks",
      "",
      "- [ ] Poll: https://x.com/someone/status/1",
      "- [ ] Video: https://x.com/someone/status/2",
    ].join("\n");
    expect(parsePermalinks(markdown)).toEqual([
      { label: "Poll", url: "https://x.com/someone/status/1" },
      { label: "Video", url: "https://x.com/someone/status/2" },
    ]);
  });

  test("skips shapes that were never found", () => {
    const markdown = [
      "- [ ] Poll: https://x.com/someone/status/1",
      "- [ ] Long-form: **not found on the timeline**",
    ].join("\n");
    expect(parsePermalinks(markdown)).toHaveLength(1);
  });
});

describe("buildReadWalk", () => {
  test("visits the profile timeline before anything else", () => {
    expect(buildReadWalk("someone")[0]).toEqual({
      label: "Profile timeline",
      url: "https://x.com/someone",
      scroll: true,
    });
  });

  test("covers both profile routes, since they return different things", () => {
    const urls = buildReadWalk("someone").map((step) => step.url);
    expect(urls).toContain("https://x.com/someone");
    expect(urls).toContain("https://x.com/someone/with_replies");
  });

  test("scrolls every timeline and no permalink", () => {
    const steps = buildReadWalk("someone", [
      { label: "Poll", url: "https://x.com/someone/status/1" },
    ]);
    expect(steps.filter((step) => step.scroll).length).toBe(5);
    expect(steps[steps.length - 1]).toMatchObject({
      label: "Permalink: Poll",
      scroll: false,
    });
  });

  test("works with no permalinks at all", () => {
    expect(buildReadWalk("someone")).toHaveLength(6);
  });
});

describe("formatCensus", () => {
  test("calls out a selector that matches nothing", () => {
    const markdown = formatCensus([
      { route: "/someone", selector: "article", count: 20 },
      {
        route: "/someone",
        selector: 'div[data-testid="emptyState"]',
        count: 0,
      },
    ]);
    expect(markdown).toContain("| `article` | 20 |");
    expect(markdown).toContain("**none**");
  });

  test("groups by route", () => {
    const markdown = formatCensus([
      { route: "/a", selector: "x", count: 1 },
      { route: "/b", selector: "x", count: 1 },
    ]);
    expect(markdown).toContain("## /a");
    expect(markdown).toContain("## /b");
  });
});
