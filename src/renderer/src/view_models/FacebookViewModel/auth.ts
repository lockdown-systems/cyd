import type { FacebookViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import * as Helpers from "./helpers";

const FACEBOOK_HOME_URL = "https://www.facebook.com/";

export async function login(vm: FacebookViewModel): Promise<void> {
  vm.showBrowser = true;
  vm.showAutomationNotice = false;

  vm.log("login", "logging in");

  // Load the home page
  await vm.loadURL(FACEBOOK_HOME_URL);

  // Wait for login
  await vm.waitForFacebookLogin();

  // Capture identity from the page
  await vm.captureIdentityFromPage();

  vm.log("login", "login succeeded");
  vm.showAutomationNotice = true;

  await window.electron.trackEvent(
    PlausibleEvents.FACEBOOK_USER_SIGNED_IN,
    navigator.userAgent,
  );
}

export async function runJobLogin(
  vm: FacebookViewModel,
  jobIndex: number,
): Promise<void> {
  await window.electron.trackEvent(
    PlausibleEvents.FACEBOOK_JOB_STARTED_LOGIN,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = vm.t("viewModels.facebook.auth.checkingLogin");

  vm.showAutomationNotice = false;
  await login(vm);

  await Helpers.finishJob(vm, jobIndex);
}
