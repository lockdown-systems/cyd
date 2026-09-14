/**
 * Builds the ordered list of seeding actions for an X test account.
 *
 * The plan has to force at least three pages on posts, likes, and bookmarks,
 * and it has to include the content shapes that have historically broken
 * parsing, so the shapes are part of the plan rather than left to whoever is
 * driving the browser to remember.
 *
 * This is capture tooling, not application code.
 */

export type SeedActionKind =
  | "post"
  | "thread"
  | "poll"
  | "media"
  | "longform"
  | "link"
  | "quote"
  | "retweet"
  | "retweet-to-orphan"
  | "like"
  | "bookmark"
  | "follow";

/** The kinds repeated in bulk to force pagination, rather than one-offs. */
export const BULK_KINDS: SeedActionKind[] = [
  "post",
  "like",
  "bookmark",
  "follow",
];

/**
 * Kinds no script can do on its own: the long-form composer needs premium, and
 * an orphaned retweet needs a second account to delete the original from.
 */
export const MANUAL_KINDS: SeedActionKind[] = ["longform", "retweet-to-orphan"];

export function isBulkKind(kind: SeedActionKind): boolean {
  return BULK_KINDS.includes(kind);
}

export function isManualKind(kind: SeedActionKind): boolean {
  return MANUAL_KINDS.includes(kind);
}

export interface SeedAction {
  /** Stable across runs, so an interrupted seeding run can resume. */
  id: string;
  kind: SeedActionKind;
  /** What the action is for, shown to whoever is driving the run. */
  note: string;
  text?: string;
  /** A self-thread is posted as a chain of replies to the previous post. */
  texts?: string[];
  mediaPaths?: string[];
  pollChoices?: string[];
  targetUrl?: string;
}

export interface SeedPlanOptions {
  /** Stamped into post text so a seeded account is obviously seeded. */
  dateStamp: string;
  fillerPosts: number;
  likes: number;
  bookmarks: number;
  follows: number;
  /** Where the generated seed media lives, from `make-media.sh`. */
  mediaDir: string;
  /**
   * Posts by other accounts to like, bookmark, quote, and retweet. Supplied by
   * whoever is driving the run, since they have to be real live posts.
   */
  targetUrls: string[];
}

/** X returns roughly twenty timeline entries per page. */
export const ENTRIES_PER_PAGE = 20;

/** How many items are needed to be sure a timeline pages this many times. */
export function minimumForPages(
  pages: number,
  entriesPerPage = ENTRIES_PER_PAGE,
): number {
  return pages * entriesPerPage + 1;
}

export function defaultSeedPlanOptions(dateStamp: string): SeedPlanOptions {
  return {
    dateStamp,
    fillerPosts: minimumForPages(3),
    likes: minimumForPages(3),
    bookmarks: minimumForPages(3),
    // Enough to push the following list past its first page, since the walk
    // scrolls it to the bottom to exercise pagination.
    follows: minimumForPages(1),
    mediaDir: "capture/seed-media",
    targetUrls: [],
  };
}

function actionId(prefix: string, index: number): string {
  return `${prefix}-${`${index + 1}`.padStart(3, "0")}`;
}

function fillerText(index: number, dateStamp: string): string {
  // Numbered so that pagination and ordering can be checked against the
  // captured responses without cross-referencing post identifiers.
  return `Cyd seed post ${`${index + 1}`.padStart(3, "0")} of ${dateStamp}. Test account content, safe to delete.`;
}

/**
 * The shapes that have historically broken parsing, walked before the filler
 * posts so that they are far enough down the timeline to appear on a later
 * page rather than only on the first.
 */
