import type { FacebookViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import * as Helpers from "./helpers";

const FACEBOOK_HOME_URL = "https://www.facebook.com/";

export async function login(vm: FacebookViewModel): Promise<boolean> {
  vm.showBrowser = true;
  vm.showAutomationNotice = false;

  vm.log("login", "logging in");

  // Load the home page
  try {
    await vm.loadURL(FACEBOOK_HOME_URL);
  } catch (error) {
    await vm.error(
      AutomationErrorType.facebook_login_LoadFailed,
      {
        url: FACEBOOK_HOME_URL,
        error: formatError(error as Error),
      },
      {
        currentURL: vm.webview?.getURL(),
      },
    );
    return false;
  }

  // Wait for login
  try {
    await vm.waitForFacebookLogin();
  } catch (error) {
    await vm.error(
      AutomationErrorType.facebook_login_WaitForLoginTimeout,
      {
        timeoutMs: 120000,
        error: formatError(error as Error),
      },
      {
        currentURL: vm.webview?.getURL(),
      },
    );
    return false;
  }

  // Capture identity from the page
  try {
    await vm.captureIdentityFromPage();
  } catch (error) {
    await vm.error(
      AutomationErrorType.facebook_login_CaptureIdentityFailed,
      {
        error: formatError(error as Error),
      },
      {
        currentURL: vm.webview?.getURL(),
      },
    );
    return false;
  }

  vm.log("login", "login succeeded");
  vm.showAutomationNotice = true;

  await window.electron.trackEvent(
    PlausibleEvents.FACEBOOK_USER_SIGNED_IN,
    navigator.userAgent,
  );

  return true;
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
  const loggedIn = await login(vm);
  if (!loggedIn) {
    await Helpers.errorJob(vm, jobIndex);
    return;
  }

  await Helpers.finishJob(vm, jobIndex);
}
