/**
 * The read walk: which surfaces to visit, in what order, and what to check on
 * each one.
 *
 * Order matters for the walk as a whole — every non-destructive flow is walked
 * to completion before anything is deleted, because deleting destroys the data
 * the read captures need.
 */

export interface WalkStep {
  label: string;
  url: string;
  /** Timelines are scrolled to the very bottom, to exercise pagination. */
  scroll: boolean;
}

export interface Permalink {
  label: string;
  url: string;
}

/**
 * Reads the permalinks written by `list-permalinks.ts`. Entries it could not
 * find are recorded there in prose rather than as a URL, and are skipped.
 */
export function parsePermalinks(markdown: string): Permalink[] {
  const permalinks: Permalink[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^- \[[ x]\] (.+?): (https:\/\/\S+)$/);
    if (match) {
      permalinks.push({ label: match[1], url: match[2] });
    }
  }
  return permalinks;
}

/**
 * The timelines, then the individual posts. Timelines first because they are
 * what pagination and empty-state signals come from, and because a permalink
 * that turns out to be missing should not stop the timelines being captured.
 */
export function buildReadWalk(
  account: string,
  permalinks: Permalink[] = [],
): WalkStep[] {
  const steps: WalkStep[] = [
    {
      label: "Profile timeline",
      url: `https://x.com/${account}`,
      scroll: true,
    },
    {
      label: "Profile timeline with replies",
      url: `https://x.com/${account}/with_replies`,
      scroll: true,
    },
    { label: "Likes", url: `https://x.com/${account}/likes`, scroll: true },
    { label: "Bookmarks", url: "https://x.com/i/bookmarks", scroll: true },
    {
      label: "Following list",
      url: `https://x.com/${account}/following`,
      scroll: true,
    },
    { label: "Home (viewer lookup)", url: "https://x.com/home", scroll: false },
  ];

  for (const permalink of permalinks) {
    steps.push({
      label: `Permalink: ${permalink.label}`,
      url: permalink.url,
      scroll: false,
    });
  }

  return steps;
}

export interface CensusRow {
  route: string;
  selector: string;
  count: number;
}

/**
 * The element inventory, answered by counting. A selector that matches nothing
 * on the surface that depends on it is the silent breakage this whole exercise
 * exists to find.
 */
export function formatCensus(rows: CensusRow[]): string {
  const routes = [...new Set(rows.map((row) => row.route))];
  const lines: string[] = ["# Selector census", ""];

  for (const route of routes) {
    lines.push(`## ${route}`);
    lines.push("");
    lines.push("| Selector | Matches |");
    lines.push("| --- | --- |");
    for (const row of rows.filter((candidate) => candidate.route === route)) {
      lines.push(
        `| \`${row.selector}\` | ${row.count === 0 ? "**none**" : row.count} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
