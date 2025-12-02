import type { WebviewTag } from "electron";
import type { Emitter, EventType } from "mitt";
import type { Account } from "../../../../shared_types";
import { BaseViewModel } from "../BaseViewModel";
import { PlatformStates } from "../../types/PlatformStates";

const FACEBOOK_LOGIN_STATE = PlatformStates.Login;
const FACEBOOK_WIZARD_DASHBOARD = PlatformStates.FacebookWizardDashboard;
const FACEBOOK_WIZARD_DASHBOARD_DISPLAY =
  PlatformStates.FacebookWizardDashboardDisplay;
const FACEBOOK_HOME_URL = "https://www.facebook.com/";

interface CurrentUserInitialData {
  ACCOUNT_ID: string;
  NAME: string;
  [key: string]: unknown;
}

function findCurrentUserInitialData(
  data: unknown,
): CurrentUserInitialData | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (Array.isArray(item) && item[0] === "CurrentUserInitialData") {
        if (
          item[2] &&
          typeof item[2] === "object" &&
          "ACCOUNT_ID" in item[2] &&
          "NAME" in item[2]
        ) {
          return item[2] as CurrentUserInitialData;
        }
      }
      const result = findCurrentUserInitialData(item);
      if (result) {
        return result;
      }
    }
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const result = findCurrentUserInitialData(obj[key]);
        if (result) {
          return result;
        }
      }
    }
  }
  return null;
}

function findProfilePictureURI(data: unknown): string | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const result = findProfilePictureURI(item);
      if (result) return result;
    }
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    if (obj.actor && typeof obj.actor === "object") {
      const actor = obj.actor as Record<string, unknown>;
      if (
        actor.__typename === "User" &&
        actor.profile_picture &&
        typeof actor.profile_picture === "object"
      ) {
        const profilePicture = actor.profile_picture as Record<string, unknown>;
        if (typeof profilePicture.uri === "string") {
          return profilePicture.uri;
        }
      }
    }

    for (const key of Object.keys(obj)) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const result = findProfilePictureURI(obj[key]);
        if (result) return result;
      }
    }
  }
  return null;
}

export class FacebookViewModel extends BaseViewModel {
  public progress: null = null;
  public jobs: unknown[] = [];

  constructor(
    account: Account,
    emitter: Emitter<Record<EventType, unknown>> | null,
  ) {
    super(account, emitter);
    this.state = this.hasStoredIdentity()
      ? FACEBOOK_WIZARD_DASHBOARD
      : FACEBOOK_LOGIN_STATE;
  }

  async init(webview: WebviewTag) {
    await super.init(webview);
  }

  async run() {
    switch (this.state) {
      case PlatformStates.Login:
        await this.handleLogin();
        break;
      case FACEBOOK_WIZARD_DASHBOARD:
        await this.showDashboard();
        break;
      case FACEBOOK_WIZARD_DASHBOARD_DISPLAY:
        this.showBrowser = false;
        await this.sleep(500);
        break;
      default:
        this.state = this.hasStoredIdentity()
          ? FACEBOOK_WIZARD_DASHBOARD
          : FACEBOOK_LOGIN_STATE;
        break;
    }
  }

  private hasStoredIdentity(): boolean {
    return Boolean(this.account.facebookAccount?.accountID);
  }

  private async handleLogin() {
    this.showBrowser = true;
    this.showAutomationNotice = false;
    this.instructions = `Hello, friend! My name is **Cyd**. I can help you delete all of the posts from your Facebook wall.

# To get started, log in to your Facebook account below.`;

    await this.loadURL(FACEBOOK_HOME_URL);
    await this.waitForFacebookLogin();
    await this.captureIdentityFromPage();

    this.showBrowser = false;
    this.instructions = "";
    this.state = FACEBOOK_WIZARD_DASHBOARD;
  }

  private async waitForFacebookLogin() {
    while (true) {
      if (await this.isLoggedIn()) {
        return;
      }
      await this.sleep(1500);
    }
  }

  private async isLoggedIn(): Promise<boolean> {
    const webview = this.getWebview();
    if (!webview) {
      return false;
    }

    return Boolean(
      await webview.executeJavaScript(`
        (() => {
          return document.cookie
            .split(';')
            .some((c) => c.trim().startsWith('c_user='));
        })()
      `),
    );
  }

  private async captureIdentityFromPage() {
    await this.waitForLoadingToFinish();
    const facebookData = await this.getFacebookDataFromHTML();
    const identity = findCurrentUserInitialData(facebookData);
    const profilePictureURI = findProfilePictureURI(facebookData);

    if (!this.account.facebookAccount) {
      return;
    }

    if (identity) {
      this.account.facebookAccount.username =
        identity.NAME || this.account.facebookAccount.username;
      this.account.facebookAccount.accountID = identity.ACCOUNT_ID;
    }

    if (profilePictureURI) {
      this.account.facebookAccount.profileImageDataURI = profilePictureURI;
    }

    await window.electron.database.saveAccount(JSON.stringify(this.account));
  }

  private async getFacebookDataFromHTML(): Promise<unknown[]> {
    const webview = this.getWebview();
    if (!webview) {
      return [];
    }

    const data = await webview.executeJavaScript(`
      (() => {
        const json = [];
        const scripts = document.querySelectorAll('script[type="application/json"]');
        for (const script of scripts) {
          try {
            const parsed = JSON.parse(script.textContent || "null");
            json.push(parsed);
          } catch (e) {
            console.error('Failed to parse Facebook JSON', e);
          }
        }
        return json;
      })()
    `);

    return Array.isArray(data) ? data : [];
  }

  private async showDashboard() {
    this.showBrowser = false;
    this.instructions = `# It's _your_ data. What do you want to do with it?`;
    await this.loadBlank();
    this.state = FACEBOOK_WIZARD_DASHBOARD_DISPLAY;
  }
}
