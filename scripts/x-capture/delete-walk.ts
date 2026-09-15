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

/**
 * Clicks through X's own JavaScript rather than with the pointer, which is how
 * Cyd does it too. The settings dialogs keep a mask in their #layers subtree
 * that swallows pointer events aimed at what it covers.
 */
async function jsClick(page: Page, selector: string): Promise<boolean> {
  const target = page.locator(selector).first();
  try {
    await target.waitFor({ state: "attached", timeout: 15000 });
  } catch {
    return false;
  }
  await target.evaluate((node) => (node as HTMLElement).click());
  await pause(page, 2500);
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
async function replayDelete(page: Page, recorder: Recorder): Promise<string> {
  const sent = recorder.entriesSent.find(
    (entry) =>
      entry.request.method === "POST" &&
      entry.request.url.includes("/DeleteTweet"),
  );
  if (sent === undefined) {
    return "no delete was captured to repeat";
  }

  const header = (name: string) =>
    sent.request.headers.find(
      (candidate) => candidate.name.toLowerCase() === name,
    )?.value ?? "";

  const replayed = await page.evaluate(
    async ({ url, body, referrer, authorization }) => {
      const csrf = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("ct0="))
        ?.slice(4);
      const response = await fetch(url, {
        headers: {
          authorization,
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
      // Read it here: a body the page never reads is one Chromium discards,
      // leaving the recorder with nothing to capture.
      return { status: response.status, body: await response.text() };
    },
    {
      url: sent.request.url,
      body: sent.request.postData?.text ?? "",
      referrer: header("referer"),
      authorization: header("authorization"),
    },
  );

  await pause(page, 3000);
  return `repeat answered ${replayed.status}: ${replayed.body.slice(0, 160) || "(empty body)"}`;
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
      // Reposts have their own route now; the profile timeline has none.
      await open(page, `https://x.com/${account}/reposts`);
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
      return replayDelete(page, recorder);

    case "check-viewer": {
      // X's own client no longer calls this, so the only way to learn whether
      // it still answers is to ask it, exactly as Cyd does.
      const anyGraphql = recorder.entriesSent.find((entry) =>
        entry.request.url.includes("/graphql/"),
      );
      const authorization =
        anyGraphql?.request.headers.find(
          (header) => header.name.toLowerCase() === "authorization",
        )?.value ?? "";
      if (authorization === "") {
        return "no authorization captured yet to ask with";
      }

      const url =
        "https://api.x.com/graphql/WBT8ommFCSHiy3z2_4k1Vg/Viewer?variables=%7B%22withCommunitiesMemberships%22%3Atrue%7D&features=%7B%22profile_label_improvements_pcf_label_in_post_enabled%22%3Atrue%2C%22rweb_tipjar_consumption_enabled%22%3Atrue%2C%22responsive_web_graphql_exclude_directive_enabled%22%3Atrue%2C%22verified_phone_label_enabled%22%3Afalse%2C%22creator_subscriptions_tweet_preview_api_enabled%22%3Atrue%2C%22responsive_web_graphql_skip_user_profile_image_extensions_enabled%22%3Afalse%2C%22responsive_web_graphql_timeline_navigation_enabled%22%3Atrue%7D&fieldToggles=%7B%22isDelegate%22%3Afalse%2C%22withAuxiliaryUserLabels%22%3Afalse%7D";

      const answer = await page.evaluate(
        async ({ url, authorization }) => {
          const csrf = document.cookie
            .split("; ")
            .find((entry) => entry.startsWith("ct0="))
            ?.slice(4);
          const response = await fetch(url, {
            headers: {
              authorization,
              "content-type": "application/json",
              "x-csrf-token": csrf ?? "",
              "x-twitter-active-user": "yes",
              "x-twitter-auth-type": "OAuth2Session",
            },
            referrer: "https://x.com/",
            method: "GET",
            mode: "cors",
            credentials: "include",
          });
          return { status: response.status, body: await response.text() };
        },
        { url, authorization },
      );

      const outPath = path.join(
        CAPTURE_DIR,
        dateStampFrom(new Date()),
        "raw",
        "viewer-response.json",
      );
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, answer.body);

      await pause(page, 2000);
      return `Viewer answered ${answer.status}, ${answer.body.length} bytes, written to ${outPath}`;
    }

    case "update-banner": {
      await open(page, "https://x.com/settings/profile");

      const fileInput = page.locator('input[data-testid="fileInput"]').first();
      if ((await fileInput.count()) === 0) {
        return "no file input on the profile settings page";
      }
      await fileInput.setInputFiles("capture/seed-media/image-2.png");
      await pause(page, 4000);

      // X crops the image first, behind a mask that eats pointer events.
      if (!(await jsClick(page, '[data-testid="applyButton"]'))) {
        return "upload accepted but no apply button appeared";
      }

      return (await jsClick(page, SELECTORS.profileSaveButton))
        ? "banner saved"
        : "save button not found after applying";
    }

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
