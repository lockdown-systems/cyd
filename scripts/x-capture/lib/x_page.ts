/**
 * The X interface, as the seeder drives it.
 *
 * Every selector X's own interface is reached by lives here, in one place, so
 * that a selector X has changed is a single visible edit. A selector that no
 * longer matches is not a crash: it is reported, screenshotted, and handed to
 * the person driving the run, because a selector that moved is exactly the
 * ground truth this capture session exists to establish.
 */

import type { Page } from "playwright-core";

export const SELECTORS = {
  // Composing
  composerTextarea: '[data-testid="tweetTextarea_0"]',
  composerTextareaNth: (index: number) =>
    `[data-testid="tweetTextarea_${index}"]`,
  composerFileInput: 'input[data-testid="fileInput"]',
  composerPollButton: '[data-testid="createPollButton"]',
  composerPollChoice: (index: number) => `input[name="Choice${index + 1}"]`,
  // The control that adds a third and fourth choice carries no test
  // identifier, so it is reached by its accessible name. "Remove poll" is the
  // other button in the poll editor, hence matching on "choice" rather than
  // "poll".
  composerAddPollChoiceName: /choice/i,
  composerAddToThread: '[data-testid="addButton"]',
  composerPostButton: '[data-testid="tweetButton"]',
  composerPostButtonInline: '[data-testid="tweetButtonInline"]',

  // Posts in a timeline
  post: 'article[data-testid="tweet"]',
  like: '[data-testid="like"]',
  unlike: '[data-testid="unlike"]',
  bookmark: '[data-testid="bookmark"]',
  removeBookmark: '[data-testid="removeBookmark"]',
  retweet: '[data-testid="retweet"]',
  retweetConfirm: '[data-testid="retweetConfirm"]',
  unretweet: '[data-testid="unretweet"]',
  quoteMenuItem: 'a[href$="/compose/post"], [role="menuitem"]',

  // Accounts
  follow: '[data-testid$="-follow"]',
  unfollow: '[data-testid$="-unfollow"]',

  // Session state
  loggedIn: '[data-testid="SideNav_NewTweet_Button"]',
  loginForm: 'input[autocomplete="username"]',
} as const;

/** X's anti-automation interstitials, which end a run rather than retry it. */
const BLOCKED_MARKERS = [
  "/account/access",
  "/i/flow/consent_flow",
  "/i/flow/login",
];

export class BlockedError extends Error {}

/** A step only a person can do, such as one needing a second account. */
export class ManualActionError extends Error {}

export class SelectorMissingError extends Error {
  constructor(public selector: string) {
    super(`Selector not found: ${selector}`);
  }
}

