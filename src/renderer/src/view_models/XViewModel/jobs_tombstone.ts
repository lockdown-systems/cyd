import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { tombstoneUpdateBioCreditCydText } from "./types";

const PROFILE_SETTINGS_URL = "https://x.com/settings/profile";

// X's profile settings dialog carries three file inputs, all matching this.
// The banner is the first of them, the header photo at the top of the dialog,
// so it is reached by position among the matches rather than by the selector.
const FILE_INPUT_SELECTOR = 'input[data-testid="fileInput"]';

// The crop step X shows after a file is chosen
const APPLY_BUTTON_SELECTOR = '[data-testid="applyButton"]';

const SAVE_BUTTON_SELECTOR = 'button[data-testid="Profile_Save_Button"]';

const AUDIENCE_SETTINGS_URL = "https://x.com/settings/audience_and_tagging";

// The "Protect your posts" box is the first checkbox on the audience settings
// page
const PROTECT_POSTS_SELECTOR = 'input[type="checkbox"]';

const CONFIRM_BUTTON_SELECTOR =
  'button[data-testid="confirmationSheetConfirm"]';

// X keeps the profile dialog's Save button disabled until it has taken the
// change, and clicking a disabled button does nothing at all. Clicking it
// blind is how a run can report success having saved nothing, so wait for the
// button to come alive first and treat it never doing so as a failure.
async function saveProfile(
  vm: XViewModel,
  errorType: AutomationErrorType,
): Promise<boolean> {
  const isEnabledScript = `
        (() => {
            const button = document.querySelector('${SAVE_BUTTON_SELECTOR}');
            if(!button) { return false; }
            return !button.disabled && button.getAttribute('aria-disabled') !== 'true';
        })();
    `;

  let isEnabled = false;
  for (let i = 0; i < 30; i++) {
    isEnabled = await vm.getWebview()?.executeJavaScript(isEnabledScript);
    if (isEnabled) {
      break;
    }
    await vm.sleep(200);
  }

  if (!isEnabled) {
    vm.log("saveProfile", "the save button never became clickable");
    await vm.error(errorType, { reason: "save button never became enabled" });
    return false;
  }

  if (!(await vm.scriptClickElement(SAVE_BUTTON_SELECTOR))) {
    vm.log("saveProfile", "failed to click the save button");
    await vm.error(errorType, { reason: "failed to click the save button" });
    return false;
  }

  await vm.waitForLoadingToFinish();
  return true;
}

// Put the banner on the page's first file input, the way a person choosing a
// file would. The input takes a File, not a data URL, so the image is decoded
// in the page and handed over as one.
//
// The decoding is done by hand rather than by fetching the data URL: X's
// content security policy has no data: in connect-src, so fetch() of one is
// blocked, and all the page reports back is "Failed to fetch".
function setBannerScript(bannerDataURL: string): string {
  return `
        (() => {
            const input = document.querySelectorAll('${FILE_INPUT_SELECTOR}')[0];
            if(!input) { return false; }
            const base64 = '${bannerDataURL}'.split(',')[1];
            if(!base64) { return false; }
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for(let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            const file = new File([bytes], 'banner.png', { type: 'image/png' });
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        })();
    `;
}

