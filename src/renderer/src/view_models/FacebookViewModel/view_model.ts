import type { WebviewTag } from "electron";
import type { Emitter, EventType } from "mitt";
import type { Account } from "../../../../shared_types";
import { BaseViewModel } from "../BaseViewModel";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import { PlatformStates } from "../../types/PlatformStates";
import {
  State,
  RunJobsState,
  FacebookJob,
  FacebookJobType,
  FacebookProgress,
  FacebookViewModelState,
  emptyFacebookProgress,
} from "./types";
import * as AuthOps from "./auth";
import * as DeleteJobs from "./jobs_delete";
import * as LangJobs from "./jobs_lang";

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
  public progress: FacebookProgress = emptyFacebookProgress();
  public jobs: FacebookJob[] = [];
  public currentJobIndex: number = 0;

  // Track if user is in delete review mode
  public isDeleteReviewActive: boolean = false;

  constructor(
    account: Account,
    emitter: Emitter<Record<EventType, unknown>> | null,
  ) {
    super(account, emitter);
    this.state = this.hasStoredIdentity()
      ? State.FacebookWizardDashboard
      : State.Login;
  }

  async init(webview: WebviewTag) {
    if (
      this.account &&
      this.account.facebookAccount &&
      this.account.facebookAccount.accountID
    ) {
      this.state = State.FacebookWizardDashboard;
    } else {
      this.state = State.Login;
    }

    this.currentJobIndex = 0;

    await super.init(webview);
  }

  private hasStoredIdentity(): boolean {
    return Boolean(this.account.facebookAccount?.accountID);
  }

  async defineJobs(): Promise<void> {
    const jobTypes: FacebookJobType[] = [];

    // Always login first
    jobTypes.push("login");

    // Add delete jobs if enabled
    if (this.account.facebookAccount?.deleteWallPosts) {
      // Language jobs wrap around delete jobs:
      // 1. Save user's current language
      // 2. Set language to English (needed for automation)
      // 3. Delete wall posts
      // 4. Restore user's original language
      jobTypes.push("saveUserLang");
      jobTypes.push("setLangToEnglish");
      jobTypes.push("deleteWallPosts");
      jobTypes.push("restoreUserLang");
    }

    // Create jobs in the database and get them back with real IDs
    this.jobs = (await window.electron.Facebook.createJobs(
      this.account.id,
      jobTypes,
    )) as FacebookJob[];

    this.log("defineJobs", JSON.parse(JSON.stringify(this.jobs)));
  }

  async reset() {
    this.progress = emptyFacebookProgress();
    this.jobs = [];
    this.state = State.FacebookWizardDashboard;
  }

  async waitForFacebookLogin(): Promise<void> {
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

  async captureIdentityFromPage(): Promise<void> {
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

  async runJob(jobIndex: number): Promise<void> {
    this.runJobsState = RunJobsState.Default;

    // Reset logs before each job
    this.resetLogs();

    await this.waitForPause();

    // Start the job
    this.jobs[jobIndex].startedAt = new Date();
    this.jobs[jobIndex].status = "running";

    // Set the current job immediately
    this.progress.currentJob = this.jobs[jobIndex].jobType;

    this.log("runJob", `running job ${this.jobs[jobIndex].jobType}`);

    switch (this.jobs[jobIndex].jobType) {
      case "login":
        await AuthOps.runJobLogin(this, jobIndex);
        break;

      case "saveUserLang":
        await LangJobs.runJobSaveUserLang(this, jobIndex);

        // After saving the user's language, check if it's already English (US).
        // If so, we can skip the setLangToEnglish and restoreUserLang jobs entirely
        // since there's no need to change the language.
        //
        // How this works with the job loop:
        // The loop in run() iterates: for (let i = this.currentJobIndex; i < this.jobs.length; i++)
        // After this job completes (e.g., at index 1), the loop increments i to 2.
        // By removing setLangToEnglish (was index 2) and restoreUserLang (was index 4),
        // the jobs array shrinks and the next job (deleteWallPosts) shifts to index 2.
        // So when the loop continues with i=2, it correctly runs deleteWallPosts.
        //
        // Before removal: [login, saveUserLang, setLangToEnglish, deleteWallPosts, restoreUserLang]
        // After removal:  [login, saveUserLang(done), deleteWallPosts]
        if (
          this.account.facebookAccount?.userLang === LangJobs.DEFAULT_LANGUAGE
        ) {
          this.log(
            "runJob",
            "User language is already English (US), canceling setLangToEnglish and restoreUserLang jobs",
          );

          // Cancel these jobs in the database before removing from memory
          const jobsToCancel = this.jobs.filter(
            (job) =>
              job.jobType === "setLangToEnglish" ||
              job.jobType === "restoreUserLang",
          );

          for (const job of jobsToCancel) {
            job.status = "canceled";
            await window.electron.Facebook.updateJob(
              this.account.id,
              JSON.stringify(job),
            );
          }

          // Remove from in-memory array
          this.jobs = this.jobs.filter(
            (job) =>
              job.jobType !== "setLangToEnglish" &&
              job.jobType !== "restoreUserLang",
          );
        }
        break;

      case "setLangToEnglish":
        await LangJobs.runJobSetLangToEnglish(this, jobIndex);
        break;

      case "deleteWallPosts":
        await DeleteJobs.runJobDeleteWallPosts(this, jobIndex);
        break;

      case "restoreUserLang":
        await LangJobs.runJobRestoreUserLang(this, jobIndex);
        break;
    }
  }

  async run(): Promise<void> {
    // Reset logs before running any state
    this.resetLogs();

    this.log("run", `running state: ${this.state}`);
    try {
      switch (this.state) {
        case State.Login:
          await this.handleLogin();
          break;

        case State.FacebookWizardDashboard:
          await this.showDashboard();
          break;

        case State.FacebookWizardDashboardDisplay:
          await this.handleDashboardDisplay();
          break;

        case PlatformStates.WizardDeleteOptions:
          this.showBrowser = false;
          this.instructions = this.t(
            "viewModels.facebook.wizard.deleteOptions",
          );
          await this.loadBlank();
          this.state = PlatformStates.WizardDeleteOptionsDisplay;
          break;

        case PlatformStates.WizardCheckPremium:
          this.showBrowser = false;
          this.instructions = this.t("viewModels.facebook.wizard.checkPremium");
          await this.loadBlank();
          this.state = PlatformStates.WizardCheckPremiumDisplay;
          break;

        case PlatformStates.WizardReview:
          this.showBrowser = false;
          this.instructions = this.t("viewModels.facebook.wizard.review");
          await this.loadBlank();
          this.state = PlatformStates.WizardReviewDisplay;
          break;

        case PlatformStates.RunJobs:
          this.progress = emptyFacebookProgress();

          // Dismiss old error reports
          await window.electron.database.dismissNewErrorReports(
            this.account.id,
          );

          // Run all jobs
          for (let i = this.currentJobIndex; i < this.jobs.length; i++) {
            this.currentJobIndex = i;
            try {
              await this.runJob(i);
            } catch (e) {
              await this.error(
                AutomationErrorType.facebook_runJob_UnknownError,
                {
                  error: formatError(e as Error),
                },
              );
              break;
            }
          }
          this.currentJobIndex = 0;

          // Determine the next state
          this.state = PlatformStates.FinishedRunningJobs;
          this.showBrowser = false;
          await this.loadBlank();
          break;

        case PlatformStates.FinishedRunningJobs:
          this.showBrowser = false;
          this.instructions = this.t("viewModels.facebook.wizard.finishedJobs");
          await this.loadBlank();
          this.state = PlatformStates.FinishedRunningJobsDisplay;
          break;

        default:
          this.state = this.hasStoredIdentity()
            ? State.FacebookWizardDashboard
            : State.Login;
          break;
      }
    } catch (e) {
      await this.error(AutomationErrorType.facebook_runError, {
        error: formatError(e as Error),
        state: this.state,
        jobs: this.jobs,
        currentJobIndex: this.currentJobIndex,
      });
    }
  }

  private async handleLogin(): Promise<void> {
    this.showBrowser = true;
    this.showAutomationNotice = false;
    this.instructions = this.t("viewModels.facebook.wizard.login.instructions");

    await this.loadURL(FACEBOOK_HOME_URL);
    await this.waitForFacebookLogin();
    await this.captureIdentityFromPage();

    this.showBrowser = false;
    this.instructions = "";
    this.state = State.FacebookWizardDashboard;
  }

  private async showDashboard(): Promise<void> {
    this.showBrowser = false;
    this.instructions = this.t("viewModels.facebook.wizard.dashboard");
    await this.loadBlank();
    this.state = State.FacebookWizardDashboardDisplay;
  }

  private async handleDashboardDisplay(): Promise<void> {
    // Stay in dashboard display until user action
    await this.sleep(500);
  }

  saveState(): FacebookViewModelState {
    return {
      state: this.state,
      action: this.action,
      actionString: this.actionString,
      progress: this.progress,
      jobs: this.jobs,
      currentJobIndex: this.currentJobIndex,
    };
  }

  restoreState(state: FacebookViewModelState): void {
    this.state = state.state;
    this.action = state.action;
    this.actionString = state.actionString;
    this.progress = state.progress;
    this.jobs = state.jobs;
    this.currentJobIndex = state.currentJobIndex;
  }
}
