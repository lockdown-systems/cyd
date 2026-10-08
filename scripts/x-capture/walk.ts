/**
 * Walks the non-destructive capture flows and records what X returns.
 *
 * Every timeline is scrolled to the very bottom, so pagination is exercised
 * rather than assumed, and each seeded shape's permalink is opened. On every
 * surface, each selector Cyd's automation depends on is counted: a selector
 * matching nothing is the silent breakage this exercise exists to find.
 *
 * Usage:
 *   npx tsx scripts/x-capture/walk.ts --account <handle> [--label 01-read-main]
 *     [--permalinks capture/seed/<handle>/permalinks.md] [--no-permalinks]
 *
 * This walks reads only. Nothing here deletes anything.
 */

import fs from "fs";
import path from "path";

import { chromium, type Page } from "playwright-core";

import { dateStampFrom } from "./lib/har";
import { attachToPages, Recorder } from "./lib/recorder";
import {
  buildReadWalk,
  formatCensus,
  parsePermalinks,
  type CensusRow,
  type WalkStep,
} from "./lib/walk_plan";
import {
  assertNotBlocked,
  INVENTORY_SELECTORS,
  isLoggedIn,
} from "./lib/x_page";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const CAPTURE_DIR = "capture";

interface Options {
  account: string;
  label: string;
  permalinksPath: string | null;
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const options: Options = {
    account: "",
    label: "01-read-main",
    permalinksPath: null,
  };
  let usePermalinks = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--account":
        options.account = args[++i] ?? "";
        break;
      case "--label":
        options.label = args[++i] ?? options.label;
        break;
      case "--permalinks":
        options.permalinksPath = args[++i] ?? null;
        break;
      case "--no-permalinks":
        usePermalinks = false;
        break;
      default:
        throw new Error(`Unknown option: ${args[i]}`);
    }
  }

  if (options.account === "") {
    throw new Error("Pass --account <handle>.");
  }

  if (usePermalinks && options.permalinksPath === null) {
    options.permalinksPath = path.join(
      CAPTURE_DIR,
      "seed",
      options.account,
      "permalinks.md",
    );
  }
  if (!usePermalinks) {
    options.permalinksPath = null;
  }

  return options;
}

/**
 * Scrolls until X stops fetching pages. A new page arriving is the only
 * reliable signal that there is more, since X recycles the rows it has
 * rendered rather than growing the page.
 *
 * Only GraphQL calls count. X polls its own endpoints for badge counts and
 * notifications the whole time a page is open, so the total number of calls is
 * never still, and waiting for it to be still means scrolling forever.
 */
async function scrollToBottom(page: Page, recorder: Recorder) {
  let idleRounds = 0;
  let rounds = 0;

  while (idleRounds < 4 && rounds < 80) {
    const before = recorder.graphqlCount;
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1800);
    rounds += 1;
    idleRounds = recorder.graphqlCount === before ? idleRounds + 1 : 0;
  }

  return rounds;
}

async function census(page: Page, route: string): Promise<CensusRow[]> {
  const rows: CensusRow[] = [];
  for (const selector of INVENTORY_SELECTORS) {
    let count = 0;
    try {
      count = await page.locator(selector).count();
    } catch {
      count = -1;
    }
    rows.push({ route, selector, count });
  }
  return rows;
}

async function runStep(
  page: Page,
  step: WalkStep,
  recorder: Recorder,
): Promise<CensusRow[]> {
  await page.goto(step.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await assertNotBlocked(page);

  const before = recorder.graphqlCount;
  let rounds = 0;
  if (step.scroll) {
    rounds = await scrollToBottom(page, recorder);
  }

  const pages = recorder.graphqlCount - before;
  console.log(
    `\n✓ ${step.label}: ${pages} GraphQL calls${step.scroll ? `, ${rounds} scrolls` : ""}`,
  );

  return census(page, step.label);
}

async function main() {
  const options = parseArgs(process.argv);
  const stamp = dateStampFrom(new Date());

  const permalinks =
    options.permalinksPath !== null && fs.existsSync(options.permalinksPath)
      ? parsePermalinks(fs.readFileSync(options.permalinksPath, "utf8"))
      : [];
  if (options.permalinksPath !== null && permalinks.length === 0) {
    console.log(
      `No permalinks read from ${options.permalinksPath}; walking timelines only.`,
    );
  }

  const steps = buildReadWalk(options.account, permalinks);
  const harPath = path.join(CAPTURE_DIR, stamp, "raw", `${options.label}.har`);
  const censusPath = path.join(
    CAPTURE_DIR,
    stamp,
    `selector-census-${options.label}.md`,
  );

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

  // A logged-out session answers every timeline query with a 404, which looks
  // from the outside like a walk that simply found nothing.
  if (!(await isLoggedIn(page))) {
    console.log(
      `Not logged in as @${options.account}. Log in first:\n` +
        `  npx tsx scripts/x-capture/seed.ts --account ${options.account} --task login`,
    );
    await context.close().catch(() => {});
    process.exitCode = 2;
    return;
  }

  console.log(`Walking ${steps.length} surfaces as @${options.account}.`);
  console.log(`Recording to ${harPath}\n`);

  const rows: CensusRow[] = [];
  for (const step of steps) {
    try {
      rows.push(...(await runStep(page, step, recorder)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`\n✗ ${step.label}: ${message}`);
      // One surface refusing to load is not a reason to lose the rest.
    }
    recorder.write();
    fs.writeFileSync(censusPath, formatCensus(rows));
    await page.waitForTimeout(3000 + Math.floor(Math.random() * 3000));
  }

  recorder.write();
  fs.writeFileSync(censusPath, formatCensus(rows));
  await context.close().catch(() => {});

  const size = fs.existsSync(harPath) ? fs.statSync(harPath).size : 0;
  console.log(
    `\nWrote ${harPath}: ${recorder.count} calls, ${(size / 1024 / 1024).toFixed(1)} MB`,
  );
  console.log(`Wrote ${censusPath}`);
  console.log(
    `Next: npx tsx scripts/x-capture/decode-har.ts ${harPath} --out ${path.join(CAPTURE_DIR, stamp, "decoded", options.label)}`,
  );
}

main();
