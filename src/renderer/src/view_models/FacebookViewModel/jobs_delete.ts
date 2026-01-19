import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";
import { checkRateLimit } from "./rate_limit";
import { AutomationErrorType } from "../../automation_errors";

const FACEBOOK_PROFILE_URL = "https://www.facebook.com/me/";

async function reportDeleteWallPostsError(
  vm: FacebookViewModel,
  jobIndex: number,
  errorType: AutomationErrorType,
  errorReportData: Record<string, unknown>,
) {
  await vm.error(errorType, errorReportData, {
    currentURL: vm.webview?.getURL(),
  });
  await Helpers.errorJob(vm, jobIndex);
}

/**
 * Click the "Manage posts" button on the profile page
 */
async function clickManagePostsButton(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const buttons = document.querySelectorAll('div[aria-label="Manage posts"][role="button"]');
      if (buttons.length > 0) {
        buttons[0].click();
        return true;
      }
      return false;
    })()`,
    "clickManagePostsButton",
  );
  return result.success && result.value;
}

/**
 * Wait for the "Manage posts" dialog to appear
 */
async function waitForManagePostsDialog(
  vm: FacebookViewModel,
): Promise<boolean> {
  // Wait up to 10 seconds for dialog to appear
  for (let i = 0; i < 20; i++) {
    const result = await vm.safeExecuteJavaScript<boolean>(
      `(() => {
        const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
        return !!dialog;
      })()`,
      "waitForManagePostsDialog",
    );

    if (!result.success) {
      return false;
    }

    if (result.value) {
      // Give it a moment for content to load
      await vm.sleep(500);
      return true;
    }
    await vm.sleep(500);
  }
  return false;
}

/**
 * Wait for the "Manage posts" dialog to disappear
 * This indicates the deletion process has completed
 */
async function waitForManagePostsDialogToDisappear(
  vm: FacebookViewModel,
): Promise<boolean> {
  // Wait up to 60 seconds for dialog to disappear (deletion might take a while)
  for (let i = 0; i < 120; i++) {
    const result = await vm.safeExecuteJavaScript<boolean>(
      `(() => {
        const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
        return !!dialog;
      })()`,
      "waitForManagePostsDialogToDisappear",
    );

    if (!result.success) {
      return false;
    }

    if (!result.value) {
      vm.log("waitForManagePostsDialogToDisappear", "Dialog has disappeared");
      return true;
    }
    await vm.sleep(500);
  }

  vm.log(
    "waitForManagePostsDialogToDisappear",
    "Timeout waiting for dialog to disappear",
  );
  return false;
}

/**
 * Get the action description text from the dialog
 * Returns text like "You can hide or delete the posts selected." or empty string
 */
async function getActionDescription(vm: FacebookViewModel): Promise<string> {
  const result = await vm.safeExecuteJavaScript<string>(
    `(() => {
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
    })()`,
    "getActionDescription",
  );
  return result.success ? result.value || "" : "";
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
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
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
    })()`,
    "toggleCheckbox",
  );
  return result.success && result.value;
}

/**
 * Get the total number of lists and items
 */
async function getListsAndItems(
  vm: FacebookViewModel,
): Promise<{ listIndex: number; itemIndex: number }[]> {
  const result = await vm.safeExecuteJavaScript<
    { listIndex: number; itemIndex: number }[]
  >(
    `(() => {
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
    })()`,
    "getListsAndItems",
  );
  return result.success ? result.value : [];
}

/**
 * Click the Next button in the dialog
 */
async function clickNextButton(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
      if (!dialog) return false;

      const nextButton = dialog.querySelector('div[aria-label="Next"][role="button"]');
      if (nextButton) {
        nextButton.click();
        return true;
      }
      return false;
    })()`,
    "clickNextButton",
  );
  return result.success && result.value;
}

/**
 * Select the "Delete posts" radio button in the action selection dialog
 * Looks for a div with text "delete posts" (case insensitive), checks it's not disabled,
 * and clicks the radio button (i tag) inside it
 */
async function selectDeletePostsOption(
  vm: FacebookViewModel,
): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
      if (!dialog) return false;

      // Find all divs that might contain the delete posts option
      const divs = dialog.querySelectorAll('div[aria-disabled]');
      
      for (const div of divs) {
        // Check if this div or its children contain text about deleting posts
        const text = div.textContent?.toLowerCase() || '';
        if (text.includes('delete posts')) {
          // Check that it's not disabled
          if (div.getAttribute('aria-disabled') === 'false') {
            // Find the radio button (i tag) inside this div
            const radioButton = div.querySelector('i');
            if (radioButton) {
              radioButton.click();
              return true;
            }
          } else {
            console.log('Delete posts option is disabled');
            return false;
          }
        }
      }
      
      console.log('Could not find delete posts option');
      return false;
    })()`,
    "selectDeletePostsOption",
  );
  return result.success && result.value;
}

/**
 * Click the Done button in the dialog
 */
