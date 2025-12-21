import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";

const FACEBOOK_PROFILE_URL = "https://www.facebook.com/me/";
const FACEBOOK_LANGUAGE_SETTINGS_URL =
  "https://www.facebook.com/settings/?tab=language";

// XPaths for language settings
const XPATH_ACCOUNT_LANGUAGE_BUTTON =
  "/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div[2]/div/div/div/div/div/div/div/div/div/div/div[1]/div/div[2]/div/div/div/div/div/div";
const XPATH_LANGUAGE_DIALOG =
  "/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div";
const XPATH_LANGUAGE_LIST =
  "/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]";
const XPATH_LANGUAGE_SEARCH_INPUT =
  "/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[1]/div/label/input";

const DEFAULT_LANGUAGE = "English (US)";

/**
 * Helper to click element by XPath
 */
async function clickElementByXPath(
  vm: FacebookViewModel,
  xpath: string,
): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  return await webview.executeJavaScript(`
    (() => {
      const result = document.evaluate(
        '${xpath}',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      const element = result.singleNodeValue;
      if (element) {
        element.click();
        return true;
      }
      return false;
    })()
  `);
}

/**
 * Helper to wait for language dialog to appear
 */
async function waitForLanguageDialog(vm: FacebookViewModel): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  // Wait up to 10 seconds for dialog to appear
  for (let i = 0; i < 20; i++) {
    try {
      const dialogExists = await webview.executeJavaScript(`
        (() => {
          const result = document.evaluate(
            '${XPATH_LANGUAGE_DIALOG}',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          const element = result.singleNodeValue;
          return element && element.getAttribute('role') === 'dialog';
        })()
      `);

      if (dialogExists) {
        // Give it a moment for content to load
        await vm.sleep(500);
        return true;
      }
    } catch (error) {
      vm.log("waitForLanguageDialog", `Error checking dialog: ${error}`);
    }
    await vm.sleep(500);
  }
  return false;
}

/**
 * Find the currently selected language from the dialog
 */
