/**
 * Walks the destructive capture flows and records what X returns.
 *
 * Driven through X's own interface rather than by issuing mutations directly,
 * because the point is to capture what X's client sends: which operations, with
 * which identifiers, and — the part Cyd currently gets wrong — with which
 * referrers.
 *
 * Usage:
 *   npx tsx scripts/x-capture/delete-walk.ts --account <handle> [--dry-run]
 *
 * This deletes things, in the order #709 sets out: least destructive first, so
 * that a failure early costs as little as possible. It is irreversible.
 */

import fs from "fs";
import path from "path";

import { chromium, type Page } from "playwright-core";

import { dateStampFrom } from "./lib/har";
import { attachToPages, Recorder } from "./lib/recorder";
import { buildDeleteWalk, type DeleteStep } from "./lib/walk_plan";
import { assertNotBlocked, isLoggedIn, SELECTORS } from "./lib/x_page";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const CAPTURE_DIR = "capture";

interface Options {
  account: string;
  label: string;
  dryRun: boolean;
  /** Run one step rather than the whole walk, for filling a gap. */
  only: string | null;
  count: number | null;
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const options: Options = {
    account: "",
    label: "03-destructive",
    dryRun: false,
    only: null,
    count: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--account":
        options.account = args[++i] ?? "";
        break;
      case "--label":
        options.label = args[++i] ?? options.label;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--only":
        options.only = args[++i] ?? null;
        break;
      case "--count":
        options.count = Number(args[++i]);
        break;
      default:
        throw new Error(`Unknown option: ${args[i]}`);
    }
  }

  if (options.account === "") {
    throw new Error("Pass --account <handle>.");
  }

  return options;
}

const pause = (page: Page, ms = 2500) => page.waitForTimeout(ms);

async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await pause(page, 3500);
  await assertNotBlocked(page);
}

/**
 * Deletes the first post on the profile timeline through its own menu, which
 * is how X's client issues the mutation.
 */
async function deleteOnePost(page: Page): Promise<boolean> {
  const menus = page.locator(SELECTORS.postMenu);
  if ((await menus.count()) === 0) {
    return false;
  }

  await menus.first().click();
  await pause(page, 1200);

  const deleteItem = page
    .getByRole("menuitem")
    .filter({ hasText: /^Delete/ })
    .first();
  if ((await deleteItem.count()) === 0) {
    // Not our post, or the menu has changed: close it and say so.
    await page.keyboard.press("Escape");
    return false;
  }

  await deleteItem.click();
  await pause(page, 1200);
  await page.locator(SELECTORS.confirmSheet).first().click();
  await pause(page, 3000);
  return true;
}

async function clickFirst(page: Page, selector: string): Promise<boolean> {
  const target = page.locator(selector).first();
  if ((await target.count()) === 0) {
    return false;
  }
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click();
  await pause(page, 2500);
  return true;
}

/**
 * Repeats a delete that already succeeded, using the request X's own client
 * sent. This is the response to a mutation aimed at something that is no
 * longer there — the case an orphaned retweet would have produced, which no
 * timeline read can supply.
 */
async function replayDelete(page: Page, recorder: Recorder): Promise<boolean> {
  const sent = recorder.entriesSent.find(
    (entry) =>
      entry.request.method === "POST" &&
      entry.request.url.includes("/DeleteTweet"),
  );
  if (sent === undefined) {
    return false;
  }

  const body = sent.request.postData?.text ?? "";
  const referrer =
    sent.request.headers.find(
      (header) => header.name.toLowerCase() === "referer",
    )?.value ?? `https://x.com/${""}`;

  await page.evaluate(
    async ({ url, body, referrer }) => {
      const csrf = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("ct0="))
        ?.slice(4);
      await fetch(url, {
        headers: {
          authorization:
            "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
          "content-type": "application/json",
          "x-csrf-token": csrf ?? "",
          "x-twitter-active-user": "yes",
          "x-twitter-auth-type": "OAuth2Session",
        },
        referrer,
        body,
        method: "POST",
        mode: "cors",
        credentials: "include",
      });
    },
    { url: sent.request.url, body, referrer },
  );

  await pause(page, 3000);
  return true;
}

