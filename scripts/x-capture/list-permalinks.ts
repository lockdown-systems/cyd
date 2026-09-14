/**
 * Reads a seeded account's timeline and prints the permalink of each seeded
 * shape, so the capture walk can open them without hunting for them by hand.
 *
 * Usage:
 *   npx tsx scripts/x-capture/list-permalinks.ts --account <handle>
 *
 * Writes `capture/seed/<handle>/permalinks.md` as a tick-list in walk order.
 * Nothing records permalinks at posting time, so they are recovered from the
 * distinctive text each seeded shape carries.
 */

import fs from "fs";
import path from "path";

import { chromium, type Page } from "playwright-core";

import { SHAPE_MARKERS, shapeLabelFor } from "./lib/seed_plan";
import { SELECTORS } from "./lib/x_page";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const CAPTURE_DIR = "capture";

function parseArgs(argv: string[]): { account: string } {
  const args = argv.slice(2);
  let account = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--account") {
      account = args[++i] ?? "";
    } else {
      throw new Error(`Unknown option: ${args[i]}`);
    }
  }
  if (account === "") {
    throw new Error("Pass --account <handle>.");
  }
  return { account };
}

interface TimelineEntry {
  text: string;
  permalink: string | null;
}

/**
 * Collects each post's text and permalink while scrolling the timeline. The
 * permalink is the timestamp link, which is the only per-post link X renders
 * on every entry.
 */
async function readTimeline(
  page: Page,
  account: string,
): Promise<TimelineEntry[]> {
  await page.goto(`https://x.com/${account}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  const byPermalink = new Map<string, TimelineEntry>();
  let unchangedRounds = 0;

  while (unchangedRounds < 3) {
    const before = byPermalink.size;

    const entries = await page.locator(SELECTORS.post).evaluateAll((nodes) =>
      nodes.map((node) => {
        const link = node.querySelector<HTMLAnchorElement>(
          'a[href*="/status/"]:has(time)',
        );
        return {
          text: (node as HTMLElement).innerText ?? "",
          permalink: link ? link.href : null,
        };
      }),
    );

    for (const entry of entries) {
      if (entry.permalink !== null) {
        byPermalink.set(entry.permalink, entry);
      }
    }

    if (byPermalink.size === before) {
      unchangedRounds += 1;
    } else {
      unchangedRounds = 0;
    }

    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(1500);
  }

  return [...byPermalink.values()];
}

function report(entries: TimelineEntry[]): string {
  const found = new Map<string, string>();
  for (const entry of entries) {
    const label = shapeLabelFor(entry.text);
    if (label !== null && entry.permalink !== null && !found.has(label)) {
      found.set(label, entry.permalink);
    }
  }

  const lines: string[] = ["# Seeded shape permalinks", ""];
  for (const marker of SHAPE_MARKERS) {
    const permalink = found.get(marker.label);
    lines.push(
      permalink
        ? `- [ ] ${marker.label}: ${permalink}`
        : `- [ ] ${marker.label}: **not found on the timeline**`,
    );
  }

  // The orphaned retweet has no text of its own once its original is gone, so
  // it is reported by what X leaves behind rather than by a marker.
  const orphan = entries.find((entry) =>
    /unavailable|was deleted|not available/i.test(entry.text),
  );
  lines.push(
    orphan
      ? `- [ ] Orphaned retweet: ${orphan.permalink}`
      : "- [ ] Orphaned retweet: **nothing left on the timeline** — the retweet did not survive its original being deleted, which is itself worth recording",
  );

  lines.push("");
  lines.push(`Read from ${entries.length} timeline entries.`);
  return lines.join("\n");
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

  const entries = await readTimeline(page, options.account);
  const markdown = report(entries);

  const outPath = path.join(
    CAPTURE_DIR,
    "seed",
    options.account,
    "permalinks.md",
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${markdown}\n`);

  console.log(markdown);
  console.log(`\nWritten to ${outPath}`);

  await context.close();
}

main();
