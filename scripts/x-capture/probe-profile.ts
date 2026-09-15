/**
 * Establishes how X's "Edit profile" dialog takes a change, and which way of
 * making that change it actually notices.
 *
 * Cyd's tombstone jobs put a banner on the dialog's file input and type a bio
 * into its textarea, then click Save. Both reported success and saved nothing,
 * which is the shape of a change X's own code never saw: the DOM holds the new
 * value, React's state does not, and Save stays inert.
 *
 * So this probe does not assume a cause. It tries each plausible way of
 * delivering the change, and after each one records the only signals that
 * settle the question:
 *
 *   - whether the Save button came out of its disabled state,
 *   - which requests X made when Save was clicked, and what they returned,
 *   - whether the value survived a reload.
 *
 * The last one is the ground truth. A Save button that enables and a request
 * that returns 200 still prove nothing if the profile comes back unchanged.
 *
 * Usage:
 *   npx tsx scripts/x-capture/probe-profile.ts --account <handle>
 *     [--banner capture/seed-media/image-1.png] [--only banner|bio]
 *
 * This writes to the account: it changes the bio, and the banner. Run it on a
 * test account, never a real one.
 */

import fs from "fs";
import path from "path";

import { chromium, type Page } from "playwright-core";

import { dateStampFrom } from "./lib/har";
import { assertNotBlocked, isLoggedIn, SELECTORS } from "./lib/x_page";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH ?? "/usr/bin/chromium";
const CAPTURE_DIR = "capture";

const PROFILE_SETTINGS_URL = "https://x.com/settings/profile";

/** Long enough for X to open the crop step, short enough to fail a run fast. */
const STEP_TIMEOUT = 8000;

interface Options {
  account: string;
  bannerPath: string;
  only: "banner" | "bio" | "all";
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  const options: Options = {
    account: "",
    bannerPath: path.join(CAPTURE_DIR, "seed-media", "image-1.png"),
    only: "all",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--account":
        options.account = args[++i] ?? "";
        break;
      case "--banner":
        options.bannerPath = args[++i] ?? options.bannerPath;
        break;
      case "--only": {
        const value = args[++i] ?? "";
        if (value !== "banner" && value !== "bio") {
          throw new Error("--only takes banner or bio.");
        }
        options.only = value;
        break;
      }
      default:
        throw new Error(`Unknown option: ${args[i]}`);
    }
  }

  if (options.account === "") {
    throw new Error("Pass --account <handle>.");
  }

  return options;
}

/** One request X made, kept for the report rather than for a fixture. */
interface Call {
  method: string;
  path: string;
  status: number;
}

/**
 * Every request the page makes to X, not just the ones the HAR tooling keeps.
 * A banner goes up through upload.twitter.com, which is not an X API host and
 * so never reaches a HAR — and it is the single call most worth seeing here.
 */
class CallLog {
  private calls: Call[] = [];

  attach(page: Page) {
    page.on("response", (response) => {
      let url: URL;
      try {
        url = new URL(response.url());
      } catch {
        return;
      }
      if (!/(^|\.)(x|twitter)\.com$/.test(url.hostname)) {
        return;
      }
      if (!/\/(graphql|i\/api|1\.1|2|i\/media)\//.test(url.pathname)) {
        return;
      }
      this.calls.push({
        method: response.request().method(),
        path: `${url.hostname}${url.pathname}`,
        status: response.status(),
      });
    });
  }

  get length(): number {
    return this.calls.length;
  }

  since(from: number): Call[] {
    return this.calls.slice(from);
  }
}

interface SaveButtonState {
  present: boolean;
  disabled: boolean | null;
  ariaDisabled: string | null;
  text: string;
}

async function readSaveButton(page: Page): Promise<SaveButtonState> {
  return page.evaluate((selector) => {
    const button = document.querySelector(selector);
    if (button === null) {
      return { present: false, disabled: null, ariaDisabled: null, text: "" };
    }
    return {
      present: true,
      disabled: (button as HTMLButtonElement).disabled ?? null,
      ariaDisabled: button.getAttribute("aria-disabled"),
      text: button.textContent?.trim() ?? "",
    };
  }, SELECTORS.profileSaveButton);
}

function isSaveEnabled(state: SaveButtonState): boolean {
  return state.present && !state.disabled && state.ariaDisabled !== "true";
}

