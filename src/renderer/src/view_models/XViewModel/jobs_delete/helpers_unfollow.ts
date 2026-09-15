import type { XViewModel } from "../view_model";
import { AutomationErrorType } from "../../../automation_errors";
import { UNFOLLOW_BUTTON_SELECTOR } from "./helpers_shared";

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
 * Unfollow the first account in the following list
 *
 * Always the first one: once an account is unfollowed X swaps its button's
 * data-testid from "-unfollow" to "-follow", so the row stops matching
 * UNFOLLOW_BUTTON_SELECTOR and every account after it shifts up one position.
 *
 * @returns Object with success flag, whether the account was rate limited and should be retried
 *   and whether to reload the page
 */
export async function unfollowEveryoneUnfollowAccount(
  vm: XViewModel,
): Promise<{ success: boolean; shouldRetry: boolean; shouldReload: boolean }> {
  // Mouseover the "Following" button on the next user
  if (!(await vm.scriptMouseoverElementFirst(UNFOLLOW_BUTTON_SELECTOR))) {
    return { success: false, shouldRetry: false, shouldReload: true };
  }

  // Click the unfollow button
  if (!(await vm.scriptClickElementFirst(UNFOLLOW_BUTTON_SELECTOR))) {
    return { success: false, shouldRetry: false, shouldReload: true };
  }

  // Wait for confirm button
  try {
    await vm.waitForSelector('button[data-testid="confirmationSheetConfirm"]');
  } catch {
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
      return { success: false, shouldRetry: true, shouldReload: true };
    }
    vm.log("unfollowEveryoneUnfollowAccount", [
      "wait for confirm button failed",
    ]);
    return { success: false, shouldRetry: false, shouldReload: true };
  }

  // Click the confirm button
  if (
    !(await vm.scriptClickElement(
      'button[data-testid="confirmationSheetConfirm"]',
    ))
  ) {
    return { success: false, shouldRetry: false, shouldReload: true };
  }

  // if we were rate limited the account wasn't actually unfollowed, so
  // wait it out and retry instead of moving on.
  await vm.sleep(500);
  vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
  if (vm.rateLimitInfo.isRateLimited) {
    await vm.waitForRateLimit();
    return { success: false, shouldRetry: true, shouldReload: true };
  }

  return { success: true, shouldRetry: false, shouldReload: false };
}

/**
 * Process a single unfollow iteration
 * @returns Object with success flag, error info, and reload flag
 */
export async function unfollowEveryoneProcessIteration(
  vm: XViewModel,
): Promise<{
  success: boolean;
  errorTriggered: boolean;
  errorType: AutomationErrorType | null;
  shouldReload: boolean;
}> {
  // Check if finished
  if (await unfollowEveryoneCheckIfFinished(vm)) {
    return {
      success: true,
      errorTriggered: false,
      errorType: null,
      shouldReload: false,
    };
  }

  // Unfollow the account
  const result = await unfollowEveryoneUnfollowAccount(vm);
  if (!result.success) {
    // A rate limit isn't an error: we already waited it out, so just reload and retry
    // this same account instead of ending the job.
    if (result.shouldRetry) {
      return {
        success: false,
        errorTriggered: false,
        errorType: null,
        shouldReload: result.shouldReload,
      };
    }
    return {
      success: false,
      errorTriggered: true,
      errorType: AutomationErrorType.x_runJob_unfollowEveryone_MouseoverFailed,
      shouldReload: result.shouldReload,
    };
  }

  // Update progress
  vm.progress.accountsUnfollowed += 1;
  await window.electron.X.setConfig(
    vm.account.id,
    "totalAccountsUnfollowed",
    `${vm.progress.accountsUnfollowed}`,
  );

  // Once the page has no accounts left to unfollow, reload it to get more
  const accountsLeft = await vm.countSelectorsFound(UNFOLLOW_BUTTON_SELECTOR);

  return {
    success: true,
    errorTriggered: false,
    errorType: null,
    shouldReload: accountsLeft === 0,
  };
}
