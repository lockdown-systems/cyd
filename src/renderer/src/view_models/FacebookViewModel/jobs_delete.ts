import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";

const FACEBOOK_PROFILE_URL = "https://www.facebook.com/me/";

/**
 * Click the "Manage posts" button on the profile page
 */
async function clickManagePostsButton(vm: FacebookViewModel): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  try {
    const clicked = await webview.executeJavaScript(`
      (() => {
        const buttons = document.querySelectorAll('div[aria-label="Manage posts"][role="button"]');
        if (buttons.length > 0) {
          buttons[0].click();
          return true;
        }
        return false;
      })()
    `);
    return clicked;
  } catch (error) {
    vm.log("clickManagePostsButton", `Error: ${error}`);
    return false;
  }
}

/**
 * Wait for the "Manage posts" dialog to appear
 */
async function waitForManagePostsDialog(
  vm: FacebookViewModel,
): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  // Wait up to 10 seconds for dialog to appear
  for (let i = 0; i < 20; i++) {
    try {
      const dialogExists = await webview.executeJavaScript(`
        (() => {
          const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
          return !!dialog;
        })()
      `);

      if (dialogExists) {
        // Give it a moment for content to load
        await vm.sleep(500);
        return true;
      }
    } catch (error) {
      vm.log("waitForManagePostsDialog", `Error checking dialog: ${error}`);
    }
    await vm.sleep(500);
  }
  return false;
}

/**
 * Get the action description text from the dialog
 * Returns text like "You can hide or delete the posts selected." or empty string
 */
async function getActionDescription(vm: FacebookViewModel): Promise<string> {
  const webview = vm.getWebview();
  if (!webview) return "";

  try {
    const text = await webview.executeJavaScript(`
      (() => {
        const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
        if (!dialog) return "";

        // Find the actions description span
        // It's nested in the structure described by the user
        // We'll search for spans that contain text about deletion/hiding
        const spans = dialog.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || "";
          if (text.startsWith("You can")) {
            return text;
          }
        }
        return "";
      })()
    `);
    return text || "";
  } catch (error) {
    vm.log("getActionDescription", `Error: ${error}`);
    return "";
  }
}

/**
 * Check if the action description allows deletion
 */
function canDelete(actionDescription: string): boolean {
  return (
    actionDescription.startsWith("You can") &&
    actionDescription.toLowerCase().includes("delete")
  );
}

/**
 * Toggle a checkbox by index and return success
 */
async function toggleCheckbox(
  vm: FacebookViewModel,
  listIndex: number,
  itemIndex: number,
  shouldCheck: boolean,
): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  try {
    const toggled = await webview.executeJavaScript(`
      (() => {
        const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
        if (!dialog) return false;

        const lists = dialog.querySelectorAll('div[role="list"]');
        if (${listIndex} >= lists.length) return false;

        const list = lists[${listIndex}];
        const items = list.querySelectorAll('div[role="listitem"]');
        if (${itemIndex} >= items.length) return false;

        const item = items[${itemIndex}];
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (!checkbox) return false;

        const isChecked = checkbox.getAttribute('aria-checked') === 'true';
        const shouldCheck = ${shouldCheck};

        // Only click if we need to change the state
        if (isChecked !== shouldCheck) {
          checkbox.click();
          return true;
        }
        return false;
      })()
    `);
    return toggled;
  } catch (error) {
    vm.log("toggleCheckbox", `Error: ${error}`);
    return false;
  }
}

/**
 * Get the total number of lists and items
 */
async function getListsAndItems(
  vm: FacebookViewModel,
): Promise<{ listIndex: number; itemIndex: number }[]> {
  const webview = vm.getWebview();
  if (!webview) return [];

  try {
    const items = await webview.executeJavaScript(`
      (() => {
        const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
        if (!dialog) return [];

        const lists = dialog.querySelectorAll('div[role="list"]');
        const result = [];

        for (let listIndex = 0; listIndex < lists.length; listIndex++) {
          const list = lists[listIndex];
          const listItems = list.querySelectorAll('div[role="listitem"]');

          for (let itemIndex = 0; itemIndex < listItems.length; itemIndex++) {
            const item = listItems[itemIndex];
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) {
              result.push({ listIndex, itemIndex });
            }
          }
        }

        return result;
      })()
    `);
    return items;
  } catch (error) {
    vm.log("getListsAndItems", `Error: ${error}`);
    return [];
  }
}