function describeSaveButton(state: SaveButtonState): string {
  if (!state.present) {
    return "absent";
  }
  return `present, disabled=${state.disabled}, aria-disabled=${state.ariaDisabled ?? "unset"}, text=${JSON.stringify(state.text)}`;
}

/**
 * What the dialog is made of right now. Cyd reaches the banner input by
 * position among identical test identifiers, so how many there are, and in
 * what order, is a fact worth having rather than assuming.
 */
async function inventory(page: Page) {
  return page.evaluate(() => {
    const fileInputs = [...document.querySelectorAll('input[type="file"]')].map(
      (element, index) => ({
        index,
        testid: element.getAttribute("data-testid"),
        accept: element.getAttribute("accept"),
        name: element.getAttribute("name"),
        rendered: (element as HTMLElement).offsetParent !== null,
      }),
    );

    const dialog = document.querySelector('div[role="dialog"]');
    const testids =
      dialog === null
        ? []
        : [
            ...new Set(
              [...dialog.querySelectorAll("[data-testid]")].map((element) =>
                element.getAttribute("data-testid"),
              ),
            ),
          ];

    const textarea = document.querySelector(
      'div[role="dialog"] textarea',
    ) as HTMLTextAreaElement | null;

    return {
      fileInputs,
      dialogTestIds: testids,
      textarea:
        textarea === null
          ? null
          : {
              name: textarea.getAttribute("name"),
              maxLength: textarea.getAttribute("maxlength"),
              value: textarea.value,
            },
    };
  });
}

async function openProfileDialog(page: Page) {
  await page.goto(PROFILE_SETTINGS_URL, { waitUntil: "domcontentloaded" });
  await assertNotBlocked(page);
  await page
    .locator(SELECTORS.profileSaveButton)
    .waitFor({ state: "attached", timeout: STEP_TIMEOUT });
  await page.waitForTimeout(1000);
}

/** The bio as X serves it back, which is the only answer that counts. */
async function readSavedBio(page: Page): Promise<string> {
  await openProfileDialog(page);
  return page.evaluate(() => {
    const textarea = document.querySelector(
      'div[role="dialog"] textarea',
    ) as HTMLTextAreaElement | null;
    return textarea === null ? "" : textarea.value;
  });
}

