import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";
import { checkRateLimit } from "./rate_limit";
import { AutomationErrorType } from "../../automation_errors";
import {
  selectedDeleteCategories,
  type FacebookDeleteCategory,
} from "./categories";

const ACTIVITY_LOG_CHECKBOX_NAME = "comet_activity_log_select_all_checkbox";

// Facebook throttles consecutive bulk deletions. Cool down between batches, and if it
// reports it's "still processing the previous changes", back off and retry
const BATCH_COOLDOWN_MS = 5000;
const PROCESSING_BACKOFF_MS = 60000;
const MAX_PROCESSING_RETRIES = 15;

/**
 * Attributes and rendered text only: never `.value` (so we don't capture a password)
 * Exported so the tests can run the shipping code against this
 */
export const BLOCKING_UI_JS = `(() => {
  const text = (el) => ((el.innerText || el.textContent) || '').replace(/\\s+/g, ' ').trim();
  const attr = (el, name) => (el.getAttribute ? el.getAttribute(name) : null);

  return {
    url: document.location ? document.location.href.split('?')[0] : '',
    title: (document.title || '').slice(0, 120),
    bodyText: text(document.body).slice(0, 500),
    passwordInputCount: document.querySelectorAll('input[type="password"]').length,
    passwordInputs: Array.from(document.querySelectorAll('input[type="password"]'))
      .slice(0, 3)
      .map((input) => ({
        name: attr(input, 'name'),
        id: attr(input, 'id'),
        ariaLabel: attr(input, 'aria-label'),
        placeholder: attr(input, 'placeholder'),
        autocomplete: attr(input, 'autocomplete'),
      })),
    dialogs: Array.from(document.querySelectorAll('div[role="dialog"]'))
      .slice(0, 5)
      .map((dialog) => ({
        ariaLabel: attr(dialog, 'aria-label'),
        ariaModal: attr(dialog, 'aria-modal'),
        hasPasswordInput: dialog.querySelector('input[type="password"]') !== null,
        buttons: Array.from(dialog.querySelectorAll('div[role="button"], button'))
          .slice(0, 8)
          .map((button) => (attr(button, 'aria-label') || text(button)).slice(0, 40))
          .filter((label) => label.length > 0),
        text: text(dialog).slice(0, 300),
      })),
  };
})()`;

/**
 * Describe whatever Facebook has put on screen, so an error report identifies the modal
 * that blocked us such as a password confirmation
 */
async function describeBlockingUI(
  vm: FacebookViewModel,
): Promise<Record<string, unknown>> {
  const result = await vm.safeExecuteJavaScript<Record<string, unknown>>(
    BLOCKING_UI_JS,
    "describeBlockingUI",
  );
  return result.success
    ? result.value
    : { error: `Could not inspect the page: ${result.error}` };
}

async function reportDeleteWallPostsError(
  vm: FacebookViewModel,
  jobIndex: number,
  errorType: AutomationErrorType,
  errorReportData: Record<string, unknown>,
) {
  const blockingUI = await describeBlockingUI(vm);
  vm.log("reportDeleteWallPostsError", { errorType, blockingUI });

  await vm.error(errorType, errorReportData, {
    currentURL: vm.webview?.getURL(),
    blockingUI,
  });
  await Helpers.errorJob(vm, jobIndex);
}

/**
 * Toggle a checkbox by name and return success
 */
