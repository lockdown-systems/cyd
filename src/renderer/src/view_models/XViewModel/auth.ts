import type { XViewModel } from "./view_model";
import { State } from "./types";
import { URLChangedError } from "../BaseViewModel";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import type { XUserInfo } from "../../types_x";

export async function login(vm: XViewModel): Promise<void> {
  vm.showBrowser = true;

  vm.log("login", "logging in");

  // Load the login page and wait for it to redirect to home
  await vm.loadURLWithRateLimit("https://x.com/login", [
    "https://x.com/home",
    "https://x.com/i/flow/login",
  ]);
  if (vm.cancelWaitForURL) {
    // If the user clicks archive only before the page is done loading, we cancel the login
    vm.log("login", "Login cancelled");
    return;
  }
  try {
    await vm.waitForURL("https://x.com/home");
    if (vm.cancelWaitForURL) {
      // If the user clicks archive only after the page is done loading, while we're waiting for the URL to change
      vm.log("login", "Login cancelled");
      return;
    }
  } catch (e) {
    if (e instanceof URLChangedError) {
      await vm.error(
        AutomationErrorType.X_login_URLChanged,
        {
          error: formatError(e as Error),
        },
        {
          currentURL: vm.webview?.getURL(),
        },
      );
    } else {
      await vm.error(
        AutomationErrorType.X_login_WaitingForURLFailed,
        {
          error: formatError(e as Error),
        },
        {
          currentURL: vm.webview?.getURL(),
        },
      );
    }
  }

  // We're logged in
  vm.log("login", "login succeeded");
  vm.showAutomationNotice = true;
  await vm.sleep(1000);

  // If this is the first time we're logging in, track it
  if (vm.state === State.Login) {
    await window.electron.trackEvent(
      PlausibleEvents.X_USER_SIGNED_IN,
      navigator.userAgent,
    );
  }

  await vm.waitForPause();

  // Load home
  vm.log("login", "getting username and userID and profile picture");
  vm.instructions = `I'm discovering your username and profile picture...`;

  if (vm.webview?.getURL() != "https://x.com/home") {
    await vm.loadURLWithRateLimit("https://x.com/home");
  }

  // See if cookie overlay is present, and if so click "Refuse non-essential cookies"
  if (await vm.doesSelectorExist('div[data-testid="BottomBar"]')) {
    await vm.scriptClickElementWithinElementLast(
      'div[data-testid="BottomBar"]',
      "button",
    );
    await vm.sleep(500);
    await vm.scriptClickElementWithinElementLast(
      'div[data-testid="BottomBar"]',
      "button",
    );
  }

  const userInfo: XUserInfo | null = await vm.graphqlGetViewerUser();
  if (userInfo === null) {
    await vm.error(AutomationErrorType.X_login_GetViewerUserFailed, {
      error: "userInfo is null",
    });
    return;
  }

  // Save the user information
  if (vm.account && vm.account.xAccount) {
    vm.account.xAccount.username = userInfo.username;
    vm.account.xAccount.userID = userInfo.userID;
    vm.account.xAccount.bio = userInfo.bio;
    vm.account.xAccount.profileImageDataURI = userInfo.profileImageDataURI;
    vm.account.xAccount.followersCount = userInfo.followersCount;
    vm.account.xAccount.followingCount = userInfo.followingCount;
    vm.account.xAccount.tweetsCount = userInfo.tweetsCount;
    vm.account.xAccount.likesCount = userInfo.likesCount;
  }
  await window.electron.database.saveAccount(JSON.stringify(vm.account));
  vm.log("login", ["saved user information", userInfo]);

  // Tell XView to reload mediaPath, now that we have a username
  vm.emitter?.emit(`x-reload-media-path-${vm.account.id}`);

  await vm.waitForPause();
}

export async function loadUserStats(vm: XViewModel): Promise<void> {
  vm.log("loadUserStats", "loading user stats");
  vm.showBrowser = true;
  vm.showAutomationNotice = true;

  vm.log("login", "getting user stats");
  vm.instructions = `I'm trying to determine your total tweets and likes, according to X...`;

  await vm.login();
  await window.electron.X.setConfig(vm.account.id, "reloadUserStats", "false");

  await vm.waitForPause();
}
