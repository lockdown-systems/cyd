import type { XViewModel } from "./view_model";
import { InternetDownError, URLChangedError } from "../BaseViewModel";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import { emptyXRateLimitInfo } from "../../../../shared_types";

export async function waitForRateLimit(vm: XViewModel): Promise<void> {
  vm.log("waitForRateLimit", vm.rateLimitInfo);

  let seconds = 0;
  if (vm.rateLimitInfo.rateLimitReset) {
    seconds = vm.rateLimitInfo.rateLimitReset - Math.floor(Date.now() / 1000);
  }
  await vm.sleep(seconds * 1000);
  vm.log("waitForRateLimit", "finished waiting for rate limit");

  // Reset the rate limit checker
  await window.electron.X.resetRateLimitInfo(vm.account.id);
  vm.rateLimitInfo = emptyXRateLimitInfo();

  // Wait for the user to unpause.
  // This is important because if the computer sleeps and autopauses during a rate limit, this will
  // continue to wait until after the computer wakes up.
  await vm.waitForPause();
  vm.log("waitForRateLimit", "finished waiting for pause");
}

export async function loadURLWithRateLimit(
  vm: XViewModel,
  url: string,
  expectedURLs: (string | RegExp)[] = [],
  redirectOk: boolean = false,
): Promise<void> {
  vm.log("loadURLWithRateLimit", [url, expectedURLs, redirectOk]);

  while (true) {
    // Reset the rate limit checker
    await window.electron.X.resetRateLimitInfo(vm.account.id);

    // Load the URL
    try {
      await vm.loadURL(url);
      vm.log("loadURLWithRateLimit", "URL loaded successfully");
    } catch (e) {
      if (e instanceof InternetDownError) {
        vm.log("loadURLWithRateLimit", "internet is down");
        vm.emitter?.emit(`cancel-automation-${vm.account.id}`);
      } else {
        await vm.error(
          AutomationErrorType.x_loadURLError,
          {
            url: url,
            error: formatError(e as Error),
          },
          {
            currentURL: vm.webview?.getURL(),
          },
        );
      }
      break;
    }

    // Did the URL change?
    if (!redirectOk) {
      vm.log("loadURLWithRateLimit", "checking if URL changed");
      const newURL = new URL(vm.webview?.getURL() || "");
      const originalURL = new URL(url);
      // Check if the URL has changed, ignoring query strings
      // e.g. a change from https://x.com/login to https://x.com/login?mx=2 is ok
      if (
        newURL.origin + newURL.pathname !==
        originalURL.origin + originalURL.pathname
      ) {
        let changedToUnexpected = true;
        for (const expectedURL of expectedURLs) {
          if (
            typeof expectedURL === "string" &&
            newURL.toString().startsWith(expectedURL)
          ) {
            changedToUnexpected = false;
            break;
          } else if (
            expectedURL instanceof RegExp &&
            expectedURL.test(newURL.toString())
          ) {
            changedToUnexpected = false;
            break;
          }
        }

        if (changedToUnexpected) {
          // Quit early if canceled
          if (vm.cancelWaitForURL) {
            vm.log(
              "loadURLWithRateLimit",
              `UNEXPECTED, URL change to ${vm.webview?.getURL()}, but ignoring because canceled`,
            );
            break;
          }

          vm.log(
            "loadURLWithRateLimit",
            `UNEXPECTED, URL change to ${vm.webview?.getURL()}`,
          );
          throw new URLChangedError(url, vm.webview?.getURL() || "");
        } else {
          vm.log(
            "loadURLWithRateLimit",
            `expected, URL change to ${vm.webview?.getURL()}`,
          );
        }
      }
    }

    // Were we rate limited?
    vm.rateLimitInfo = await window.electron.X.isRateLimited(vm.account.id);
    if (vm.rateLimitInfo.isRateLimited) {
      await vm.waitForRateLimit();
      vm.log(
        "loadURLWithRateLimit",
        "waiting for rate limit finished, trying to load the URL again",
      );
      // Continue on the next iteration of the loop to try again
      continue;
    }

    // Finished successfully so break out of the loop
    vm.log("loadURLWithRateLimit", "finished loading URL");
    break;
  }
}