export async function assertNotBlocked(page: Page) {
  const url = page.url();
  if (BLOCKED_MARKERS.some((marker) => url.includes(marker))) {
    throw new BlockedError(
      `X interrupted the session with ${url}. Finish it by hand in the open window before continuing.`,
    );
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto("https://x.com/home", { waitUntil: "domcontentloaded" });
  try {
    await page.waitForSelector(SELECTORS.loggedIn, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function click(page: Page, selector: string, timeout = 15000) {
  await assertNotBlocked(page);
  const element = page.locator(selector).first();
  try {
    await element.waitFor({ state: "visible", timeout });
  } catch {
    throw new SelectorMissingError(selector);
  }
  await element.click();
}

async function fill(page: Page, selector: string, text: string) {
  await assertNotBlocked(page);
  const element = page.locator(selector).first();
  try {
    await element.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    throw new SelectorMissingError(selector);
  }
  // Typed rather than set, because the composer's post button stays disabled
  // until it sees input events.
  await element.click();
  await element.type(text, { delay: 12 });
}

async function doesExist(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count()) > 0;
}

/** X's poll editor opens with two choices; further ones are added one at a
 * time, and each field only exists once it has been added. */
async function addPollChoice(page: Page): Promise<boolean> {
  const button = page
    .getByRole("button", { name: SELECTORS.composerAddPollChoiceName })
    .first();
  try {
    await button.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    return false;
  }
  await button.click();
  await page.waitForTimeout(500);
  return true;
}

export async function openComposer(page: Page) {
  await page.goto("https://x.com/compose/post", {
    waitUntil: "domcontentloaded",
  });
  await assertNotBlocked(page);
}

async function submitComposer(page: Page) {
  try {
    await click(page, SELECTORS.composerPostButton, 10000);
  } catch (error) {
    if (!(error instanceof SelectorMissingError)) {
      throw error;
    }
    await click(page, SELECTORS.composerPostButtonInline, 10000);
  }
  // The composer closes once the post is accepted.
  await page.waitForTimeout(3000);
}

export async function postSimple(page: Page, text: string) {
  await openComposer(page);
  await fill(page, SELECTORS.composerTextarea, text);
  await submitComposer(page);
}

export async function postWithMedia(
  page: Page,
  text: string,
  mediaPaths: string[],
) {
  await openComposer(page);
  await fill(page, SELECTORS.composerTextarea, text);
  const input = page.locator(SELECTORS.composerFileInput).first();
  await input.setInputFiles(mediaPaths);
  // Uploads have to finish before the post button becomes usable.
  await page.waitForTimeout(4000 + mediaPaths.length * 3000);
  await submitComposer(page);
}

export async function postPoll(page: Page, text: string, choices: string[]) {
  await openComposer(page);
  await fill(page, SELECTORS.composerTextarea, text);
  await click(page, SELECTORS.composerPollButton);

  for (let index = 0; index < choices.length; index++) {
    const selector = SELECTORS.composerPollChoice(index);

    if (!(await doesExist(page, selector)) && !(await addPollChoice(page))) {
      // Two choices is still a poll, and the poll is the shape being seeded.
      // Losing the third choice is not worth losing the post.
      break;
    }

    await fill(page, selector, choices[index]);
  }

  await submitComposer(page);
}

export async function postThread(page: Page, texts: string[]) {
  await openComposer(page);
  for (let index = 0; index < texts.length; index++) {
    if (index > 0) {
      await click(page, SELECTORS.composerAddToThread);
    }
    await fill(page, SELECTORS.composerTextareaNth(index), texts[index]);
  }
  await submitComposer(page);
}

/**
 * X disables the repost control outright on posts it will not let anyone
 * repost — a protected account's posts, most often. Clicking it would spend
 * the full timeout waiting for a button that is never going to enable, so say
 * what is actually wrong.
 */
async function assertRepostable(page: Page) {
  const button = page.locator(SELECTORS.retweet).first();
  try {
    await button.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    throw new SelectorMissingError(SELECTORS.retweet);
  }
  if (await button.isDisabled()) {
    throw new Error(
      "X has disabled reposting on this post. Its author's account is probably protected; pick a target from an unprotected account.",
    );
  }
}

export async function quotePost(page: Page, targetUrl: string, text: string) {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await assertRepostable(page);
  await click(page, SELECTORS.retweet);
  // The repost menu offers "Repost" and "Quote"; the quote entry opens the
  // composer rather than posting immediately.
  await page.getByRole("menuitem").last().click();
  await fill(page, SELECTORS.composerTextarea, text);
  await submitComposer(page);
}

export async function retweetPost(page: Page, targetUrl: string) {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await assertRepostable(page);
  await click(page, SELECTORS.retweet);
  await click(page, SELECTORS.retweetConfirm);
  await page.waitForTimeout(2000);
}

/**
 * Clicks the nth match in a feed, scrolling to load more when the feed has not
 * yet rendered that many. Working by index is how repeated calls walk down the
 * timeline instead of fighting over the top item.
 */
async function clickNthAfterScrolling(
  page: Page,
  selector: string,
  index: number,
) {
  await assertNotBlocked(page);
  const buttons = page.locator(selector);

  for (let attempt = 0; attempt < 8; attempt++) {
    if ((await buttons.count()) > index) {
      await buttons.nth(index).scrollIntoViewIfNeeded();
      await buttons.nth(index).click();
      return;
    }
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(1500);
  }

  throw new SelectorMissingError(selector);
}

export async function actOnNextPost(
  page: Page,
  action: "like" | "bookmark",
  alreadyDone: number,
) {
  await clickNthAfterScrolling(
    page,
    action === "like" ? SELECTORS.like : SELECTORS.bookmark,
    alreadyDone,
  );
}

export async function followNextAccount(page: Page, alreadyDone: number) {
  await clickNthAfterScrolling(page, SELECTORS.follow, alreadyDone);
}
