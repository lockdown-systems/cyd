/**
 * Seeds an X test account with enough data, and with the awkward enough data,
 * to make a capture session worth running.
 *
 * Usage:
 *   npx tsx scripts/x-capture/seed.ts --account <handle> [--task all|shapes|posts|likes|bookmarks|follows]
 *     [--count N] [--targets url,url] [--feed URL] [--dry-run] [--unattended]
 *
 * The browser is a real system Chromium with a persistent profile, driven
 * slowly and visibly. It stops and hands control back whenever X shows
 * something it did not expect, rather than hammering at it: the point is a
 * seeded account, not an unattended robot.
 *
 * Run `login` first:
 *   npx tsx scripts/x-capture/seed.ts --account <handle> --task login
 */

import fs from "fs";
import path from "path";
import readline from "readline";

import { chromium, type BrowserContext, type Page } from "playwright-core";

import { dateStampFrom } from "./lib/har";
import {
  buildSeedPlan,
  defaultSeedPlanOptions,
  isBulkKind,
  isManualKind,
  summarizePlan,
  type SeedAction,
} from "./lib/seed_plan";
import {
  actOnNextPost,
  assertNotBlocked,
  BlockedError,
  DailyLimitError,
  ManualActionError,
  followNextAccount,
  isLoggedIn,
  postPoll,
  postSimple,
  postThread,
  postWithMedia,
  quotePost,
  retweetPost,
  SelectorMissingError,
} from "./lib/x_page";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const CAPTURE_DIR = "capture";

interface Options {
  account: string;
  task: string;
  count: number | null;
  targets: string[];
  feed: string;
  dryRun: boolean;
  /** Never prompt: skip what cannot be done and keep going. */
  unattended: boolean;
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const options: Options = {
    account: "",
    task: "all",
    count: null,
    targets: [],
    feed: "https://x.com/home",
    dryRun: false,
    unattended: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--account":
        options.account = args[++i] ?? "";
        break;
      case "--task":
        options.task = args[++i] ?? "all";
        break;
      case "--count":
        options.count = Number(args[++i]);
        break;
      case "--targets":
        options.targets = (args[++i] ?? "").split(",").filter(Boolean);
        break;
      case "--feed":
        options.feed = args[++i] ?? options.feed;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--unattended":
        options.unattended = true;
        break;
      default:
        throw new Error(`Unknown option: ${args[i]}`);
    }
  }

  if (options.account === "") {
    throw new Error("Pass --account <handle>, the X handle to seed.");
  }

  return options;
}

/** Actions completed in earlier runs, so an interrupted run resumes. */
class ProgressLog {
  private done = new Set<string>();

