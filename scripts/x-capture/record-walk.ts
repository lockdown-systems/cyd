/**
 * Records a capture walk as a HAR, while a person drives the browser.
 *
 * The walk itself cannot be automated — X's anti-automation measures see to
 * that — but recording it can be. This opens the account's browser profile,
 * hands it over, and writes what X's API returns. Nothing is clicked for you.
 *
 * Usage:
 *   npx tsx scripts/x-capture/record-walk.ts --account <handle> --label 01-read-main
 *
 * Responses are captured as they arrive and the file is rewritten as it goes,
 * rather than at the end. Playwright's own `recordHar` writes only when the
 * context closes, and writes nothing at all if the browser window is closed
 * first — which loses an entire walk to a misplaced click.
 */

import fs from "fs";
import path from "path";
import readline from "readline";

import { chromium } from "playwright-core";

import { dateStampFrom } from "./lib/har";
import { attachToPages, FLUSH_EVERY, Recorder } from "./lib/recorder";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const CAPTURE_DIR = "capture";

interface Options {
  account: string;
  label: string;
  startURL: string | null;
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const options: Options = { account: "", label: "", startURL: null };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--account":
        options.account = args[++i] ?? "";
        break;
      case "--label":
        options.label = args[++i] ?? "";
        break;
      case "--start":
        options.startURL = args[++i] ?? null;
        break;
      default:
        throw new Error(`Unknown option: ${args[i]}`);
    }
  }

  if (options.account === "" || options.label === "") {
    throw new Error(
      "Usage: npx tsx scripts/x-capture/record-walk.ts --account <handle> --label <name> [--start URL]",
    );
  }

  return options;
}

function ask(question: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const options = parseArgs(process.argv);
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

  // Closing the browser is a normal way to finish, not a way to lose the walk.
  let browserClosed = false;
  context.on("close", () => {
    browserClosed = true;
    recorder.write();
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(options.startURL ?? `https://x.com/${options.account}`, {
    waitUntil: "domcontentloaded",
  });

  console.log(`\nRecording X API traffic to ${harPath}`);
  console.log("The browser is yours. Walk the steps, then come back here.");
  console.log(
    `The file is rewritten every ${FLUSH_EVERY} calls, so closing the browser does not lose it.\n`,
  );

  await ask("Press Enter when the walk is done: ");

  recorder.write();
  if (!browserClosed) {
    await context.close().catch(() => {});
  }

  const size = fs.existsSync(harPath) ? fs.statSync(harPath).size : 0;
  console.log(
    `\nWrote ${harPath}: ${recorder.count} calls, ${(size / 1024 / 1024).toFixed(1)} MB`,
  );
  if (recorder.count === 0) {
    console.log(
      "No X API calls were seen. Was anything loaded in the browser?",
    );
  }
  console.log(
    `Next: npx tsx scripts/x-capture/decode-har.ts ${harPath} --out ${path.join(CAPTURE_DIR, stamp, "decoded", options.label)}`,
  );
}

main();
