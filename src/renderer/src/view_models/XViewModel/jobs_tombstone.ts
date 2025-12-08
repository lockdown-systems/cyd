import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { tombstoneUpdateBioCreditCydText } from "./types";

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
  await vm.loadURLWithRateLimit("https://x.com/settings/profile");

  // TODO: implement
  await vm.sleep(2000);

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
  await vm.loadURLWithRateLimit("https://x.com/settings/profile");

  // Wait for bio field to appear
  await vm.waitForSelector(
    'div[role="dialog"] textarea',
    "https://x.com/settings/profile",
  );
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

  vm.pause();
  await vm.waitForPause();

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

  vm.pause();
  await vm.waitForPause();

  // Click save
  await vm.scriptClickElement('button[data-testid="Profile_Save_Button"]');
  await vm.sleep(200);
  await vm.waitForLoadingToFinish();

  vm.pause();
  await vm.waitForPause();

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
  await vm.loadURLWithRateLimit("https://x.com/settings/audience_and_tagging");

  // Is the "Protect your tweets" box already checked?
  if (
    await vm.getWebview()
      ?.executeJavaScript(`document.querySelectorAll('input[type="checkbox"]')[0].checked
`)
  ) {
    vm.log("runJobTombstoneLockAccount", "account is already locked");
  }
  // Check the "Protect your tweets" box
  else {
    vm.log("runJobTombstoneLockAccount", "checking the account lock checkbox");
    await vm
      .getWebview()
      ?.executeJavaScript(
        `document.querySelectorAll('input[type="checkbox"]')[0].click()`,
      );
    await vm.sleep(200);
    await vm.waitForSelector(
      'button[data-testid="confirmationSheetConfirm"]',
      "https://x.com/settings/audience_and_tagging",
    );
    await vm.sleep(200);
    await vm.scriptClickElement(
      'button[data-testid="confirmationSheetConfirm"]',
    );
    await vm.sleep(200);
    await vm.waitForLoadingToFinish();
  }

  await vm.finishJob(jobIndex);
  return true;
}