async function toggleSelectAllCheckbox(
  vm: FacebookViewModel,
  shouldCheck: boolean,
): Promise<boolean> {
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
      // Row selectors can be <input type=checkbox> or [role=checkbox]; exclude the
      // "select all" header control either way.
      const candidates = document.querySelectorAll('input[type="checkbox"], [role="checkbox"]');
      let count = 0;
      for (const el of candidates) {
        if (el.getAttribute && el.getAttribute('name') === '${ACTIVITY_LOG_CHECKBOX_NAME}') continue;
        count++;
      }
      return count;
    })()`,
    "countSelectableItems",
  );
  return result.success && typeof result.value === "number" ? result.value : 0;
}

/**
 * Click the delete action in the activity-log toolbar. Facebook labels this differently
 * per category ("Remove", "Delete", "Trash", "Move to Trash", "Remove tags", etc.).
 * The toolbar appears after items are selected, so poll for it to show up.
 */
async function clickDeletePostsOption(
  vm: FacebookViewModel,
  timeoutMs: number = 10000,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const result = await vm.safeExecuteJavaScript<boolean>(
      `(() => {
        const LABELS = ['remove', 'delete', 'trash', 'move to trash', 'remove tags', 'remove tag', 'untag'];

        // First try a proper button with a matching aria-label.
        for (const el of document.querySelectorAll('[role="button"][aria-label]')) {
          const label = (el.getAttribute('aria-label') || '').trim().toLowerCase();
          if (LABELS.includes(label) && el.getAttribute('aria-disabled') !== 'true') {
            el.click();
            return true;
          }
        }

        // Otherwise find the small element whose visible text is one of the labels.
        let target = null;
        for (const el of document.querySelectorAll('span, div')) {
          if (el.children.length > 1) continue; // innermost text node only
          const text = (el.textContent || '').trim().toLowerCase();
          if (LABELS.includes(text)) { target = el; break; }
        }
        if (!target) return false;

        // Click the clickable ancestor: the one that contains FB's overlay catcher.
        let node = target;
        for (let i = 0; i < 6 && node; i++) {
          const overlay = node.querySelector && node.querySelector('[data-visualcompletion="ignore"]');
          if (overlay) { overlay.click(); node.click(); return true; }
          node = node.parentElement;
        }
        target.click();
        return true;
      })()`,
      "clickDeletePostsOption",
    );
    if (result.success && result.value) {
      return true;
    }
    await vm.sleep(500);
  }
  return false;
}

/**
 * Confirm the "Move to trash?" dialog that appears after clicking Trash.
 * Best-effort: some flows delete without a confirmation step.
 */
async function confirmDeletion(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-modal="true"]');
      if (!dialog) return false;
      const CONFIRM_LABELS = ['delete', 'move to trash', 'confirm', 'remove', 'remove tags', 'remove tag', 'untag'];
      const buttons = dialog.querySelectorAll('div[role="button"], button');
      for (const button of buttons) {
        const label = (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase();
        if (CONFIRM_LABELS.includes(label)) {
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
 * Detect Facebook's "We're still processing the previous changes / Try again later" modal,
 * which appears when we attempt to delete again too soon.
 */
async function isStillProcessing(vm: FacebookViewModel): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const text = (document.body.innerText || '').toLowerCase();
      return text.includes('still processing the previous changes') ||
             text.includes('try again later');
    })()`,
    "isStillProcessing",
  );
  return result.success && result.value;
}

/**
 * Dismiss a modal by clicking its OK/Close button.
 */
async function dismissModal(vm: FacebookViewModel): Promise<void> {
  await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return false;
      const buttons = dialog.querySelectorAll('div[role="button"], button');
      for (const button of buttons) {
        const label = (button.getAttribute('aria-label') || button.textContent || '').trim().toLowerCase();
        if (['ok', 'okay', 'close', 'got it', 'dismiss'].includes(label)) {
          button.click();
          return true;
        }
      }
      return false;
    })()`,
    "dismissModal",
  );
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
    vm.log(
      "loadActivityLog",
      `Loading activity log for category key: ${categoryKey}`,
    );

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

  let processingRetries = 0;

  // Keep deleting until there are no more items to delete
  while (true) {
    // Check for rate limits
    await checkRateLimit(vm);
    await vm.waitForPause();

    // Facebook may still be processing the previous batch; back off and retry.
    if (await isStillProcessing(vm)) {
      processingRetries++;
      if (processingRetries > MAX_PROCESSING_RETRIES) {
        await reportDeleteWallPostsError(
          vm,
          jobIndex,
          AutomationErrorType.facebook_runJob_deleteWallPosts_CompletionTimeout,
          {
            category: category.setting,
            message: "Facebook kept reporting it was still processing",
          },
        );
        return null;
      }
      vm.log(
        "deleteCategory",
        `Facebook still processing previous changes; backing off (retry ${processingRetries})`,
      );
      await dismissModal(vm);
      await vm.sleep(PROCESSING_BACKOFF_MS);
      await loadActivityLog(vm, category.categoryKey);
      continue;
    }
    processingRetries = 0;

    // If there are no items to delete, we're done with this category. Facebook may
    // still render the "select all" checkbox when empty, so gate on the item count
    // rather than the checkbox's presence.
    const batchCount = await countSelectableItems(vm);
    if (batchCount === 0) {
      vm.log(
        "deleteCategory",
        `No more items for category ${category.setting}`,
      );
      break;
    }

    // Select all currently loaded items
    const toggled = await toggleSelectAllCheckbox(vm, true);
    if (!toggled) {
      // Exits without an error report, so log the page
      vm.log("deleteCategory", {
        message: `Could not select items for category ${category.setting}`,
        blockingUI: await describeBlockingUI(vm),
      });
      break;
    }

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

    // Confirm the deletion dialog if one appears
    await vm.sleep(1000);
    await confirmDeletion(vm);

    // If Facebook says it's still processing, don't count this batch; back off and retry.
    if (await isStillProcessing(vm)) {
      vm.log(
        "deleteCategory",
        "Facebook still processing after confirm; backing off",
      );
      await dismissModal(vm);
      await vm.sleep(PROCESSING_BACKOFF_MS);
      await loadActivityLog(vm, category.categoryKey);
      continue;
    }

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

    // Cool down before the next batch to avoid tripping Facebook's throttle.
    await vm.sleep(BATCH_COOLDOWN_MS);
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