function awkwardShapes(options: SeedPlanOptions): SeedAction[] {
  const { dateStamp, mediaDir, targetUrls } = options;
  const actions: SeedAction[] = [
    {
      id: "thread-001",
      kind: "thread",
      note: "Self-thread: three posts, each a reply to the one before",
      texts: [
        `Cyd seed thread ${dateStamp} 1/3. Start of a self-thread.`,
        `Cyd seed thread ${dateStamp} 2/3. Reply to my own post.`,
        `Cyd seed thread ${dateStamp} 3/3. End of the self-thread.`,
      ],
    },
    {
      id: "media-001",
      kind: "media",
      note: "Post with one image",
      text: `Cyd seed media ${dateStamp}: one image.`,
      mediaPaths: [`${mediaDir}/image-1.png`],
    },
    {
      id: "media-002",
      kind: "media",
      note: "Post with four images",
      text: `Cyd seed media ${dateStamp}: four images.`,
      mediaPaths: [
        `${mediaDir}/image-1.png`,
        `${mediaDir}/image-2.png`,
        `${mediaDir}/image-3.png`,
        `${mediaDir}/image-4.png`,
      ],
    },
    {
      id: "media-003",
      kind: "media",
      note: "Post with video",
      text: `Cyd seed media ${dateStamp}: video.`,
      mediaPaths: [`${mediaDir}/video.mp4`],
    },
    {
      id: "poll-001",
      kind: "poll",
      note: "Poll post",
      text: `Cyd seed poll ${dateStamp}. Which one?`,
      pollChoices: ["First choice", "Second choice", "Third choice"],
    },
    {
      id: "link-001",
      kind: "link",
      note: "Post with a link card",
      text: `Cyd seed link card ${dateStamp}: https://cyd.social/`,
    },
    {
      id: "longform-001",
      kind: "longform",
      note: "Long-form post. Posted by hand: X's long-form composer needs premium, and the ordinary composer will not take it",
      text: [
        `Cyd seed long-form post ${dateStamp}.`,
        "",
        "This post exists to exercise the long-form note shape, where the body is",
        "carried outside the ordinary post text field and the timeline entry is",
        "truncated. It has to be long enough that X treats it as long-form rather",
        "than an ordinary post, so it runs past the usual character limit and keeps",
        "going for several paragraphs.",
        "",
        "Everything here is seeded test content on a test account and is safe to",
        "delete at any point during the capture walk.",
      ].join("\n"),
    },
  ];

  targetUrls.slice(0, 2).forEach((targetUrl, index) => {
    actions.push({
      id: actionId("quote", index),
      kind: "quote",
      note: "Quote post",
      text: `Cyd seed quote post ${dateStamp}.`,
      targetUrl,
    });
  });

  targetUrls.slice(0, 2).forEach((targetUrl, index) => {
    actions.push({
      id: actionId("retweet", index),
      kind: "retweet",
      note: "Retweet of another account's post",
      targetUrl,
    });
  });

  actions.push({
    id: "retweet-to-orphan-001",
    kind: "retweet-to-orphan",
    note: "Retweet a post from the second test account, which is then deleted from that account, leaving an orphaned retweet",
  });

  return actions;
}

/**
 * Builds the full plan. Posting comes first, then likes, bookmarks, and
 * follows, because the like and bookmark targets are other accounts' posts and
 * do not depend on anything this account has published.
 */
export function buildSeedPlan(options: SeedPlanOptions): SeedAction[] {
  const actions: SeedAction[] = [...awkwardShapes(options)];

  for (let index = 0; index < options.fillerPosts; index++) {
    actions.push({
      id: actionId("post", index),
      kind: "post",
      note: "Filler post, to force pagination",
      text: fillerText(index, options.dateStamp),
    });
  }

  for (let index = 0; index < options.likes; index++) {
    actions.push({
      id: actionId("like", index),
      kind: "like",
      note: "Like a post from the browsing timeline",
    });
  }

  for (let index = 0; index < options.bookmarks; index++) {
    actions.push({
      id: actionId("bookmark", index),
      kind: "bookmark",
      note: "Bookmark a post from the browsing timeline",
    });
  }

  for (let index = 0; index < options.follows; index++) {
    actions.push({
      id: actionId("follow", index),
      kind: "follow",
      note: "Follow an account from the suggestions",
    });
  }

  return actions;
}

export function summarizePlan(actions: SeedAction[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const action of actions) {
    counts[action.kind] = (counts[action.kind] ?? 0) + 1;
  }
  return counts;
}
