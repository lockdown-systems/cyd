import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";

const FACEBOOK_LANGUAGE_SETTINGS_URL =
  "https://www.facebook.com/settings/?tab=language";

// XPaths for language settings
const XPATH_ACCOUNT_LANGUAGE_BUTTON =
  "/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div[2]/div/div/div/div/div/div/div/div/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div/div[1]/div/div[2]/i";
const XPATH_LANGUAGE_DIALOG =
  "/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div";
const XPATH_LANGUAGE_LIST =
  "/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]";

export const DEFAULT_LANGUAGE = "English (US)";

// Export XPaths for testing
export const XPATHS = {
  ACCOUNT_LANGUAGE_BUTTON: XPATH_ACCOUNT_LANGUAGE_BUTTON,
  LANGUAGE_DIALOG: XPATH_LANGUAGE_DIALOG,
  LANGUAGE_LIST: XPATH_LANGUAGE_LIST,
};

/**
 * Helper to wait for language dialog to appear
 */
export async function waitForLanguageDialog(
  vm: FacebookViewModel,
): Promise<boolean> {
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
export async function findCurrentLanguage(
  vm: FacebookViewModel,
): Promise<string> {
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
 * Select a language by finding it in the list and clicking its radio button
 */
export async function selectLanguage(
  vm: FacebookViewModel,
  language: string,
): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  try {
    const clicked = await webview.executeJavaScript(`
      (() => {
        const targetLanguage = '${language}';
        
        const result = document.evaluate(
          '${XPATH_LANGUAGE_LIST}',
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const languageList = result.singleNodeValue;
        if (!languageList) {
          console.log('selectLanguage: Language list not found');
          return false;
        }

        // Loop through child divs looking for the target language
        const children = languageList.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.tagName !== 'DIV') continue;

          // Check if this child has a div with role="radio" (indicating it's a language option)
          const radioDiv = child.querySelector('div[role="radio"]');
          if (!radioDiv) continue;

          // Look for the first span which contains the language name in its native language
          const span = child.querySelector('span');
          if (!span) continue;

          const languageText = span.textContent.trim();
          console.log('selectLanguage: Found language option:', languageText);

          if (languageText === targetLanguage) {
            console.log('selectLanguage: Clicking radio button for:', targetLanguage);
            radioDiv.click();
            return true;
          }
        }

        console.log('selectLanguage: Target language not found:', targetLanguage);
        return false;
      })()
    `);

    if (!clicked) {
      vm.log("selectLanguage", `Language not found in list: ${language}`);
    }
    return clicked;
  } catch (error) {
    vm.log("selectLanguage", `Error selecting language: ${error}`);
    return false;
  }
}

/**
 * Open the language settings page and click the account language button
 */
export async function openLanguageDialog(
  vm: FacebookViewModel,
): Promise<boolean> {
  // Load the language settings page
  await vm.loadURL(FACEBOOK_LANGUAGE_SETTINGS_URL);
  await vm.waitForLoadingToFinish();
  await vm.sleep(1000);

  // Click the account language button
  const clicked = await vm.clickElementByXPath(XPATH_ACCOUNT_LANGUAGE_BUTTON);
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
