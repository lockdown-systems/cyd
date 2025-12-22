import type { FacebookViewModel } from "./view_model";
import { RunJobsState } from "./types";
import * as Helpers from "./helpers";

const FACEBOOK_PROFILE_URL = "https://www.facebook.com/me/";

export async function runJobDeleteWallPosts(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  vm.runJobsState = RunJobsState.DeleteWallPosts;

  vm.showBrowser = true;
  vm.showAutomationNotice = true;
  vm.instructions = vm.t("viewModels.facebook.jobs.deletingWallPosts");

  vm.log("runJobDeleteWallPosts", "Loading profile page");

  await vm.waitForPause();

  // Load the user's profile page
  await vm.loadURL(FACEBOOK_PROFILE_URL);
  await vm.waitForLoadingToFinish();

  await vm.waitForPause();

  // Dev pause: wait to inspect the page
  await vm.sleep(2000);

  // For now, just log that we've loaded the page
  // The user will implement the actual deletion logic from here
  vm.log("runJobDeleteWallPosts", "Profile page loaded, ready for deletion");

  await vm.pause();
  await vm.waitForPause();

  await Helpers.finishJob(vm, jobIndex);
}