/**
 * Click the Next button in the dialog
 */
async function clickNextButton(vm: FacebookViewModel): Promise<boolean> {
  const webview = vm.getWebview();
  if (!webview) return false;

  try {
    const clicked = await webview.executeJavaScript(`
      (() => {
        const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
        if (!dialog) return false;

        const nextButton = dialog.querySelector('div[aria-label="Next"][role="button"]');
        if (nextButton) {
          nextButton.click();
          return true;
        }
        return false;
      })()
    `);
    return clicked;
  } catch (error) {
    vm.log("clickNextButton", `Error: ${error}`);
    return false;
  }
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

  vm.log("runJobDeleteWallPosts", "Clicking Manage posts button");

  // Click the Manage posts button
  const buttonClicked = await clickManagePostsButton(vm);
  if (!buttonClicked) {
    vm.log("runJobDeleteWallPosts", "Failed to click Manage posts button");
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  await vm.waitForPause();

  // Wait for the dialog to open
  const dialogOpened = await waitForManagePostsDialog(vm);
  if (!dialogOpened) {
    vm.log("runJobDeleteWallPosts", "Manage posts dialog did not appear");
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  // Wait a moment for the UI to update
  await vm.sleep(2000);

  vm.log("runJobDeleteWallPosts", "Dialog opened, finding posts to delete");

  await vm.waitForPause();

  // Get all available list items with checkboxes
  const allItems = await getListsAndItems(vm);
  vm.log("runJobDeleteWallPosts", `Found ${allItems.length} items with checkboxes`);

  let checkedCount = 0;
  const maxToCheck = 50;

  // Loop through items and check those that can be deleted
  for (const { listIndex, itemIndex } of allItems) {
    if (checkedCount >= maxToCheck) {
      vm.log("runJobDeleteWallPosts", `Reached maximum of ${maxToCheck} items`);
      break;
    }

    await vm.waitForPause();

    // Check this checkbox
    const toggled = await toggleCheckbox(vm, listIndex, itemIndex, true);
    if (!toggled) {
      vm.log(
        "runJobDeleteWallPosts",
        `Failed to check item [${listIndex}][${itemIndex}]`,
      );
      continue;
    }

    // Wait a moment for the UI to update
    await vm.sleep(300);

    // Check the action description
    const actionDescription = await getActionDescription(vm);
    vm.log(
      "runJobDeleteWallPosts",
      `Action description: "${actionDescription}"`,
    );

    if (canDelete(actionDescription)) {
      // This item can be deleted, keep it checked
      checkedCount++;
      vm.log(
        "runJobDeleteWallPosts",
        `Checked deletable item ${checkedCount}/${maxToCheck}`,
      );
    } else {
      // This item cannot be deleted, uncheck it
      vm.log(
        "runJobDeleteWallPosts",
        `Item [${listIndex}][${itemIndex}] cannot be deleted, unchecking`,
      );
      await toggleCheckbox(vm, listIndex, itemIndex, false);
      await vm.sleep(300);
    }
  }

  vm.log(
    "runJobDeleteWallPosts",
    `Selected ${checkedCount} items for deletion`,
  );

  if (checkedCount === 0) {
    vm.log("runJobDeleteWallPosts", "No deletable items found");
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  await vm.waitForPause();

  await vm.pause();
  await vm.waitForPause();

  // Click the Next button
  vm.log("runJobDeleteWallPosts", "Clicking Next button");
  const nextClicked = await clickNextButton(vm);
  if (!nextClicked) {
    vm.log("runJobDeleteWallPosts", "Failed to click Next button");
    await Helpers.finishJob(vm, jobIndex);
    return;
  }

  vm.log("runJobDeleteWallPosts", "Pausing for next steps");

  await vm.pause();
  await vm.waitForPause();

  await Helpers.finishJob(vm, jobIndex);
}