  constructor(private logPath: string) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    if (fs.existsSync(logPath)) {
      for (const line of fs.readFileSync(logPath, "utf8").split("\n")) {
        if (line.trim() === "") continue;
        const entry = JSON.parse(line) as { id: string; status: string };
        if (entry.status === "done" || entry.status === "skipped") {
          this.done.add(entry.id);
        }
      }
    }
  }

  isDone(id: string): boolean {
    return this.done.has(id);
  }

  record(id: string, status: "done" | "skipped" | "failed", detail?: string) {
    if (status !== "failed") {
      this.done.add(id);
    }
    fs.appendFileSync(
      this.logPath,
      `${JSON.stringify({ id, status, detail, at: new Date().toISOString() })}\n`,
    );
  }
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/** Paced like a person, because it is pretending to be one. */
function humanPause(): Promise<void> {
  const ms = 4000 + Math.floor(Math.random() * 5000);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launch(account: string): Promise<BrowserContext> {
  const profileDir = path.join(CAPTURE_DIR, "profiles", account);
  fs.mkdirSync(profileDir, { recursive: true });

  if (!fs.existsSync(CHROMIUM_PATH)) {
    throw new Error(
      `No Chromium at ${CHROMIUM_PATH}. Install it, or set CHROMIUM_PATH.`,
    );
  }

  return chromium.launchPersistentContext(profileDir, {
    executablePath: CHROMIUM_PATH,
    headless: false,
    viewport: null,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

function shouldRun(action: SeedAction, task: string): boolean {
  switch (task) {
    case "all":
      return true;
    case "shapes":
      return !isBulkKind(action.kind);
    case "posts":
      return action.kind === "post";
    case "likes":
      return action.kind === "like";
    case "bookmarks":
      return action.kind === "bookmark";
    case "follows":
      return action.kind === "follow";
    default:
      throw new Error(`Unknown task: ${task}`);
  }
}

function requireText(action: SeedAction): string {
  if (action.text === undefined || action.text.trim() === "") {
    throw new Error(`${action.id} has no text to post`);
  }
  return action.text;
}

function requireTarget(action: SeedAction): string {
  if (action.targetUrl === undefined || action.targetUrl === "") {
    throw new Error(`${action.id} has no target post. Pass --targets.`);
  }
  return action.targetUrl;
}

interface FeedState {
  actionsSinceReload: number;
}

async function runAction(
  page: Page,
  action: SeedAction,
  feed: FeedState,
  feedUrl: string,
) {
  if (isManualKind(action.kind)) {
    throw new ManualActionError(action.note);
  }

  switch (action.kind) {
    case "post":
    case "link":
      await postSimple(page, requireText(action));
      break;
    case "thread":
      await postThread(page, action.texts ?? []);
      break;
    case "media":
      await postWithMedia(page, requireText(action), action.mediaPaths ?? []);
      break;
    case "poll":
      await postPoll(page, requireText(action), action.pollChoices ?? []);
      break;
    case "quote":
      await quotePost(page, requireTarget(action), requireText(action));
      break;
    case "retweet":
      await retweetPost(page, requireTarget(action));
      break;
    case "retweet-to-orphan":
      // Handled above, before the switch.
      break;
    case "like":
      if (feed.actionsSinceReload === 0) {
        await page.goto(feedUrl, { waitUntil: "domcontentloaded" });
      }
      await actOnNextPost(page, "like");
      break;
    case "bookmark":
      if (feed.actionsSinceReload === 0) {
        await page.goto(feedUrl, { waitUntil: "domcontentloaded" });
      }
      await actOnNextPost(page, "bookmark");
      break;
    case "follow":
      if (feed.actionsSinceReload === 0) {
        await page.goto("https://x.com/i/connect_people", {
          waitUntil: "domcontentloaded",
        });
      }
      await followNextAccount(page);
      break;
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const stamp = dateStampFrom(new Date());

  const planOptions = defaultSeedPlanOptions(stamp);
  planOptions.targetUrls = options.targets;
  if (options.count !== null) {
    planOptions.fillerPosts = options.count;
    planOptions.likes = options.count;
    planOptions.bookmarks = options.count;
    planOptions.follows = options.count;
  }

  const plan = buildSeedPlan(planOptions).filter((action) =>
    shouldRun(action, options.task === "login" ? "all" : options.task),
  );

  console.log(`Seed plan for @${options.account}:`, summarizePlan(plan));

  if (options.targets.length === 0 && options.task !== "posts") {
    console.log(
      "\nNo --targets given, so no quote posts and no retweets will be seeded.",
    );
    console.log(
      "Pass --targets <url>,<url> with live posts by other accounts to include them.",
    );
  }

  if (options.dryRun) {
    for (const action of plan) {
      console.log(`  ${action.id}  ${action.kind}  ${action.note}`);
    }
    return;
  }

  const sessionDir = path.join(CAPTURE_DIR, "seed", options.account);
  const progress = new ProgressLog(path.join(sessionDir, "progress.jsonl"));
  const issuesPath = path.join(sessionDir, "selector-issues.jsonl");
  fs.mkdirSync(path.join(sessionDir, "failures"), { recursive: true });

  const context = await launch(options.account);
  const page = context.pages()[0] ?? (await context.newPage());

  if (!(await isLoggedIn(page))) {
    if (options.unattended) {
      console.log(
        `Not logged in as @${options.account}, and an unattended run cannot log in. Stopping.`,
      );
      await context.close();
      process.exitCode = 2;
      return;
    }
    console.log(
      `\nLog in as @${options.account} in the browser window that just opened.`,
    );
    await ask("Press Enter once you are logged in and on the home timeline: ");
    if (!(await isLoggedIn(page))) {
      console.log("Still not logged in. Stopping.");
      await context.close();
      return;
    }
  }
  console.log(`Logged in as @${options.account}.`);

  if (options.task === "login") {
    await ask("Session saved. Press Enter to close the browser: ");
    await context.close();
    return;
  }

  const feed: FeedState = { actionsSinceReload: 0 };

  for (const action of plan) {
    if (progress.isDone(action.id)) {
      continue;
    }

    let attempts = 0;
    for (;;) {
      attempts += 1;
      try {
        await assertNotBlocked(page);
        await runAction(page, action, feed, options.feed);
        progress.record(action.id, "done");
        console.log(`✓ ${action.id} ${action.kind}`);
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const screenshot = path.join(
          sessionDir,
          "failures",
          `${action.id}-${attempts}.png`,
        );
        if (!(error instanceof ManualActionError)) {
          await page.screenshot({ path: screenshot }).catch(() => {});
        }

        if (error instanceof DailyLimitError) {
          console.log(`\n✗ ${action.id} ${action.kind}: ${message}`);
          console.log(
            "  Stopping: everything after this would be refused the same way.",
          );
          progress.record(action.id, "failed", message);
          await context.close();
          process.exitCode = 3;
          return;
        }

        if (error instanceof ManualActionError) {
          console.log(`\n⏸ ${action.id} ${action.kind}: do this one by hand.`);
          console.log(`  ${message}`);
          if (options.unattended) {
            console.log("  Skipped: nobody is watching this run.");
            progress.record(action.id, "skipped", message);
            break;
          }
          const manual = await ask("  [d]one, [s]kip, [q]uit? ");
          if (manual === "q") {
            await context.close();
            return;
          }
          progress.record(action.id, manual === "d" ? "done" : "skipped");
          break;
        }

        if (error instanceof SelectorMissingError) {
          // A selector X has changed is a finding, not just a failure.
          fs.appendFileSync(
            issuesPath,
            `${JSON.stringify({
              id: action.id,
              kind: action.kind,
              selector: error.selector,
              url: page.url(),
              screenshot,
              at: new Date().toISOString(),
            })}\n`,
          );
        }

        console.log(`\n✗ ${action.id} ${action.kind}: ${message}`);
        console.log(`  url: ${page.url()}`);
        console.log(`  screenshot: ${screenshot}`);
        if (error instanceof BlockedError) {
          console.log("  X interrupted the session. Clear it in the window.");
        }

        if (options.unattended) {
          // X interrupting the session needs a person, so stop rather than
          // grind against it. Anything else gets a few tries, then is left for
          // whoever reads the log.
          if (error instanceof BlockedError) {
            progress.record(action.id, "failed", message);
            await context.close();
            process.exitCode = 2;
            return;
          }
          if (attempts >= 3) {
            console.log(`  Giving up on ${action.id} after ${attempts} tries.`);
            progress.record(action.id, "skipped", message);
            break;
          }
          console.log(`  Retrying ${action.id} (try ${attempts + 1} of 3).`);
          await page
            .goto("https://x.com/home", { waitUntil: "domcontentloaded" })
            .catch(() => {});
          feed.actionsSinceReload = 0;
          await new Promise((resolve) => setTimeout(resolve, 15000));
          continue;
        }

        await page
          .goto("https://x.com/home", { waitUntil: "domcontentloaded" })
          .catch(() => {});
        feed.actionsSinceReload = 0;

        const answer = await ask("  [r]etry, [s]kip, [q]uit? ");
        if (answer === "s") {
          progress.record(action.id, "skipped", message);
          break;
        }
        if (answer === "q") {
          progress.record(action.id, "failed", message);
          await context.close();
          return;
        }
      }
    }

    feed.actionsSinceReload += 1;
    if (feed.actionsSinceReload >= 15) {
      // A long pause and a fresh feed, rather than a steady grind.
      console.log("  pausing, then reloading the feed");
      feed.actionsSinceReload = 0;
      await new Promise((resolve) => setTimeout(resolve, 60000));
    } else {
      await humanPause();
    }
  }

  console.log("\nSeeding run finished.");
  if (fs.existsSync(issuesPath)) {
    console.log(`Selectors that did not match: ${issuesPath}`);
  }
  if (!options.unattended) {
    await ask("Press Enter to close the browser: ");
  }
  await context.close();
}

main();
