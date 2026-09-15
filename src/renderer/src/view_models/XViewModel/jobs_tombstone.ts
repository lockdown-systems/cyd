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

const BIO_TEXTAREA_SELECTOR = 'div[role="dialog"] textarea';

// Click Save.
//
// The button is never disabled: scripts/x-capture/probe-profile.ts found it
// reads disabled=false with no aria-disabled before any change is made at all.
// So its state says nothing about whether X has taken a change, and the only
// way to know a save landed is to read the profile back.
async function clickSaveProfile(
  vm: XViewModel,
  errorType: AutomationErrorType,
): Promise<boolean> {
  if (!(await vm.scriptClickElement(SAVE_BUTTON_SELECTOR))) {
    vm.log("clickSaveProfile", "failed to click the save button");
    await vm.error(errorType, { reason: "failed to click the save button" });
    return false;
  }

  await vm.waitForLoadingToFinish();
  await vm.sleep(3000);
  return true;
}

/** The banner X serves on the profile, which is the only answer that counts. */
async function readBannerURL(vm: XViewModel): Promise<string> {
  await vm.loadURLWithRateLimit(
    `https://x.com/${vm.account.xAccount?.username ?? ""}`,
  );
  return (
    (await vm.getWebview()?.executeJavaScript(`
        (() => {
            const image = document.querySelector('a[href$="/header_photo"] img');
            return image ? image.src : "";
        })();
    `)) ?? ""
  );
}

/** The bio X serves back into the profile dialog. */
async function readBioText(vm: XViewModel): Promise<string> {
  await vm.loadURLWithRateLimit(PROFILE_SETTINGS_URL);
  await vm.waitForSelector(BIO_TEXTAREA_SELECTOR, PROFILE_SETTINGS_URL);
  return (
    (await vm.getWebview()?.executeJavaScript(`
        (() => {
            const textarea = document.querySelector('${BIO_TEXTAREA_SELECTOR}');
            return textarea ? textarea.value : "";
        })();
    `)) ?? ""
  );
}

// Put the bio in the textarea through React's own value setter.
//
// Cyd used to type it in with sendInputEvent, a key at a time. Electron's
// keyDown and keyUp move focus and press Backspace, which is why the tabbing
// and deleting appeared to work, but they insert no text without a char event,
// so the textarea kept whatever X had put there and the save wrote it straight
// back. Assigning .value instead is no good either: React holds its own copy
// of the value and saves that, not what the DOM shows.
//
// The setter plus an input event is what React listens for, and the probe
// confirmed it survives a reload where a plain assignment does not.
function setBioScript(bioText: string): string {
  return `
        (() => {
            const textarea = document.querySelector('${BIO_TEXTAREA_SELECTOR}');
            if(!textarea) { return false; }
            const setter = Object.getOwnPropertyDescriptor(
                HTMLTextAreaElement.prototype, 'value'
            ).set;
            setter.call(textarea, ${JSON.stringify(bioText)});
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        })();
    `;
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

  const bannerDataURL = vm.account.xAccount?.tombstoneBannerDataURL ?? "";
  if (!bannerDataURL) {
    vm.log("runJobTombstoneUpdateBanner", "no banner image to set");
    await vm.finishJob(jobIndex);
    return true;
  }

  // What X shows now, to compare against once the save has been made
  const bannerBefore = await readBannerURL(vm);

  // Load the profile page
  await vm.loadURLWithRateLimit(PROFILE_SETTINGS_URL);

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
    !(await clickSaveProfile(
      vm,
      AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSave,
    ))
  ) {
    return false;
  }

  // Read the banner back. A save that clicked cleanly and changed nothing is
  // exactly the failure this job kept reporting as success.
  const bannerAfter = await readBannerURL(vm);
  if (bannerAfter === bannerBefore) {
    vm.log("runJobTombstoneUpdateBanner", ["banner unchanged", bannerBefore]);
    await vm.error(
      AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSave,
      { reason: "the banner did not change", bannerBefore, bannerAfter },
    );
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

  let bioText = vm.account.xAccount?.tombstoneUpdateBioText ?? "";
  if (vm.account.xAccount?.tombstoneUpdateBioCreditCyd) {
    bioText = bioText + tombstoneUpdateBioCreditCydText;
  }
  if (bioText.length > 160) {
    bioText = bioText.substring(0, 160);
  }

  // Load the profile page and wait for the bio field
  await vm.loadURLWithRateLimit(PROFILE_SETTINGS_URL);
  await vm.waitForSelector(BIO_TEXTAREA_SELECTOR, PROFILE_SETTINGS_URL);

  const wasSet = await vm
    .getWebview()
    ?.executeJavaScript(setBioScript(bioText));
  if (!wasSet) {
    await vm.error(
      AutomationErrorType.x_runJob_tombstoneUpdateBio_FailedToSave,
      {
        reason: "could not find the bio textarea",
      },
    );
    return false;
  }

  if (
    !(await clickSaveProfile(
      vm,
      AutomationErrorType.x_runJob_tombstoneUpdateBio_FailedToSave,
    ))
  ) {
    return false;
  }

  // Read the bio back, because a save that clicked cleanly and changed nothing
  // is exactly the failure this job kept reporting as success.
  const savedBio = await readBioText(vm);
  if (savedBio !== bioText) {
    vm.log("runJobTombstoneUpdateBio", ["bio unchanged", savedBio]);
    await vm.error(
      AutomationErrorType.x_runJob_tombstoneUpdateBio_FailedToSave,
      {
        reason: "the bio did not change",
        wanted: bioText,
        got: savedBio,
      },
    );
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
