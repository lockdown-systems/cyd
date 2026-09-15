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

// Ways of putting a file on the input, from the one Cyd uses to the one a
// person's own click produces. If only the last works, the fix is not a better
// event — it is delivering the file the way the browser itself does.
const bannerStrategies: {
  name: string;
  note: string;
  apply: (page: Page, bannerPath: string) => Promise<void>;
}[] = [
  {
    name: "cyd-change-event",
    note: "What Cyd does today: build a File, put it on input.files, dispatch change",
    apply: async (page, bannerPath) => {
      const base64 = fs.readFileSync(bannerPath).toString("base64");
      await page.evaluate(
        ({ selector, data }) => {
          const input = document.querySelectorAll(
            selector,
          )[0] as HTMLInputElement;
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
    },
  },
  {
    name: "cyd-input-and-change",
    note: "The same, but dispatching input before change, in case React listens for input",
    apply: async (page, bannerPath) => {
      const base64 = fs.readFileSync(bannerPath).toString("base64");
      await page.evaluate(
        ({ selector, data }) => {
          const input = document.querySelectorAll(
            selector,
          )[0] as HTMLInputElement;
          const binary = atob(data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const file = new File([bytes], "banner.png", { type: "image/png" });
          const transfer = new DataTransfer();
          transfer.items.add(file);
          input.files = transfer.files;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        },
        { selector: SELECTORS.profileFileInput, data: base64 },
      );
    },
  },
  {
    name: "native-set-input-files",
    note: "The browser's own file delivery, the way a person picking a file produces it",
    apply: async (page, bannerPath) => {
      await page.setInputFiles(SELECTORS.profileFileInput, bannerPath);
    },
  },
];

async function probeBanner(
  page: Page,
  log: CallLog,
  options: Options,
): Promise<Attempt[]> {
  const attempts: Attempt[] = [];

  for (const strategy of bannerStrategies) {
    console.log(`\n→ banner: ${strategy.name}`);
    await openProfileDialog(page);
    const saveBefore = await readSaveButton(page);

    try {
      await strategy.apply(page, options.bannerPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  could not apply: ${message}`);
      attempts.push({
        name: strategy.name,
        note: strategy.note,
        saveBefore: describeSaveButton(saveBefore),
        cropAppeared: null,
        saveAfter: `could not apply: ${message}`,
        saveEnabled: false,
        clicked: false,
        calls: [],
        persisted: "not attempted",
      });
      continue;
    }

    // X shows a crop step before it will take the image. No crop step is
    // itself the finding: it means X never noticed the file.
    let cropAppeared = true;
    try {
      await page
        .locator(SELECTORS.profileCropApply)
        .waitFor({ state: "visible", timeout: STEP_TIMEOUT });
      await page.locator(SELECTORS.profileCropApply).click();
      await page.waitForTimeout(1500);
    } catch {
      cropAppeared = false;
    }
    console.log(`  crop step appeared: ${cropAppeared}`);

    const saveAfter = await readSaveButton(page);
    const enabled = isSaveEnabled(saveAfter);
    console.log(`  save button: ${describeSaveButton(saveAfter)}`);

    const from = log.length;
    let clicked = false;
    if (enabled) {
      await page.locator(SELECTORS.profileSaveButton).click();
      await page.waitForTimeout(5000);
      clicked = true;
    }

    const persisted = clicked
      ? await readSavedBannerURL(page, options.account)
      : "not attempted";

    attempts.push({
      name: strategy.name,
      note: strategy.note,
      saveBefore: describeSaveButton(saveBefore),
      cropAppeared,
      saveAfter: describeSaveButton(saveAfter),
      saveEnabled: enabled,
      clicked,
      calls: log.since(from),
      persisted,
    });
  }

  return attempts;
}

// The bio is a controlled textarea, so the question is the same one in a
// different shape: which of these does React's state hear?
const bioStrategies: {
  name: string;
  note: string;
  apply: (page: Page, text: string) => Promise<void>;
}[] = [
  {
    name: "keyboard",
    note: "Real key events, the closest thing to Cyd's sendInputEvent typing",
    apply: async (page, text) => {
      await page.locator(SELECTORS.bioTextarea).click();
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.press("Backspace");
      await page.keyboard.type(text, { delay: 20 });
    },
  },
  {
    name: "native-value-setter",
    note: "React's own value setter plus an input event, the usual way to drive a controlled field",
    apply: async (page, text) => {
      await page.evaluate(
        ({ selector, value }) => {
          const textarea = document.querySelector(
            selector,
          ) as HTMLTextAreaElement;
          const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            "value",
          )?.set;
          setter?.call(textarea, value);
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        },
        { selector: SELECTORS.bioTextarea, value: text },
      );
    },
  },
  {
    name: "plain-value-assignment",
    note: "Assigning .value directly, which React is expected to ignore, kept as the control",
    apply: async (page, text) => {
      await page.evaluate(
        ({ selector, value }) => {
          const textarea = document.querySelector(
            selector,
          ) as HTMLTextAreaElement;
          textarea.value = value;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        },
        { selector: SELECTORS.bioTextarea, value: text },
      );
    },
  },
];

async function probeBio(
  page: Page,
  log: CallLog,
  options: Options,
): Promise<Attempt[]> {
  const attempts: Attempt[] = [];

  for (const strategy of bioStrategies) {
    console.log(`\n→ bio: ${strategy.name}`);
    // A different bio per strategy, so a reload says which one landed.
    const text = `Cyd probe ${strategy.name} ${Date.now()}`;

    await openProfileDialog(page);
    const saveBefore = await readSaveButton(page);

    try {
      await strategy.apply(page, text);
      await page.waitForTimeout(1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  could not apply: ${message}`);
      attempts.push({
        name: strategy.name,
        note: strategy.note,
        saveBefore: describeSaveButton(saveBefore),
        cropAppeared: null,
        saveAfter: `could not apply: ${message}`,
        saveEnabled: false,
        clicked: false,
        calls: [],
        persisted: "not attempted",
      });
      continue;
    }

    const saveAfter = await readSaveButton(page);
    const enabled = isSaveEnabled(saveAfter);
    console.log(`  save button: ${describeSaveButton(saveAfter)}`);

    const from = log.length;
    let clicked = false;
    if (enabled) {
      await page.locator(SELECTORS.profileSaveButton).click();
      await page.waitForTimeout(4000);
      clicked = true;
    }

    const saved = clicked ? await readSavedBio(page) : "";
    const persisted = clicked
      ? saved === text
        ? `yes: ${JSON.stringify(saved)}`
        : `no, X still has ${JSON.stringify(saved)}`
      : "not attempted";
    console.log(`  persisted: ${persisted}`);

    attempts.push({
      name: strategy.name,
      note: strategy.note,
      saveBefore: describeSaveButton(saveBefore),
      cropAppeared: null,
      saveAfter: describeSaveButton(saveAfter),
      saveEnabled: enabled,
      clicked,
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
    if (attempt.calls.length === 0) {
      lines.push("- Requests on save: none");
    } else {
      lines.push("- Requests on save:");
      for (const call of attempt.calls) {
        lines.push(`  - ${call.method} ${call.path} → ${call.status}`);
      }
    }
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
        await probeBio(page, log, options),
      ),
    );
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, sections.join("\n"));
  await context.close().catch(() => {});

  console.log(`\nWrote ${reportPath}`);
}

main();
