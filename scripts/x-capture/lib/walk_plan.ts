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
    {
      // X moved reposts off the profile timeline onto their own route, which
      // is why `UserOriginalsTimeline` contains none.
      label: "Reposts",
      url: `https://x.com/${account}/reposts`,
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

export type DeleteStepKind =
  | "delete-post"
  | "undo-retweet"
  | "unlike"
  | "unbookmark"
  | "unfollow"
  | "replay-delete"
  | "update-bio"
  | "lock-account"
  | "provoke-rate-limit";

export interface DeleteStep {
  kind: DeleteStepKind;
  /** How many times to do it, for the ones done more than once. */
  count: number;
  note: string;
}

/**
 * The destructive walk, least destructive first.
 *
 * Order is the whole point: each step destroys data a later capture might have
 * wanted, so the cheapest and most reversible go first, and the account is only
 * locked at the very end.
 */
export function buildDeleteWalk(
  counts?: Partial<Record<DeleteStepKind, number>>,
): DeleteStep[] {
  const count = (kind: DeleteStepKind, fallback: number) =>
    counts?.[kind] ?? fallback;

  return [
    {
      kind: "delete-post",
      count: count("delete-post", 3),
      note: "Delete a few posts",
    },
    {
      kind: "undo-retweet",
      count: count("undo-retweet", 1),
      note: "Undo a retweet",
    },
    { kind: "unlike", count: count("unlike", 3), note: "Unlike a few posts" },
    {
      kind: "unbookmark",
      count: count("unbookmark", 3),
      note: "Remove a few bookmarks",
    },
    {
      kind: "unfollow",
      count: count("unfollow", 2),
      note: "Unfollow an account or two",
    },
    {
      kind: "replay-delete",
      count: count("replay-delete", 1),
      note: "Repeat a delete that already succeeded, to see what X says about a post that is gone",
    },
    {
      kind: "update-bio",
      count: count("update-bio", 1),
      note: "Change the bio",
    },
    {
      kind: "lock-account",
      count: count("lock-account", 1),
      note: "Lock the account, then unlock it",
    },
    {
      kind: "provoke-rate-limit",
      count: count("provoke-rate-limit", 12),
      note: "Reload a timeline hard, to try to provoke a rate limit",
    },
  ];
}
