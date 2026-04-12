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
  // Wait up to 30 seconds for dialog to appear
  for (let i = 0; i < 60; i++) {
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

type PostAction = "delete" | "untag" | "hide";

async function getCheckboxState(
  vm: FacebookViewModel,
  listIndex: number,
  itemIndex: number,
): Promise<boolean | null> {
  const result = await vm.safeExecuteJavaScript<boolean | null>(
    `(() => {
      const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
      if (!dialog) return null;

      const lists = dialog.querySelectorAll('div[role="list"]');
      if (${listIndex} >= lists.length) return null;

      const list = lists[${listIndex}];
      const items = list.querySelectorAll('div[role="listitem"]');
      if (${itemIndex} >= items.length) return null;

      const item = items[${itemIndex}];
      const checkbox = item.querySelector('input[type="checkbox"]');
      const checkboxControl = item.querySelector('[role="checkbox"]');
      const ariaChecked =
        checkboxControl?.getAttribute('aria-checked') ??
        checkbox?.getAttribute('aria-checked');

      if (ariaChecked === 'true') return true;
      if (ariaChecked === 'false') return false;
      if (checkbox instanceof HTMLInputElement) return checkbox.checked;

      return null;
    })()`,
    "getCheckboxState",
  );

  return result.success ? result.value : null;
}

async function waitForCheckboxState(
  vm: FacebookViewModel,
  listIndex: number,
  itemIndex: number,
  expectedChecked: boolean,
  timeoutMs: number = 5000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const checked = await getCheckboxState(vm, listIndex, itemIndex);
    if (checked === expectedChecked) {
      return true;
    }
    await vm.sleep(200);
  }

  return false;
}

async function waitForActionDescriptionStable(
  vm: FacebookViewModel,
  timeoutMs: number = 5000,
): Promise<string> {
  const startTime = Date.now();
  let lastDescription = "";

  while (Date.now() - startTime < timeoutMs) {
    const description = await getActionDescription(vm);
    if (description !== "" && description === lastDescription) {
      return description;
    }
    lastDescription = description;
    await vm.sleep(200);
  }

  return lastDescription;
}

async function waitForBatchAction(
  vm: FacebookViewModel,
  expectedAction: PostAction,
  timeoutMs: number = 5000,
): Promise<{ success: boolean; actionDescription: string }> {
  const startTime = Date.now();
  let lastDescription = "";

  while (Date.now() - startTime < timeoutMs) {
    const actionDescription = await getActionDescription(vm);
    lastDescription = actionDescription;

    if (
      getHighestPriority(parseActions(actionDescription)) === expectedAction
    ) {
      return { success: true, actionDescription };
    }

    await vm.sleep(200);
  }

  return { success: false, actionDescription: lastDescription };
}

async function waitForActionOptionsDialog(
  vm: FacebookViewModel,
  timeoutMs: number = 10000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await vm.safeExecuteJavaScript<boolean>(
      `(() => {
        const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
        if (!dialog) return false;

        const hasActionOptions = dialog.querySelector('div[aria-disabled]');
        const hasDoneButton = dialog.querySelector('div[aria-label="Done"][role="button"]');
        return Boolean(hasActionOptions && hasDoneButton);
      })()`,
      "waitForActionOptionsDialog",
    );

    if (result.success && result.value) {
      return true;
    }

    await vm.sleep(200);
  }

  return false;
}

/**
 * Parse the available actions from an action description string.
 * e.g. "You can hide or delete the posts selected." -> ['delete', 'hide']
 *      "You can untag yourself from or hide the posts selected." -> ['untag', 'hide']
 *      "You can hide the posts selected." -> ['hide']
 */
export function parseActions(actionDescription: string): PostAction[] {
  if (typeof actionDescription !== "string") {
    return [];
  }

  const actions: PostAction[] = [];
  const text = actionDescription.toLowerCase();
  if (text.includes("delete")) actions.push("delete");
  if (text.includes("untag")) actions.push("untag");
  if (text.includes("hide")) actions.push("hide");
  return actions;
}

/**
 * Return the highest-priority action from a list.
 * Priority order: delete > untag > hide
 */
