import type { XViewModel } from "../view_model";
import { AutomationErrorType } from "../../../automation_errors";

/**
 * Check if there are any accounts left to unfollow
 * @returns true if finished (no more following)
 */
export async function unfollowEveryoneCheckIfFinished(
  vm: XViewModel,
): Promise<boolean> {
  if (vm.progress.isUnfollowEveryoneFinished) {
    vm.log("unfollowEveryoneCheckIfFinished", [
      "no more following users, ending job",
    ]);
    return true;
  }
  return false;
}

/**
 * Unfollow a single account
 * @returns Object with success flag and whether to reload page
 */
export async function unfollowEveryoneUnfollowAccount(
  vm: XViewModel,
  accountIndex: number,
): Promise<{ success: boolean; shouldReload: boolean }> {
  // Mouseover the "Following" button on the next user
  if (
    !(await vm.scriptMouseoverElementNth(
      'div[data-testid="cellInnerDiv"] button button',
      accountIndex,
    ))
  ) {
    return { success: false, shouldReload: true };
  }

  // Click the unfollow button
  if (
    !(await vm.scriptClickElementNth(
      'div[data-testid="cellInnerDiv"] button button',
      accountIndex,
    ))
  ) {
    return { success: false, shouldReload: true };
  }

  // Wait for confirm button
  try {
    await vm.waitForSelector('button[data-testid="confirmationSheetConfirm"]');
  } catch {
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
    }
    vm.log("unfollowEveryoneUnfollowAccount", [
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
 * Process a single unfollow iteration
 * @returns Object with success flag, error info, reload flag, and updated index
 */
export async function unfollowEveryoneProcessIteration(
  vm: XViewModel,
  accountIndex: number,
  totalAccounts: number,
): Promise<{
  success: boolean;
  errorTriggered: boolean;
  errorType: AutomationErrorType | null;
  shouldReload: boolean;
  newAccountIndex: number;
}> {
  // Check if finished
  if (await unfollowEveryoneCheckIfFinished(vm)) {
    return {
      success: true,
      errorTriggered: false,
      errorType: null,
      shouldReload: false,
      newAccountIndex: accountIndex,
    };
  }

  // Unfollow the account
  const result = await unfollowEveryoneUnfollowAccount(vm, accountIndex);
  if (!result.success) {
    return {
      success: false,
      errorTriggered: true,
      errorType: AutomationErrorType.x_runJob_unfollowEveryone_MouseoverFailed,
      shouldReload: result.shouldReload,
      newAccountIndex: accountIndex,
    };
  }

  // Update progress
  vm.progress.accountsUnfollowed += 1;
  await window.electron.X.setConfig(
    vm.account.id,
    "totalAccountsUnfollowed",
    `${vm.progress.accountsUnfollowed}`,
  );

  // Increment the account index
  const newAccountIndex = accountIndex + 1;
  const shouldReload = newAccountIndex >= totalAccounts;

  return {
    success: true,
    errorTriggered: false,
    errorType: null,
    shouldReload,
    newAccountIndex: shouldReload ? 0 : newAccountIndex,
  };
}