async function findCurrentLanguage(vm: FacebookViewModel): Promise<string> {
  const webview = vm.getWebview();
  if (!webview) return DEFAULT_LANGUAGE;

  try {
    const language = await webview.executeJavaScript(`
      (() => {
        const result = document.evaluate(
          '${XPATH_LANGUAGE_LIST}',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const languageList = result.singleNodeValue;
        if (!languageList) return null;

      // Loop through child divs looking for the active language
      const children = languageList.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName !== 'DIV') continue;

        // Check if this child has a div with aria-checked="true" and role="radio"
        const radioDiv = child.querySelector('div[aria-checked="true"][role="radio"]');
        if (radioDiv) {
          // Find the first span element to get the language text
          const span = child.querySelector('span');
          if (span) {
            return span.textContent;
          }
        }
      }
      return null;
    })()
  `);

    return language || DEFAULT_LANGUAGE;
  } catch (error) {
    vm.log("findCurrentLanguage", `Error finding language: ${error}`);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Select a language by searching and clicking
 */
async function selectLanguage(
  vm: FacebookViewModel,
  language: string,
): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  // Click the search input
  const clickedInput = await clickElementByXPath(
    vm,
    XPATH_LANGUAGE_SEARCH_INPUT,
  );
  if (!clickedInput) {
    vm.log("selectLanguage", "Failed to click search input");
    return false;
  }

  await vm.sleep(300);

  // Type the search query (use first part of language name for search)
  // For "English (US)", search for "English US"
  const searchQuery = language.replace(/[()]/g, "");
  try {
    await webview.executeJavaScript(`
      (() => {
        const result = document.evaluate(
          '${XPATH_LANGUAGE_SEARCH_INPUT}',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const input = result.singleNodeValue;
        if (input) {
          input.value = '${searchQuery}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
  } catch (error) {
    vm.log("selectLanguage", `Error setting input value: ${error}`);
    return false;
  }

  // Wait for search results to filter
  await vm.sleep(1000);

  // Find and click the first radio button in the language list
  try {
    const clicked = await webview.executeJavaScript(`
      (() => {
        const result = document.evaluate(
          '${XPATH_LANGUAGE_LIST}',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const languageList = result.singleNodeValue;
        if (!languageList) return false;

        // Loop through child divs looking for language fields
        const children = languageList.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.tagName !== 'DIV') continue;

          // Check if this child has a div with role="radio"
          const radioDiv = child.querySelector('div[role="radio"]');
          if (radioDiv) {
            radioDiv.click();
            return true;
          }
        }
        return false;
      })()
    `);

    return clicked;
  } catch (error) {
    vm.log("selectLanguage", `Error clicking radio button: ${error}`);
    return false;
  }
}

/**
 * Open the language settings page and click the account language button
 */
async function openLanguageDialog(vm: FacebookViewModel): Promise<boolean> {
  // Load the language settings page
  await vm.loadURL(FACEBOOK_LANGUAGE_SETTINGS_URL);
  await vm.waitForLoadingToFinish();
  await vm.sleep(1000);

  // Click the account language button
  const clicked = await clickElementByXPath(vm, XPATH_ACCOUNT_LANGUAGE_BUTTON);
  if (!clicked) {
    vm.log("openLanguageDialog", "Failed to click account language button");
    return false;
  }

  // Wait for dialog to appear
  const dialogAppeared = await waitForLanguageDialog(vm);
  if (!dialogAppeared) {
    vm.log("openLanguageDialog", "Language dialog did not appear");
    return false;
  }

  return true;
}

/**
 * Save the user's current language setting
 */
export async function runJobSaveUserLang(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.runJobsState = RunJobsState.SaveUserLang;

  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  vm.instructions = vm.t("viewModels.facebook.jobs.savingLanguage");

  vm.log("runJobSaveUserLang", "Opening language settings");

  await vm.waitForPause();

  // Open the language dialog
  const dialogOpened = await openLanguageDialog(vm);
  if (!dialogOpened) {
    vm.log(
      "runJobSaveUserLang",
      "Failed to open language dialog, defaulting to English (US)",
    );
    if (vm.account.facebookAccount) {
      vm.account.facebookAccount.userLang = DEFAULT_LANGUAGE;
      await window.electron.database.saveAccount(JSON.stringify(vm.account));
    }
    await Helpers.finishJob(vm, jobIndex);

    await vm.pause();
    await vm.waitForPause();
    return;
  }

  await vm.waitForPause();

  // Dev pause: wait to inspect the dialog
  await vm.sleep(2000);

  // Find the current language
  const currentLanguage = await findCurrentLanguage(vm);
  vm.log("runJobSaveUserLang", `Found current language: ${currentLanguage}`);

  await vm.waitForPause();

  // Dev pause: wait before saving
  await vm.sleep(2000);

  // Save to account
  if (vm.account.facebookAccount) {
    vm.account.facebookAccount.userLang = currentLanguage;
    await window.electron.database.saveAccount(JSON.stringify(vm.account));
  }

  await vm.pause();
  await vm.waitForPause();

  await Helpers.finishJob(vm, jobIndex);
}

/**
 * Set the language to English (US) for automation
 */
export async function runJobSetLangToEnglish(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.runJobsState = RunJobsState.SetLangToEnglish;

  const userLang = vm.account.facebookAccount?.userLang || DEFAULT_LANGUAGE;

  // Skip if already English
  if (userLang === DEFAULT_LANGUAGE) {
    vm.log("runJobSetLangToEnglish", "Already using English (US), skipping");
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  vm.instructions = vm.t("viewModels.facebook.jobs.settingLanguageToEnglish");

  vm.log("runJobSetLangToEnglish", "Setting language to English (US)");

  await vm.waitForPause();

  // Open the language dialog
  const dialogOpened = await openLanguageDialog(vm);
  if (!dialogOpened) {
    vm.log("runJobSetLangToEnglish", "Failed to open language dialog");
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  await vm.waitForPause();

  // Dev pause: wait to inspect the dialog
  await vm.sleep(2000);

  // Select English (US)
  const selected = await selectLanguage(vm, DEFAULT_LANGUAGE);
  if (!selected) {
    vm.log("runJobSetLangToEnglish", "Failed to select English (US)");
  } else {
    vm.log("runJobSetLangToEnglish", "Successfully selected English (US)");
  }

  await vm.waitForPause();

  // Wait for the change to take effect
  await vm.sleep(2000);

  await vm.pause();
  await vm.waitForPause();

  await Helpers.finishJob(vm, jobIndex);
}

/**
 * Restore the user's original language setting
 */
export async function runJobRestoreUserLang(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.runJobsState = RunJobsState.RestoreUserLang;

  const userLang = vm.account.facebookAccount?.userLang || DEFAULT_LANGUAGE;

  // Skip if already English (no need to restore)
  if (userLang === DEFAULT_LANGUAGE) {
    vm.log(
      "runJobRestoreUserLang",
      "User language is English (US), skipping restore",
    );
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  vm.instructions = vm.t("viewModels.facebook.jobs.restoringLanguage");

  vm.log("runJobRestoreUserLang", `Restoring language to ${userLang}`);

  await vm.waitForPause();

  // Open the language dialog
  const dialogOpened = await openLanguageDialog(vm);
  if (!dialogOpened) {
    vm.log("runJobRestoreUserLang", "Failed to open language dialog");
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  await vm.waitForPause();

  // Dev pause: wait to inspect the dialog
  await vm.sleep(2000);

  // Select the user's original language
  const selected = await selectLanguage(vm, userLang);
  if (!selected) {
    vm.log("runJobRestoreUserLang", `Failed to select ${userLang}`);
  } else {
    vm.log("runJobRestoreUserLang", `Successfully restored to ${userLang}`);
  }

  await vm.waitForPause();

  // Wait for the change to take effect
  await vm.sleep(2000);

  await vm.pause();
  await vm.waitForPause();

  await Helpers.finishJob(vm, jobIndex);
}

export async function runJobDeleteWallPosts(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.runJobsState = RunJobsState.DeleteWallPosts;

  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  vm.instructions = vm.t("viewModels.facebook.jobs.deletingWallPosts");

  vm.log("runJobDeleteWallPosts", "Loading profile page");

  await vm.waitForPause();

  // Load the user's profile page
  await vm.loadURL(FACEBOOK_PROFILE_URL);
  await vm.waitForLoadingToFinish();

  await vm.waitForPause();

  // Dev pause: wait to inspect the page
  await vm.sleep(2000);

  // For now, just log that we've loaded the page
  // The user will implement the actual deletion logic from here
  vm.log("runJobDeleteWallPosts", "Profile page loaded, ready for deletion");

  await vm.pause();
  await vm.waitForPause();

  await Helpers.finishJob(vm, jobIndex);
}
