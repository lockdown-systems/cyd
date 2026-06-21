import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";
import { checkRateLimit } from "./rate_limit";
import { AutomationErrorType } from "../../automation_errors";
import {
  selectedDeleteCategories,
  type FacebookDeleteCategory,
} from "./categories";

const ACTIVITY_LOG_CHECKBOX_NAME = "comet_activity_log_select_all_checkbox"

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
 * Toggle a checkbox by name and return success
 */
async function toggleSelectAllCheckbox(vm: FacebookViewModel, shouldCheck: boolean): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const checkbox = document.querySelector('input[name="${ACTIVITY_LOG_CHECKBOX_NAME}"]');
      if (!checkbox) return false;

      // aria-checked is the string "true"/"false"; fall back to the native checked prop.
      const ariaChecked = checkbox.getAttribute('aria-checked');
      const isChecked = ariaChecked === 'true' ? true : (ariaChecked === 'false' ? false : checkbox.checked);

      const shouldCheck = ${shouldCheck};

      // Only click if we need to change the state
      if (isChecked !== shouldCheck) {
        checkbox.click();
        return true;
      }
      return true;
    })()`,
    "toggleSelectAllCheckbox",
  );
  return result.success && result.value;
}

/**
 * Count the selectable items (row checkboxes, excluding the "select all" header checkbox)
 * so we can report how many items a delete batch removed.
 */
async function countSelectableItems(vm: FacebookViewModel): Promise<number> {
  const result = await vm.safeExecuteJavaScript<number>(
    `(() => {
      const checkboxes = document.querySelectorAll(
        'input[type="checkbox"]:not([name="${ACTIVITY_LOG_CHECKBOX_NAME}"])'
      );
      return checkboxes.length;
    })()`,
    "countSelectableItems",
  );
  return result.success && typeof result.value === "number" ? result.value : 0;
}

/**
 * Click the "Trash" button in the header section
 * Looks for a div with role "button" and aria-label "trash" (case insensitive), checks it's not disabled,
 * and clicks the button
 */
async function clickDeletePostsOption(
  vm: FacebookViewModel,
): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const deleteButton = document.querySelector('div[aria-label="Trash"][role="button"]');
      if (!deleteButton) return false;

      if (deleteButton.getAttribute('aria-disabled') === 'false') {
        deleteButton.click();
        return true;
      } else {
        console.log('Delete posts option is disabled');
        return false;
      }

      console.log('Could not find delete posts option');
      return false;
    })()`,
    "clickDeletePostsOption",
  );
  return result.success && result.value;
}

/**
 * Confirm the "Move to trash?" dialog that appears after clicking Trash.
 * Best-effort: some flows delete without a confirmation step.
 */
async function confirmDeletion(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return false;
      const buttons = dialog.querySelectorAll('div[role="button"], button');
      for (const button of buttons) {
        const label = (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase();
        if (['delete', 'move to trash', 'confirm', 'remove'].includes(label)) {
          if (button.getAttribute('aria-disabled') === 'true') return false;
          button.click();
          return true;
        }
      }
      return false;
    })()`,
    "confirmDeletion",
  );
  return result.success && result.value;
}

/**
 * Wait for a delete batch to be applied: the select-all checkbox clears or disappears.
 */
async function waitForBatchToComplete(
  vm: FacebookViewModel,
  timeoutMs: number = 30000,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const settled = await vm.safeExecuteJavaScript<boolean>(
      `(() => {
        const checkbox = document.querySelector('input[name="${ACTIVITY_LOG_CHECKBOX_NAME}"]');
        if (!checkbox) return true; // no items left
        const ariaChecked = checkbox.getAttribute('aria-checked');
        const isChecked = ariaChecked === 'true' ? true : (ariaChecked === 'false' ? false : checkbox.checked);
        return !isChecked; // selection cleared => batch applied
      })()`,
      "waitForBatchToComplete",
    );
    if (settled.success && settled.value) {
      return true;
    }
    await vm.sleep(500);
  }
  return false;
}

async function loadActivityLog(
  vm: FacebookViewModel,
  categoryKey: string,
): Promise<void> {
  if (vm.account.facebookAccount) {
    vm.log("loadActivityLog", `Loading activity log for category key: ${categoryKey}`);

    const FACEBOOK_ACTIVITY_LOG_URL = `https://www.facebook.com/${vm.account.facebookAccount.accountID}/\