async function runStep(
  page: Page,
  step: DeleteStep,
  account: string,
  recorder: Recorder,
): Promise<string> {
  switch (step.kind) {
    case "delete-post": {
      await open(page, `https://x.com/${account}`);
      let done = 0;
      for (let i = 0; i < step.count; i++) {
        if (await deleteOnePost(page)) {
          done += 1;
        }
        await pause(page, 3000);
      }
      return `${done} of ${step.count} deleted`;
    }

    case "undo-retweet": {
      await open(page, `https://x.com/${account}`);
      let done = 0;
      for (let i = 0; i < step.count; i++) {
        // Retweets sit wherever they were made, which is rarely the top of the
        // timeline, so scroll until one is rendered.
        let found = false;
        for (let scroll = 0; scroll < 25 && !found; scroll++) {
          if ((await page.locator(SELECTORS.unretweet).count()) > 0) {
            found = true;
            break;
          }
          await page.mouse.wheel(0, 2500);
          await page.waitForTimeout(1200);
        }
        if (!found) break;
        if (!(await clickFirst(page, SELECTORS.unretweet))) break;
        await clickFirst(page, SELECTORS.unretweetConfirm);
        done += 1;
      }
      return `${done} undone`;
    }

    case "unlike": {
      await open(page, `https://x.com/${account}/likes`);
      let done = 0;
      for (let i = 0; i < step.count; i++) {
        if (!(await clickFirst(page, SELECTORS.unlike))) break;
        done += 1;
      }
      return `${done} unliked`;
    }

    case "unbookmark": {
      await open(page, "https://x.com/i/bookmarks");
      let done = 0;
      for (let i = 0; i < step.count; i++) {
        if (!(await clickFirst(page, SELECTORS.removeBookmark))) break;
        done += 1;
      }
      return `${done} un-bookmarked`;
    }

    case "unfollow": {
      await open(page, `https://x.com/${account}/following`);
      let done = 0;
      for (let i = 0; i < step.count; i++) {
        if (!(await clickFirst(page, SELECTORS.unfollow))) break;
        await clickFirst(page, SELECTORS.confirmSheet);
        done += 1;
      }
      return `${done} unfollowed`;
    }

    case "replay-delete":
      return (await replayDelete(page, recorder))
        ? "repeated a delete that already succeeded"
        : "no delete was captured to repeat";

    case "update-bio": {
      await open(page, "https://x.com/settings/profile");
      const bio = page.locator(SELECTORS.bioTextarea).first();
      if ((await bio.count()) === 0) {
        return "bio field not found";
      }
      await bio.evaluate((node) => (node as HTMLElement).focus());
      await page.keyboard.press("Control+A");
      await bio.type(
        `Seeded test account. Captured ${dateStampFrom(new Date())}.`,
        {
          delay: 20,
        },
      );
      await pause(page, 1000);
      return (await clickFirst(page, SELECTORS.profileSaveButton))
        ? "bio saved"
        : "save button not found";
    }

    case "lock-account": {
      await open(page, "https://x.com/settings/audience_and_tagging");
      const checkbox = page.locator('input[type="checkbox"]').first();
      if ((await checkbox.count()) === 0) {
        return "protect checkbox not found";
      }
      await checkbox.click();
      await pause(page, 1500);
      await clickFirst(page, SELECTORS.confirmSheet);
      await pause(page, 3000);

      // Unlock again, so the account is left as it was found.
      await checkbox.click().catch(() => {});
      await pause(page, 1500);
      await clickFirst(page, SELECTORS.confirmSheet).catch(() => false);
      return "locked and unlocked";
    }

    case "provoke-rate-limit": {
      for (let i = 0; i < step.count; i++) {
        await open(page, `https://x.com/${account}/likes`);
        for (let scroll = 0; scroll < 6; scroll++) {
          await page.mouse.wheel(0, 4000);
          await page.waitForTimeout(400);
        }
      }
      return `${step.count} hard reloads`;
    }
  }
}

async function main() {
  const options = parseArgs(process.argv);
  let steps = buildDeleteWalk();
  if (options.only !== null) {
    steps = steps.filter((step) => step.kind === options.only);
    if (steps.length === 0) {
      throw new Error(`No such step: ${options.only}`);
    }
  }
  if (options.count !== null) {
    steps = steps.map((step) => ({ ...step, count: options.count as number }));
  }

  if (options.dryRun) {
    for (const step of steps) {
      console.log(`  ${step.kind} ×${step.count}: ${step.note}`);
    }
    return;
  }

  const stamp = dateStampFrom(new Date());
  const harPath = path.join(CAPTURE_DIR, stamp, "raw", `${options.label}.har`);

  const context = await chromium.launchPersistentContext(
    path.join(CAPTURE_DIR, "profiles", options.account),
    {
      executablePath: CHROMIUM_PATH,
      headless: false,
      viewport: null,
      args: ["--disable-blink-features=AutomationControlled"],
    },
  );

  const recorder = new Recorder(harPath);
  attachToPages(context, recorder);
  context.on("close", () => recorder.write());

  const page = context.pages()[0] ?? (await context.newPage());

  if (!(await isLoggedIn(page))) {
    console.log(`Not logged in as @${options.account}. Stopping.`);
    await context.close().catch(() => {});
    process.exitCode = 2;
    return;
  }

  console.log(`Deleting as @${options.account}, least destructive first.`);
  console.log(`Recording to ${harPath}\n`);

  for (const step of steps) {
    try {
      const outcome = await runStep(page, step, options.account, recorder);
      console.log(`✓ ${step.kind}: ${outcome}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${step.kind}: ${message.split("\n")[0]}`);
      await page
        .goto(`https://x.com/${options.account}`, {
          waitUntil: "domcontentloaded",
        })
        .catch(() => {});
    }
    recorder.write();
    await pause(page, 4000);
  }

  recorder.write();
  await context.close().catch(() => {});

  const size = fs.existsSync(harPath) ? fs.statSync(harPath).size : 0;
  console.log(
    `\nWrote ${harPath}: ${recorder.count} calls, ${(size / 1024 / 1024).toFixed(1)} MB`,
  );
}

main();