async function clickDoneButton(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
      if (!dialog) return false;

      const doneButton = dialog.querySelector('div[aria-label="Done"][role="button"]');
      if (doneButton) {
        doneButton.click();
        return true;
      }
      return false;
    })()`,
    "clickDoneButton",
  );
  return result.success && result.value;
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

  // Keep deleting posts until there are no more to delete
  let totalDeleted = 0;
  let batchNumber = 0;
  const maxToCheck = 10;

  while (true) {
    // Check for rate limits
    await checkRateLimit(vm);

    batchNumber++;
    vm.log("runJobDeleteWallPosts", `Starting batch ${batchNumber}`);

    vm.log("runJobDeleteWallPosts", "Clicking Manage posts button");

    // Click the Manage posts button
    // safeExecuteJavaScript handles webview validation and errors
    const buttonClicked = await clickManagePostsButton(vm);
    if (!buttonClicked) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_ClickManagePostsFailed,
        {
          batchNumber,
          message: "Failed to click Manage posts button",
        },
      );
      return;
    }

    await vm.waitForPause();

    // Wait for the dialog to open
    const dialogOpened = await waitForManagePostsDialog(vm);
    if (!dialogOpened) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_DialogNotFound,
        {
          batchNumber,
          message: "Manage posts dialog did not appear",
        },
      );
      return;
    }

    // Wait a moment for the UI to update
    await vm.sleep(2000);

    vm.log("runJobDeleteWallPosts", "Dialog opened, finding posts to delete");

    await vm.waitForPause();

    // Get all available list items with checkboxes
    const allItems = await getListsAndItems(vm);
    vm.log(
      "runJobDeleteWallPosts",
      `Found ${allItems.length} items with checkboxes`,
    );

    let checkedCount = 0;

    // Loop through items and check those that can be deleted
    for (const { listIndex, itemIndex } of allItems) {
      // Check for rate limits
      await checkRateLimit(vm);

      if (checkedCount >= maxToCheck) {
        vm.log(
          "runJobDeleteWallPosts",
          `Reached maximum of ${maxToCheck} items`,
        );
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

    // If nothing was checked, we're done
    if (checkedCount === 0) {
      vm.log("runJobDeleteWallPosts", "No deletable items found, finishing");
      break;
    }

    await vm.waitForPause();

    // Click the Next button
    vm.log("runJobDeleteWallPosts", "Clicking Next button");
    const nextClicked = await clickNextButton(vm);
    if (!nextClicked) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_ClickNextFailed,
        {
          batchNumber,
          message: "Failed to click Next button",
        },
      );
      return;
    }

    // Wait for the dialog to update with the action options
    await vm.sleep(1000);

    await vm.waitForPause();

    // Click the "Delete posts" radio button
    vm.log("runJobDeleteWallPosts", "Selecting delete posts option");
    const deleteSelected = await selectDeletePostsOption(vm);
    if (!deleteSelected) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed,
        {
          batchNumber,
          message: "Failed to select delete posts option",
        },
      );
      return;
    }

    vm.log("runJobDeleteWallPosts", "Delete posts option selected");

    await vm.waitForPause();

    // Click the Done button
    vm.log("runJobDeleteWallPosts", "Clicking Done button");
    const doneClicked = await clickDoneButton(vm);
    if (!doneClicked) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_ClickDoneFailed,
        {
          batchNumber,
          message: "Failed to click Done button",
        },
      );
      return;
    }

    vm.log("runJobDeleteWallPosts", "Done button clicked");

    await vm.waitForPause();

    // Wait for the dialog to disappear (indicates deletion is complete)
    vm.log("runJobDeleteWallPosts", "Waiting for deletion to complete...");
    const dialogDisappeared = await waitForManagePostsDialogToDisappear(vm);
    if (!dialogDisappeared) {
      vm.log(
        "runJobDeleteWallPosts",
        "Timeout waiting for dialog to disappear",
      );
      // Continue anyway - the deletion might have worked
    } else {
      vm.log("runJobDeleteWallPosts", "Deletion completed successfully");
    }

    // Update progress
    totalDeleted += checkedCount;
    vm.progress.wallPostsDeleted = totalDeleted;
    vm.log(
      "runJobDeleteWallPosts",
      `Batch ${batchNumber} complete: deleted ${checkedCount} posts, total: ${totalDeleted}`,
    );

    // Update the persistent counter in the database
    await window.electron.Facebook.incrementTotalWallPostsDeleted(
      vm.account.id,
      checkedCount,
    );

    // Submit progress to the API
    vm.emitter?.emit(`facebook-submit-progress-${vm.account.id}`);

    await vm.waitForPause();

    // Give Facebook a few seconds before refreshing
    // It seems that this helps
    await vm.sleep(3000);

    // Reload the profile page to see any newly available posts
    vm.log("runJobDeleteWallPosts", "Reloading profile page for next batch");
    await vm.loadURL(FACEBOOK_PROFILE_URL);
    await vm.waitForLoadingToFinish();
  }

  vm.log(
    "runJobDeleteWallPosts",
    `All done! Total posts deleted: ${totalDeleted}`,
  );

  await vm.waitForPause();

  // Always submit final progress to the API (even if 0 posts were deleted)
  vm.emitter?.emit(`facebook-submit-progress-${vm.account.id}`);

  await Helpers.finishJob(vm, jobIndex);
}