export function getHighestPriority(actions: PostAction[]): PostAction | null {
  if (actions.includes("delete")) return "delete";
  if (actions.includes("untag")) return "untag";
  if (actions.includes("hide")) return "hide";
  return null;
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
      const checkboxControl = item.querySelector('[role="checkbox"]');
      if (!checkbox && !checkboxControl) return false;

      const ariaChecked =
        checkboxControl?.getAttribute('aria-checked') ??
        checkbox?.getAttribute('aria-checked');
      let isChecked;

      if (ariaChecked === 'true') {
        isChecked = true;
      } else if (ariaChecked === 'false') {
        isChecked = false;
      } else if (checkbox instanceof HTMLInputElement) {
        isChecked = checkbox.checked;
      } else {
        return false;
      }

      const shouldCheck = ${shouldCheck};
      const clickTarget = checkboxControl ?? checkbox;
      if (!clickTarget) return false;

      // Only click if we need to change the state
      if (isChecked !== shouldCheck) {
        clickTarget.click();
        return true;
      }
      return true;
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
  if (!result.success || !Array.isArray(result.value)) return [];
  return result.value;
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
 * Select the "Untag yourself" radio button in the action selection dialog
 */
async function selectUntagPostsOption(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
      if (!dialog) return false;

      const divs = dialog.querySelectorAll('div[aria-disabled]');

      for (const div of divs) {
        const text = div.textContent?.toLowerCase() || '';
        if (text.includes('untag') || text.includes('remove tags')) {
          if (div.getAttribute('aria-disabled') === 'false') {
            const radioButton = div.querySelector('i');
            if (radioButton) {
              radioButton.click();
              return true;
            }
          } else {
            console.log('Untag option is disabled');
            return false;
          }
        }
      }

      console.log('Could not find untag option');
      return false;
    })()`,
    "selectUntagPostsOption",
  );
  return result.success && result.value;
}

/**
 * Select the "Hide posts" radio button in the action selection dialog
 */
async function selectHidePostsOption(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[aria-label="Manage posts"][role="dialog"]');
      if (!dialog) return false;

      const divs = dialog.querySelectorAll('div[aria-disabled]');

      for (const div of divs) {
        const text = div.textContent?.toLowerCase() || '';
        if (text.includes('hide')) {
          if (div.getAttribute('aria-disabled') === 'false') {
            const radioButton = div.querySelector('i');
            if (radioButton) {
              radioButton.click();
              return true;
            }
          } else {
            console.log('Hide option is disabled');
            return false;
          }
        }
      }

      console.log('Could not find hide option');
      return false;
    })()`,
    "selectHidePostsOption",
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

    vm.log("runJobDeleteWallPosts", "Dialog opened, waiting for posts to load");

    await vm.waitForPause();

    // Wait for items to appear in the dialog (with 30 second timeout)
    // On slow connections, the dialog content may take time to load
    let allItems: { listIndex: number; itemIndex: number }[] = [];
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 500; // Check every 500ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      allItems = await getListsAndItems(vm);
      if (allItems.length > 0) {
        vm.log(
          "runJobDeleteWallPosts",
          `Found ${allItems.length} items after ${Date.now() - startTime}ms`,
        );
        break;
      }
      await vm.sleep(pollInterval);
    }

    if (allItems.length === 0) {
      vm.log(
        "runJobDeleteWallPosts",
        `No items found after ${maxWaitTime}ms timeout, proceeding anyway`,
      );
    }

    vm.log(
      "runJobDeleteWallPosts",
      `Found ${allItems.length} items with checkboxes`,
    );

    let checkedCount = 0;
    let batchAction: PostAction | null = null;

    // Loop through items, checking each one. Track the highest-priority action
    // available for all checked items. Stop when adding a new item would reduce
    // the priority (e.g. from delete -> hide).
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

      const checkboxChecked = await waitForCheckboxState(
        vm,
        listIndex,
        itemIndex,
        true,
      );
      if (!checkboxChecked) {
        vm.log(
          "runJobDeleteWallPosts",
          `Timed out waiting for item [${listIndex}][${itemIndex}] to become checked`,
        );
        continue;
      }

      // Read the combined action description (reflects all currently-checked items)
      const actionDescription = await waitForActionDescriptionStable(vm);
      vm.log(
        "runJobDeleteWallPosts",
        `Action description: "${actionDescription}"`,
      );

      const combinedPriority = getHighestPriority(
        parseActions(actionDescription),
      );

      if (batchAction === null) {
        // First item: establish the batch action
        if (combinedPriority === null) {
          // Unrecognized description, skip this item
          vm.log(
            "runJobDeleteWallPosts",
            `Item [${listIndex}][${itemIndex}] has unrecognized action description, unchecking`,
          );
          await toggleCheckbox(vm, listIndex, itemIndex, false);
          await waitForCheckboxState(vm, listIndex, itemIndex, false);
          continue;
        }
        batchAction = combinedPriority;
        checkedCount++;
        vm.log(
          "runJobDeleteWallPosts",
          `First item sets batch action to "${batchAction}", checked ${checkedCount}/${maxToCheck}`,
        );
      } else if (combinedPriority === batchAction) {
        // Same priority: keep this item checked and continue
        checkedCount++;
        vm.log(
          "runJobDeleteWallPosts",
          `Item keeps batch action "${batchAction}", checked ${checkedCount}/${maxToCheck}`,
        );
      } else {
        // Adding this item changes the priority — uncheck it and stop
        vm.log(
          "runJobDeleteWallPosts",
          `Item [${listIndex}][${itemIndex}] changes priority from "${batchAction}" to "${combinedPriority}", unchecking and stopping`,
        );
        await toggleCheckbox(vm, listIndex, itemIndex, false);
        const checkboxUnchecked = await waitForCheckboxState(
          vm,
          listIndex,
          itemIndex,
          false,
        );
        if (!checkboxUnchecked) {
          vm.log(
            "runJobDeleteWallPosts",
            `Timed out waiting for item [${listIndex}][${itemIndex}] to become unchecked`,
          );
        }

        const batchActionRestored = await waitForBatchAction(vm, batchAction);
        if (!batchActionRestored.success) {
          await reportDeleteWallPostsError(
            vm,
            jobIndex,
            AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed,
            {
              batchNumber,
              message: `Batch action did not return to "${batchAction}" after unchecking item [${listIndex}][${itemIndex}]`,
              actionDescription: batchActionRestored.actionDescription,
            },
          );
          return;
        }
        break;
      }
    }

    vm.log(
      "runJobDeleteWallPosts",
      `Selected ${checkedCount} items for action "${batchAction}"`,
    );

    // If nothing was checked, we're done
    if (checkedCount === 0) {
      vm.log("runJobDeleteWallPosts", "No actionable items found, finishing");
      break;
    }

    if (batchAction === null) {
      vm.log(
        "runJobDeleteWallPosts",
        "Checked items were selected but no batch action was determined",
      );
      break;
    }

    await vm.waitForPause();

    const batchActionReady = await waitForBatchAction(vm, batchAction);
    if (!batchActionReady.success) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed,
        {
          batchNumber,
          message: `Action description did not settle on "${batchAction}" before clicking Next`,
          actionDescription: batchActionReady.actionDescription,
        },
      );
      return;
    }

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
    const actionOptionsReady = await waitForActionOptionsDialog(vm);
    if (!actionOptionsReady) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_DialogNotFound,
        {
          batchNumber,
          message: "Action options did not appear after clicking Next",
        },
      );
      return;
    }

    await vm.waitForPause();

    // Select the appropriate action radio button
    vm.log("runJobDeleteWallPosts", `Selecting "${batchAction}" option`);
    let actionSelected = false;
    let actionErrorType =
      AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed;
    let actionErrorMessage = "Failed to select delete posts option";

    if (batchAction === "delete") {
      actionSelected = await selectDeletePostsOption(vm);
      actionErrorType =
        AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed;
      actionErrorMessage = "Failed to select delete posts option";
    } else if (batchAction === "untag") {
      actionSelected = await selectUntagPostsOption(vm);
      actionErrorType =
        AutomationErrorType.facebook_runJob_deleteWallPosts_SelectUntagOptionFailed;
      actionErrorMessage = "Failed to select untag posts option";
    } else {
      // hide
      actionSelected = await selectHidePostsOption(vm);
      actionErrorType =
        AutomationErrorType.facebook_runJob_deleteWallPosts_SelectHideOptionFailed;
      actionErrorMessage = "Failed to select hide posts option";
    }

    if (!actionSelected) {
      await reportDeleteWallPostsError(vm, jobIndex, actionErrorType, {
        batchNumber,
        message: actionErrorMessage,
      });
      return;
    }

    vm.log("runJobDeleteWallPosts", `"${batchAction}" option selected`);

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