/** The banner as X serves it back, by the URL it hands the profile page. */
async function readSavedBannerURL(
  page: Page,
  account: string,
): Promise<string> {
  await page.goto(`https://x.com/${account}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);
  return page.evaluate(() => {
    const image = document.querySelector(
      'a[href$="/header_photo"] img',
    ) as HTMLImageElement | null;
    return image === null ? "" : image.src;
  });
}

interface Attempt {
  name: string;
  note: string;
  saveBefore: string;
  cropAppeared: boolean | null;
  saveAfter: string;
  saveEnabled: boolean;
  clicked: boolean;
  calls: Call[];
  persisted: string;
}

// Round one settled the deliveries: Cyd's own, the same plus an input event,
// and the browser's own all put the banner on the account. So the file is not
// the problem, and what is left is how Cyd presses the buttons afterwards.
//
// Two things separate Cyd from the run that worked. Cyd clicks through the
// element's own click() rather than a real mouse press, and it clicks Save a
// quarter of a second after Apply rather than a second and a half. Vary one at
// a time and the failure names itself.
interface BannerCase {
  name: string;
  note: string;
  click: "script" | "real";
  settleMs: number;
}

const bannerCases: BannerCase[] = [
  {
    name: "cyd-exact",
    note: "Cyd's sequence: element.click() on Apply and Save, a quarter second apart",
    click: "script",
    settleMs: 250,
  },
  {
    name: "cyd-clicks-settled",
    note: "The same clicks, three seconds apart, to separate the click from the wait",
    click: "script",
    settleMs: 3000,
  },
  {
    name: "real-clicks-hurried",
    note: "Real mouse presses a quarter second apart, the other half of the pair",
    click: "real",
    settleMs: 250,
  },
];

/** Cyd reaches into the page to click; a person presses the mouse. */
async function clickAs(page: Page, how: "script" | "real", selector: string) {
  if (how === "real") {
    await page.locator(selector).click();
    return;
  }
  await page.evaluate((target) => {
    const element = document.querySelector(target) as HTMLElement | null;
    element?.click();
  }, selector);
}

async function deliverBanner(page: Page, bannerPath: string) {
  const base64 = fs.readFileSync(bannerPath).toString("base64");
  await page.evaluate(
    ({ selector, data }) => {
      const input = document.querySelectorAll(selector)[0] as HTMLInputElement;
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], "banner.png", { type: "image/png" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector: SELECTORS.profileFileInput, data: base64 },
  );
}

async function probeBanner(
  page: Page,
  log: CallLog,
  options: Options,
): Promise<Attempt[]> {
  const attempts: Attempt[] = [];

  for (const bannerCase of bannerCases) {
    console.log(`\n→ banner: ${bannerCase.name}`);
    await openProfileDialog(page);
    const saveBefore = await readSaveButton(page);
    const before = await readSavedBannerURL(page, options.account);
    await openProfileDialog(page);

    await deliverBanner(page, options.bannerPath);

    // No crop step means X never noticed the file at all.
    let cropAppeared = true;
    try {
      await page
        .locator(SELECTORS.profileCropApply)
        .waitFor({ state: "visible", timeout: STEP_TIMEOUT });
      await clickAs(page, bannerCase.click, SELECTORS.profileCropApply);
    } catch {
      cropAppeared = false;
    }
    console.log(`  crop step appeared: ${cropAppeared}`);

    await page.waitForTimeout(bannerCase.settleMs);
    const saveAfter = await readSaveButton(page);

    const from = log.length;
    await clickAs(page, bannerCase.click, SELECTORS.profileSaveButton);
    await page.waitForTimeout(6000);

    const after = await readSavedBannerURL(page, options.account);
    const persisted =
      after === ""
        ? "could not read the banner back"
        : after === before
          ? `no, still ${before}`
          : `yes, now ${after}`;
    console.log(`  persisted: ${persisted}`);

    attempts.push({
      name: bannerCase.name,
      note: bannerCase.note,
      saveBefore: describeSaveButton(saveBefore),
      cropAppeared,
      saveAfter: describeSaveButton(saveAfter),
      saveEnabled: isSaveEnabled(saveAfter),
      clicked: true,
      calls: log.since(from),
      persisted,
    });
  }

  return attempts;
}

// Round one settled the typing too: real key events put the bio on the
// account. What is left is how Cyd reaches the textarea — it tabs towards it
// rather than clicking it — and how it presses Save.
interface BioCase {
  name: string;
  note: string;
  focus: "tab" | "click";
  click: "script" | "real";
}

const bioCases: BioCase[] = [
  {
    name: "cyd-exact",
    note: "Cyd's sequence: tab until a textarea has focus, type, then element.click() on Save",
    focus: "tab",
    click: "script",
  },
  {
    name: "tab-real-save-click",
    note: "The same focus, a real mouse press on Save",
    focus: "tab",
    click: "real",
  },
  {
    name: "click-script-save-click",
    note: "Click the textarea instead of tabbing to it, then element.click() on Save",
    focus: "click",
    click: "script",
  },
];

/**
 * Cyd does not click the bio field. It clicks the dialog and presses Tab until
 * something that is a textarea has focus, so whether that lands on the bio, or
 * on some other textarea, is worth knowing.
 */
async function focusBio(page: Page, how: "tab" | "click"): Promise<string> {
  if (how === "click") {
    await page.locator(SELECTORS.bioTextarea).click();
    return "clicked the textarea";
  }

  await page.evaluate(() => {
    const group = document.querySelector(
      'div[role="group"][tabindex="0"]',
    ) as HTMLElement | null;
    group?.click();
  });

  for (let i = 0; i < 50; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? "",
      name: document.activeElement?.getAttribute("name") ?? "",
    }));
    if (focused.tag === "TEXTAREA") {
      return `tabbed ${i + 1} times onto ${focused.tag}[name=${focused.name || "unset"}]`;
    }
  }
  return "tabbed 50 times without reaching a textarea";
}

async function probeBio(page: Page, log: CallLog): Promise<Attempt[]> {
  const attempts: Attempt[] = [];

  for (const bioCase of bioCases) {
    console.log(`\n→ bio: ${bioCase.name}`);
    const text = `Cyd probe ${bioCase.name} ${Date.now()}`;

    await openProfileDialog(page);
    const saveBefore = await readSaveButton(page);

    const focusNote = await focusBio(page, bioCase.focus);
    console.log(`  focus: ${focusNote}`);

    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(text, { delay: 20 });
    await page.waitForTimeout(500);

    const saveAfter = await readSaveButton(page);

    const from = log.length;
    await clickAs(page, bioCase.click, SELECTORS.profileSaveButton);
    await page.waitForTimeout(4000);

    const saved = await readSavedBio(page);
    const persisted =
      saved === text
        ? `yes: ${JSON.stringify(saved)}`
        : `no, X still has ${JSON.stringify(saved)}`;
    console.log(`  persisted: ${persisted}`);

    attempts.push({
      name: bioCase.name,
      note: `${bioCase.note} — ${focusNote}`,
      saveBefore: describeSaveButton(saveBefore),
      cropAppeared: null,
      saveAfter: describeSaveButton(saveAfter),
      saveEnabled: isSaveEnabled(saveAfter),
      clicked: true,
      calls: log.since(from),
      persisted,
    });
  }

  return attempts;
}

function formatAttempts(title: string, attempts: Attempt[]): string {
  const lines = [`## ${title}`, ""];

  for (const attempt of attempts) {
    lines.push(`### ${attempt.name}`, "", attempt.note, "");
    lines.push(`- Save button before: ${attempt.saveBefore}`);
    if (attempt.cropAppeared !== null) {
      lines.push(`- Crop step appeared: ${attempt.cropAppeared}`);
    }
    lines.push(`- Save button after: ${attempt.saveAfter}`);
    lines.push(`- Save clickable: ${attempt.saveEnabled}`);
    lines.push(`- Save clicked: ${attempt.clicked}`);
    lines.push(`- Survived a reload: ${attempt.persisted}`);
    // The two calls that say whether X took the change, rather than the
    // hundred it makes either way.
    const decisive = attempt.calls.filter((call) =>
      /update_profile(_banner)?\.json|i\/media\/upload/.test(call.path),
    );
    if (decisive.length === 0) {
      lines.push("- Calls that carry the change: none");
    } else {
      lines.push("- Calls that carry the change:");
      for (const call of decisive) {
        lines.push(`  - ${call.method} ${call.path} → ${call.status}`);
      }
    }
    lines.push(
      `- Other requests on save: ${attempt.calls.length - decisive.length}`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv);
  const stamp = dateStampFrom(new Date());
  const reportPath = path.join(CAPTURE_DIR, stamp, "profile-probe.md");

  if (options.only !== "bio" && !fs.existsSync(options.bannerPath)) {
    throw new Error(
      `No banner image at ${options.bannerPath}. Make one with ./scripts/x-capture/make-media.sh, or pass --banner.`,
    );
  }

  const context = await chromium.launchPersistentContext(
    path.join(CAPTURE_DIR, "profiles", options.account),
    {
      executablePath: CHROMIUM_PATH,
      headless: false,
      viewport: null,
      args: ["--disable-blink-features=AutomationControlled"],
    },
  );

  const page = context.pages()[0] ?? (await context.newPage());
  const log = new CallLog();
  log.attach(page);

  if (!(await isLoggedIn(page))) {
    console.log(
      `Not logged in as @${options.account}. Log in first:\n` +
        `  npx tsx scripts/x-capture/seed.ts --account ${options.account} --task login`,
    );
    await context.close().catch(() => {});
    process.exitCode = 2;
    return;
  }

  console.log(`Probing the profile dialog as @${options.account}.`);
  console.log("This changes the account's bio and banner.\n");

  await openProfileDialog(page);
  const dialog = await inventory(page);
  console.log(`File inputs in the dialog: ${dialog.fileInputs.length}`);

  const sections = [
    `# Profile dialog probe, @${options.account}`,
    "",
    `Run ${new Date().toISOString()} against ${PROFILE_SETTINGS_URL}.`,
    "",
    "## What the dialog is made of",
    "",
    "```json",
    JSON.stringify(dialog, null, 2),
    "```",
    "",
  ];

  if (options.only !== "bio") {
    sections.push(
      formatAttempts(
        "Putting a banner on the file input",
        await probeBanner(page, log, options),
      ),
    );
  }
  if (options.only !== "banner") {
    sections.push(
      formatAttempts(
        "Typing a bio into the textarea",
        await probeBio(page, log),
      ),
    );
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, sections.join("\n"));
  await context.close().catch(() => {});

  console.log(`\nWrote ${reportPath}`);
}

main();