allactivity?activity_history=false&category_key=${categoryKey}\
&manage_mode=true&should_load_landing_page=false`;

    await vm.loadURL(FACEBOOK_ACTIVITY_LOG_URL);
    await vm.waitForLoadingToFinish();

    await vm.waitForPause();
  }
}

/**
 * Delete every item in a single activity-log category, batch by batch, until none remain.
 * Returns the number of items deleted, or null if the job errored.
 */
async function deleteCategory(
  vm: FacebookViewModel,
  jobIndex: number,
  category: FacebookDeleteCategory,
): Promise<number | null> {
  await loadActivityLog(vm, category.categoryKey);

  // Keep deleting until there are no more items to delete
  while (true) {
    // Check for rate limits
    await checkRateLimit(vm);
    await vm.waitForPause();

    // Select all currently loaded items. The checkbox only exists when there are
    // items, so a false result means we're done with this category.
    const toggled = await toggleSelectAllCheckbox(vm, true);
    if (!toggled) {
      vm.log("deleteCategory", `No more items for category ${category.setting}`);
      break;
    }

    // Count what we're about to delete so we can report progress
    const batchCount = await countSelectableItems(vm);

    await vm.waitForPause();

    // Click on trash
    const deletedBtnClicked = await clickDeletePostsOption(vm);
    if (!deletedBtnClicked) {
      vm.log("deleteCategory", `Failed to click "Trash" button`);
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_SelectDeleteOptionFailed,
        { category: category.setting, message: "Failed to click Trash button" },
      );
      return null;
    }

    // Confirm the deletion dialog if one appears, then wait for the batch to apply
    await vm.sleep(1000);
    await confirmDeletion(vm);
    const completed = await waitForBatchToComplete(vm);
    if (!completed) {
      await reportDeleteWallPostsError(
        vm,
        jobIndex,
        AutomationErrorType.facebook_runJob_deleteWallPosts_CompletionTimeout,
        { category: category.setting, message: "Batch did not complete" },
      );
      return null;
    }

    // Record progress for this batch
    vm.progress[category.counter] += batchCount;
    await Helpers.incrementCumulativeTotal(vm, category.counter, batchCount);
    vm.emitter?.emit(`facebook-submit-progress-${vm.account.id}`);
  }

  return vm.progress[category.counter];
}

export async function runJobDeleteActivity(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.runJobsState = RunJobsState.DeleteActivity;

  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  vm.progress.isDeleteActivityFinished = false;

  // Delete each data category the user selected. Every category uses the identical
  // activity-log flow and differs only by its category_key.
  const categories = vm.account.facebookAccount
    ? selectedDeleteCategories(vm.account.facebookAccount)
    : [];

  for (const category of categories) {
    await vm.waitForPause();

    vm.progress.currentCategory = category.setting;
    vm.instructions = vm.t("viewModels.facebook.jobs.deletingCategory", {
      category: vm.t(category.labelKey),
    });

    const deleted = await deleteCategory(vm, jobIndex, category);
    if (deleted === null) {
      // deleteCategory already marked the job as errored
      return;
    }
  }

  vm.progress.currentCategory = "";
  vm.progress.isDeleteActivityFinished = true;
  vm.log("runJobDeleteActivity", "All done!");

  await vm.waitForPause();

  // Always submit final progress to the API (even if 0 items were deleted)
  vm.emitter?.emit(`facebook-submit-progress-${vm.account.id}`);

  await Helpers.finishJob(vm, jobIndex);
}
