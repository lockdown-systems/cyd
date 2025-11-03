import type { XViewModel } from "../view_model";
import { AutomationErrorType } from "../../../automation_errors";

/**
 * Check if there are any conversations left to delete
 * @returns true if finished (no more conversations)
 */
export async function deleteDMsCheckIfFinished(
  vm: XViewModel,
): Promise<boolean> {
  if (vm.progress.isDeleteDMsFinished) {
    vm.log("deleteDMsCheckIfFinished", ["no more conversations, ending job"]);
    await window.electron.X.deleteDMsMarkAllDeleted(vm.account.id);
    return true;
  }
  return false;
}

/**
 * Wait for conversation selector to appear
 * @returns Object with success flag and whether error was triggered
 */
export async function deleteDMsWaitForConversation(
  vm: XViewModel,
): Promise<{ success: boolean; shouldRetry: boolean; shouldReload: boolean }> {
  try {
    await vm.waitForSelector('div[data-testid="conversation"]');
    return { success: true, shouldRetry: false, shouldReload: false };
  } catch {
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
      return { success: false, shouldRetry: true, shouldReload: true };
    } else {
      vm.log("deleteDMsWaitForConversation", ["wait failed"]);
      return { success: false, shouldRetry: false, shouldReload: true };
    }
  }
}

/**
 * Mouseover first conversation and open menu
 * @returns Object with success flag and whether to reload page
 */
export async function deleteDMsMouseoverAndOpenMenu(
  vm: XViewModel,
): Promise<{ success: boolean; shouldReload: boolean }> {
  // Mouseover the first conversation
  if (
    !(await vm.scriptMouseoverElementFirst('div[data-testid="conversation"]'))
  ) {
    return { success: false, shouldReload: true };
  }

  // Wait for menu button selector
  try {
    await vm.waitForSelectorWithinSelector(
      'div[data-testid="conversation"]',
      "button",
    );
  } catch {
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
    }
    vm.log("deleteDMsMouseoverAndOpenMenu", ["wait for menu button failed"]);
    return { success: false, shouldReload: true };
  }

  // Click the menu button
  if (
    !(await vm.scriptClickElementWithinElementFirst(
      'div[data-testid="conversation"]',
      "button",
    ))
  ) {
    return { success: false, shouldReload: true };
  }

  return { success: true, shouldReload: false };
}

/**
 * Click delete button and confirm deletion
 * @returns Object with success flag and whether to reload page
 */
export async function deleteDMsClickDeleteAndConfirm(
  vm: XViewModel,
): Promise<{ success: boolean; shouldReload: boolean }> {
  // Wait for delete button selector
  try {
    await vm.waitForSelector(
      'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
    );
  } catch {
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
    }
    vm.log("deleteDMsClickDeleteAndConfirm", ["wait for delete button failed"]);
    return { success: false, shouldReload: true };
  }

  // Click the delete button
  if (
    !(await vm.scriptClickElement(
      'div[data-testid="Dropdown"] div[role="menuitem"]:last-of-type',
    ))
  ) {
    return { success: false, shouldReload: true };
  }

  // Wait for delete confirm selector
  try {
    await vm.waitForSelector('button[data-testid="confirmationSheetConfirm"]');
  } catch {
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
    }
    vm.log("deleteDMsClickDeleteAndConfirm", [
      "wait for confirm button failed",
    ]);
    return { success: false, shouldReload: true };
  }

  // Click the confirm button
  if (
    !(await vm.scriptClickElement(
      'button[data-testid="confirmationSheetConfirm"]',
    ))
  ) {
    return { success: false, shouldReload: true };
  }

  return { success: true, shouldReload: false };
}

/**
 * Process a single DM deletion iteration
 * @returns Object with success flag, error info, and whether to reload
 */
export async function deleteDMsProcessIteration(vm: XViewModel): Promise<{
  success: boolean;
  errorTriggered: boolean;
  errorType: AutomationErrorType | null;
  shouldReload: boolean;
}> {
  // When loading the DMs page, if there are no conversations it sets isDeleteDMsFinished to true
  if (await deleteDMsCheckIfFinished(vm)) {
    return {
      success: true,
      errorTriggered: false,
      errorType: null,
      shouldReload: false,
    };
  }

  // Wait for conversation selector
  const waitResult = await deleteDMsWaitForConversation(vm);
  if (!waitResult.success) {
    if (waitResult.shouldRetry) {
      return {
        success: false,
        errorTriggered: false,
        errorType: null,
        shouldReload: waitResult.shouldReload,
      };
    }
    return {
      success: false,
      errorTriggered: true,
      errorType:
        AutomationErrorType.x_runJob_deleteDMs_WaitForConversationsFailed,
      shouldReload: waitResult.shouldReload,
    };
  }

  // Mouseover and open menu
  const menuResult = await deleteDMsMouseoverAndOpenMenu(vm);
  if (!menuResult.success) {
    return {
      success: false,
      errorTriggered: true,
      errorType: AutomationErrorType.x_runJob_deleteDMs_MouseoverFailed,
      shouldReload: menuResult.shouldReload,
    };
  }

  // Click delete and confirm
  const deleteResult = await deleteDMsClickDeleteAndConfirm(vm);
  if (!deleteResult.success) {
    return {
      success: false,
      errorTriggered: true,
      errorType: AutomationErrorType.x_runJob_deleteDMs_ClickDeleteFailed,
      shouldReload: deleteResult.shouldReload,
    };
  }

  // Update progress
  vm.progress.conversationsDeleted += 1;
  await window.electron.X.setConfig(
    vm.account.id,
    "totalConversationsDeleted",
    `${vm.progress.conversationsDeleted}`,
  );

  return {
    success: true,
    errorTriggered: false,
    errorType: null,
    shouldReload: false,
  };
}
