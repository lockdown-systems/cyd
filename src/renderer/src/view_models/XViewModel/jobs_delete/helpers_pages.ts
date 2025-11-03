import type { XViewModel } from "../view_model";
import { TimeoutError, URLChangedError } from "../../BaseViewModel";
import { AutomationErrorType } from "../../../automation_errors";
import { formatError } from "../../../util";

/**
 * Load the DMs page and wait for conversation list
 * @returns true if an error was triggered, false otherwise
 */
export async function deleteDMsLoadDMsPage(vm: XViewModel): Promise<boolean> {
  vm.log("deleteDMsLoadDMsPage", "loading DMs page");
  let tries: number, success: boolean;
  let error: Error | null = null;
  let errorType: AutomationErrorType =
    AutomationErrorType.x_runJob_deleteDMs_OtherError;
  let newURL: string = "";

  success = false;
  for (tries = 0; tries < 3; tries++) {
    await vm.loadURLWithRateLimit("https://x.com/messages");

    // If the conversations list is empty, there is no search text field
    try {
      // Wait for the search text field to appear with a 30 second timeout
      await vm.waitForSelector(
        'section input[type="text"]',
        "https://x.com/messages",
        30000,
      );
    } catch (e) {
      vm.log("deleteDMsLoadDMsPage", ["selector never appeared", e]);
      // There are no conversations
      await vm.waitForLoadingToFinish();
      vm.progress.isDeleteDMsFinished = true;
      await vm.syncProgress();
      return false;
    }

    try {
      await window.electron.X.resetRateLimitInfo(vm.account.id);
      vm.log(
        "deleteDMsLoadDMsPage",
        "waiting for selector after loading messages page",
      );
      await vm.waitForSelector(
        'section div div[role="tablist"] div[data-testid="cellInnerDiv"]',
        "https://x.com/messages",
      );
      success = true;
      break;
    } catch (e) {
      vm.log("deleteDMsLoadDMsPage", ["selector never appeared", e]);
      if (e instanceof TimeoutError) {
        // Were we rate limited?
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
        } else {
          // Assume that there are no conversations
          await vm.waitForLoadingToFinish();
          vm.progress.isDeleteDMsFinished = true;
          await vm.syncProgress();
          return false;
        }
      } else if (e instanceof URLChangedError) {
        newURL = vm.webview?.getURL() || "";
        error = e;
        errorType = AutomationErrorType.x_runJob_deleteDMs_URLChanged;
        vm.log("deleteDMsLoadDMsPage", ["URL changed", newURL]);
        await vm.sleep(1000);
        continue;
      } else {
        error = e as Error;
        vm.log("deleteDMsLoadDMsPage", ["other error", e]);
        await vm.sleep(1000);
        continue;
      }
    }
  }

  if (!success) {
    await vm.error(errorType, {
      error: formatError(error as Error),
      currentURL: vm.webview?.getURL(),
      newURL: newURL,
    });
    return true;
  }

  return false;
}

/**
 * Load the following page and wait for following users to appear
 * @returns true if an error was triggered, false otherwise
 */
export async function unfollowEveryoneLoadPage(
  vm: XViewModel,
): Promise<boolean> {
  vm.log("unfollowEveryoneLoadPage", "loading following page");
  let tries: number, success: boolean;
  let error: Error | null = null;
  let errorType: AutomationErrorType =
    AutomationErrorType.x_runJob_unfollowEveryone_OtherError;
  let newURL: string = "";

  const followingURL = `https://x.com/${vm.account.xAccount?.username}/following`;

  success = false;
  for (tries = 0; tries < 3; tries++) {
    await vm.loadURLWithRateLimit(followingURL);

    // If no following users appear in two seconds, there are no following users
    try {
      await vm.waitForSelector(
        'div[data-testid="cellInnerDiv"] button button',
        followingURL,
        2000,
      );
    } catch (e) {
      if (e instanceof TimeoutError) {
        // Were we rate limited?
        vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
        if (vm.rateLimitInfo.isRateLimited) {
          await vm.waitForRateLimit();
        } else {
          // There are no following users
          await vm.waitForLoadingToFinish();
          vm.progress.isUnfollowEveryoneFinished = true;
          await vm.syncProgress();
          return false;
        }
      } else if (e instanceof URLChangedError) {
        newURL = vm.webview?.getURL() || "";
        error = e;
        errorType = AutomationErrorType.x_runJob_deleteDMs_URLChanged;
        vm.log("unfollowEveryoneLoadPage", ["URL changed", newURL]);
        await vm.sleep(1000);
        continue;
      } else {
        error = e as Error;
        vm.log("unfollowEveryoneLoadPage", ["other error", e]);
        await vm.sleep(1000);
        continue;
      }
    }

    success = true;
    break;
  }

  if (!success) {
    await vm.error(errorType, {
      error: formatError(error as Error),
      currentURL: vm.webview?.getURL(),
      newURL: newURL,
    });
    return true;
  }

  return false;
}
