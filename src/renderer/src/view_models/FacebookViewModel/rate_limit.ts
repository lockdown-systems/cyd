import type { FacebookViewModel } from "./view_model";
import { emptyFacebookRateLimitInfo } from "../../../../shared_types";

export async function waitForRateLimit(vm: FacebookViewModel): Promise<void> {
  vm.log("waitForRateLimit", vm.rateLimitInfo);

  let seconds = 0;
  if (vm.rateLimitInfo.rateLimitReset) {
    seconds = vm.rateLimitInfo.rateLimitReset - Math.floor(Date.now() / 1000);
  }

  // If seconds is negative or 0, but we are rate limited, wait a default amount (e.g. 1 minute)
  // or maybe the reset time was in the past.
  if (seconds <= 0) {
    seconds = 60;
  }

  vm.log("waitForRateLimit", `Waiting for ${seconds} seconds`);
  await vm.sleep(seconds * 1000);
  vm.log("waitForRateLimit", "finished waiting for rate limit");

  // Reset the rate limit checker
  await window.electron.Facebook.resetRateLimitInfo(vm.account.id);
  vm.rateLimitInfo = emptyFacebookRateLimitInfo();

  // Wait for the user to unpause.
  // This is important because if the computer sleeps and autopauses during a rate limit, this will
  // continue to wait until after the computer wakes up.
  await vm.waitForPause();
  vm.log("waitForRateLimit", "finished waiting for pause");
}

export async function checkRateLimit(vm: FacebookViewModel): Promise<boolean> {
  vm.rateLimitInfo = await window.electron.Facebook.isRateLimited(
    vm.account.id,
  );
  if (vm.rateLimitInfo.isRateLimited) {
    await waitForRateLimit(vm);
    return true;
  }
  return false;
}
