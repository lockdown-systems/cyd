import type { XViewModel } from "../view_model";
import { TimeoutError, URLChangedError } from "../../BaseViewModel";
import { AutomationErrorType } from "../../../automation_errors";
import { formatError } from "../../../util";
import { UNFOLLOW_BUTTON_SELECTOR } from "./helpers_shared";

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
      await vm.waitForSelector(UNFOLLOW_BUTTON_SELECTOR, followingURL, 2000);
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
        errorType = AutomationErrorType.x_runJob_unfollowEveryone_URLChanged;
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
