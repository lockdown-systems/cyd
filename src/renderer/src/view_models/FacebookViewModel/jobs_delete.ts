import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";
import { checkRateLimit } from "./rate_limit";
import { AutomationErrorType } from "../../automation_errors";

const FACEBOOK_PROFILE_URL = "https://www.facebook.com/me/";
const FACEBOOK_CATEGORY_KEYS = {
  "comments": "COMMENTSCLUSTER",
  "reactions": "LIKEDPOSTS",
  "user_posts": "MANAGEPOSTSPHOTOSANDVIDEOS",
  "posts_on_others": "POSTSONOTHERSTIMELINES",
  "others_posts": "WALLCLUSTER",
  "checkins": "CHECKINS",
  "tagged_posts": "MANAGETAGSBYOTHERSCLUSTER",
  "tagged_media": "TAGGEDPHOTOS",
}
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

const actionVerbKeys: Record<PostAction, string> = {
  delete: "viewModels.facebook.jobs.actionDelete",
  untag: "viewModels.facebook.jobs.actionUntag",
  hide: "viewModels.facebook.jobs.actionHide",
};

const actionPresentKeys: Record<PostAction, string> = {
  delete: "viewModels.facebook.jobs.actionDeletePresent",
  untag: "viewModels.facebook.jobs.actionUntagPresent",
  hide: "viewModels.facebook.jobs.actionHidePresent",
};

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
 * Toggle a checkbox by name and return success
 */
async function toggleSelectAllCheckbox(vm: FacebookViewModel, shouldCheck: boolean): Promise<boolean> {
  const result = await vm.safeExecuteJavaScript<boolean>(
    `(() => {
      const checkbox = document.querySelector('input[name="${ACTIVITY_LOG_CHECKBOX_NAME}"]');
      if (!checkbox) return false;

      const isChecked = checkbox?.getAttribute('aria-checked') || checkbox.checked;

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

async function loadActivityLog(
  vm: FacebookViewModel,
  categoryKey: keyof typeof FACEBOOK_CATEGORY_KEYS
): Promise<void> {
  if (vm.account.facebookAccount) {
    vm.log("loadActivityLog", `Loading activity log for category key: ${categoryKey}`);

    const FACEBOOK_ACTIVITY_LOG_URL = `https://www.facebook.com/${vm.account.facebookAccount.accountID}/\
allactivity?activity_history=false&category_key=${FACEBOOK_CATEGORY_KEYS[categoryKey]}\
&manage_mode=false&should_load_landing_page=false`;

    await vm.loadURL(FACEBOOK_ACTIVITY_LOG_URL);
    await vm.waitForLoadingToFinish();

    await vm.pause();

    await vm.waitForPause();
  }
}

export async function runJobDeleteWallPosts(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.runJobsState = RunJobsState.DeleteWallPosts;

  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  vm.instructions = vm.t("viewModels.facebook.jobs.removingWallPosts");

  // TODO: might want to not hardcode but based on the options selected by users
  const postCategoryKeys = [
    "user_posts",
    "posts_on_others",
    "others_posts",
    "checkins",
    "tagged_posts",
    "tagged_media"
  ] as (keyof typeof FACEBOOK_CATEGORY_KEYS)[];

  for (const categoryKey  of postCategoryKeys) {
    // Load activity log page based on category key
    await vm.waitForPause();
    await loadActivityLog(vm, categoryKey);

    // Keep deleting posts until there are no more to delete
    let totalDeleted = 0;
    while (true) {
      // Check for rate limits
      await checkRateLimit(vm);

      // Check select all checkbox
      const toggled = await toggleSelectAllCheckbox(vm, true);
      if (!toggled) {
        vm.log(
          "runJobDeleteWallPosts",
          `Failed to check "All" checkbox`,
        );
        continue;
      }

      await vm.waitForPause();

      // Click on trash
      const deletedBtnClicked = await clickDeletePostsOption(vm);
      if(deletedBtnClicked) {
        vm.log(
          "runJobDeleteWallPosts",
          `Failed to click "Trash" button`,
        );
        continue;
      }
    }
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
