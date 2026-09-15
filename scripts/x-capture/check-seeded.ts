/**
 * Reads a seeded account's profile timeline and reports which filler posts
 * actually exist, because clicking post is not evidence that a post was made.
 *
 * Usage:
 *   npx tsx scripts/x-capture/check-seeded.ts --account <handle> [--expected N] [--repair]
 *
 * `--repair` rewrites the progress log so that posts which are not on the
 * timeline are no longer recorded as done, letting a later run make them.
 */

import fs from "fs";
import path from "path";

import { chromium } from "playwright-core";

import {
  missingSeedPosts,
  seedPostNumbers,
  defaultSeedPlanOptions,
} from "./lib/seed_plan";
import { SELECTORS } from "./lib/x_page";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const CAPTURE_DIR = "capture";

interface Options {
  account: string;
  expected: number;
  repair: boolean;
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const options: Options = {
    account: "",
    expected: defaultSeedPlanOptions("00000000").fillerPosts,
    repair: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--account":
        options.account = args[++i] ?? "";
        break;
      case "--expected":
        options.expected = Number(args[++i]);
        break;
      case "--repair":
        options.repair = true;
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

/** Scrolls the whole profile timeline, collecting the text of every post. */
async function readTimelineTexts(
  page: import("playwright-core").Page,
  account: string,
): Promise<string[]> {
  await page.goto(`https://x.com/${account}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  const texts = new Set<string>();
  let unchangedRounds = 0;

  while (unchangedRounds < 3) {
    const before = texts.size;
    for (const text of await page.locator(SELECTORS.post).allInnerTexts()) {
      texts.add(text);
    }
    if (texts.size === before) {
      unchangedRounds += 1;
    } else {
      unchangedRounds = 0;
    }
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1500);
  }

  return [...texts];
}

function repairProgress(logPath: string, missing: string[]) {
  if (!fs.existsSync(logPath)) {
    return;
  }
  const missingIDs = new Set(missing);
  const kept = fs
    .readFileSync(logPath, "utf8")
    .split("\n")
    .filter((line) => {
      if (line.trim() === "") return false;
      const entry = JSON.parse(line) as { id: string };
      return !missingIDs.has(entry.id);
    });
  fs.writeFileSync(logPath, kept.length ? `${kept.join("\n")}\n` : "");
}

async function main() {
  const options = parseArgs(process.argv);
  const profileDir = path.join(CAPTURE_DIR, "profiles", options.account);

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROMIUM_PATH,
    headless: false,
    viewport: null,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] ?? (await context.newPage());

  const texts = await readTimelineTexts(page, options.account);
  const found = seedPostNumbers(texts);
  const missing = missingSeedPosts(found, options.expected);

  console.log(`Posts visible on @${options.account}: ${texts.length}`);
  console.log(`Filler posts found: ${found.length} of ${options.expected}`);
  if (found.length > 0) {
    console.log(`Highest number seen: ${found[found.length - 1]}`);
  }
  console.log(`Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log(
      `  ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}`,
    );
  }

  if (options.repair) {
    repairProgress(
      path.join(CAPTURE_DIR, "seed", options.account, "progress.jsonl"),
      missing,
    );
    console.log(
      `Progress repaired: ${missing.length} posts are no longer recorded as done.`,
    );
  }

  await context.close();
}

main();