export async function runJobTombstoneUpdateBanner(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_TOMBSTONE_UPDATE_BANNER,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = vm.t("viewModels.x.jobs.tombstone.updateBanner");
  vm.showAutomationNotice = true;

  // Load the profile page
  await vm.loadURLWithRateLimit(PROFILE_SETTINGS_URL);

  const bannerDataURL = vm.account.xAccount?.tombstoneBannerDataURL ?? "";
  if (!bannerDataURL) {
    vm.log("runJobTombstoneUpdateBanner", "no banner image to set");
    await vm.finishJob(jobIndex);
    return true;
  }

  // Wait for the file input, and set the banner on it
  await vm.waitForSelector(FILE_INPUT_SELECTOR, PROFILE_SETTINGS_URL);
  const wasSet = await vm
    .getWebview()
    ?.executeJavaScript(setBannerScript(bannerDataURL));
  if (!wasSet) {
    await vm.error(
      AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSetBanner,
      {},
    );
    return false;
  }

  // Confirm the crop X offers, then save. Both clicks go through the element's
  // own click(), because the dialog keeps a mask that swallows pointer events.
  await vm.waitForSelector(APPLY_BUTTON_SELECTOR, PROFILE_SETTINGS_URL);
  if (!(await vm.scriptClickElement(APPLY_BUTTON_SELECTOR))) {
    await vm.error(
      AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSave,
      { reason: "failed to click the crop's apply button" },
    );
    return false;
  }

  if (
    !(await saveProfile(
      vm,
      AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSave,
    ))
  ) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobTombstoneUpdateBio(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_TOMBSTONE_UPDATE_BIO,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = vm.t("viewModels.x.jobs.tombstone.updateBio");
  vm.showAutomationNotice = true;

  // When submitting the profile form, it doesn't seem to get the bio text value from
  // the <textarea>, so we need to instead inject input events into the webview.

  // Load the profile page
  await vm.loadURLWithRateLimit(PROFILE_SETTINGS_URL);

  // Wait for bio field to appear
  await vm.waitForSelector('div[role="dialog"] textarea', PROFILE_SETTINGS_URL);
  await vm.sleep(200);

  // Click in the modal
  await vm.scriptClickElement('div[role="group"][tabindex="0"]');

  // Press until the bio field is selected
  vm.log("runJobTombstoneUpdateBio", "pressing tab to select bio field");
  let selected = false;
  for (let i = 0; i < 50; i++) {
    // Press tab
    await vm.getWebview()?.sendInputEvent({
      type: "keyDown",
      keyCode: "Tab",
    });
    await vm.sleep(10);
    await vm.getWebview()?.sendInputEvent({
      type: "keyUp",
      keyCode: "Tab",
    });
    await vm.sleep(10);

    // Check if the textarea is selected
    const tagName = await vm
      .getWebview()
      ?.executeJavaScript(`document.activeElement.tagName`);
    if (tagName == "TEXTAREA") {
      vm.log("runJobTombstoneUpdateBio", "bio textarea selected");
      selected = true;
      break;
    }
  }
  if (!selected) {
    // TODO: error
    console.error("runJobTombstoneUpdateBio", "bio textarea not found");
  }

  // Select and delete the existing bio
  vm.log("runJobTombstoneUpdateBio", "select and delete the existing bio");
  await vm.getWebview()?.executeJavaScript(`document.activeElement.click()`);
  await vm.getWebview()?.sendInputEvent({
    type: "keyDown",
    keyCode: "CommandOrControl+A",
  });
  await vm.sleep(10);
  await vm.getWebview()?.sendInputEvent({
    type: "keyUp",
    keyCode: "CommandOrControl+A",
  });
  await vm.sleep(10);
  await vm.getWebview()?.sendInputEvent({
    type: "keyDown",
    keyCode: "Backspace",
  });
  await vm.sleep(10);
  await vm.getWebview()?.sendInputEvent({
    type: "keyUp",
    keyCode: "Backspace",
  });
  await vm.sleep(10);

  // Type the new bio character by character
  let bioText = vm.account.xAccount?.tombstoneUpdateBioText ?? "";
  if (vm.account.xAccount?.tombstoneUpdateBioCreditCyd) {
    bioText = bioText + tombstoneUpdateBioCreditCydText;
  }
  if (bioText.length > 160) {
    bioText = bioText.substring(0, 160);
  }

  function getKeyEventForChar(char: string): { keyCode: string } {
    // Lowercase letters
    if (char >= "a" && char <= "z") {
      return { keyCode: char.toUpperCase() }; // 'A' for 'a'
    }
    // Uppercase letters
    if (char >= "A" && char <= "Z") {
      return { keyCode: `Shift+${char}` }; // 'Shift+A' for 'A'
    }
    // Numbers
    if (char >= "0" && char <= "9") {
      return { keyCode: char };
    }
    // Space
    if (char === " ") return { keyCode: "Space" };

    // Shifted symbols
    const shiftSymbols: Record<string, string> = {
      "!": "Shift+1",
      "@": "Shift+2",
      "#": "Shift+3",
      $: "Shift+4",
      "%": "Shift+5",
      "^": "Shift+6",
      "&": "Shift+7",
      "*": "Shift+8",
      "(": "Shift+9",
      ")": "Shift+0",
      _: "Shift+-",
      "+": "Shift+=",
      ":": "Shift+;",
      '"': "Shift+'",
      "<": "Shift+,",
      ">": "Shift+.",
      "?": "Shift+/",
      "|": "Shift+\\",
      "~": "Shift+`",
      "{": "Shift+[",
      "}": "Shift+]",
    };
    if (char in shiftSymbols) {
      return { keyCode: shiftSymbols[char] };
    }

    // Direct mapping for some symbols (no shift)
    const directMap: Record<string, string> = {
      "-": "-",
      "=": "=",
      "[": "[",
      "]": "]",
      "\\": "\\",
      ";": ";",
      "'": "'",
      ",": ",",
      ".": ".",
      "/": "/",
      "`": "`",
    };
    if (char in directMap) {
      return { keyCode: directMap[char] };
    }

    // Fallback
    return { keyCode: char };
  }

  for (const char of bioText) {
    vm.log("runJobTombstoneUpdateBio", ["typing char", char]);
    const { keyCode } = getKeyEventForChar(char);
    const webview = vm.getWebview();
    await webview?.sendInputEvent({ type: "keyDown", keyCode });
    await vm.sleep(10);
    await webview?.sendInputEvent({ type: "keyUp", keyCode });
    await vm.sleep(10);
  }

  if (
    !(await saveProfile(
      vm,
      AutomationErrorType.x_runJob_tombstoneUpdateBio_FailedToSave,
    ))
  ) {
    return false;
  }

  await vm.finishJob(jobIndex);
  return true;
}

export async function runJobTombstoneLockAccount(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_TOMBSTONE_LOCK_ACCOUNT,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = vm.t("viewModels.x.jobs.tombstone.lockAccount");
  vm.showAutomationNotice = true;

  // Load the audience, media and tagging settings page
  await vm.loadURLWithRateLimit(AUDIENCE_SETTINGS_URL);

  // X renders the settings after the page loads, so wait for the checkbox
  // rather than reaching into a list that is still empty
  await vm.waitForSelector(PROTECT_POSTS_SELECTOR, AUDIENCE_SETTINGS_URL);

  // Is the "Protect your posts" box already checked?
  const isLocked = await vm.getWebview()?.executeJavaScript(`
        (() => {
            const box = document.querySelectorAll('${PROTECT_POSTS_SELECTOR}')[0];
            return box ? box.checked : false;
        })();
    `);

  if (isLocked) {
    vm.log("runJobTombstoneLockAccount", "account is already locked");
    await vm.finishJob(jobIndex);
    return true;
  }

  // Check the "Protect your posts" box
  vm.log("runJobTombstoneLockAccount", "checking the account lock checkbox");
  const wasClicked = await vm.getWebview()?.executeJavaScript(`
        (() => {
            const box = document.querySelectorAll('${PROTECT_POSTS_SELECTOR}')[0];
            if(!box) { return false; }
            box.click();
            return true;
        })();
    `);
  if (!wasClicked) {
    await vm.error(
      AutomationErrorType.x_runJob_tombstoneLockAccount_FailedToLock,
      { reason: "failed to click the protect your posts checkbox" },
    );
    return false;
  }

  await vm.waitForSelector(CONFIRM_BUTTON_SELECTOR, AUDIENCE_SETTINGS_URL);
  if (!(await vm.scriptClickElement(CONFIRM_BUTTON_SELECTOR))) {
    await vm.error(
      AutomationErrorType.x_runJob_tombstoneLockAccount_FailedToLock,
      { reason: "failed to click the confirm button" },
    );
    return false;
  }
  await vm.waitForLoadingToFinish();

  await vm.finishJob(jobIndex);
  return true;
}
