import type { Emitter, EventType } from "mitt";
import {
  blueskyOAuthCallbackEventName,
  type Account,
  type BlueskyConnectStart,
  type BlueskyIdentityProfile,
  type BlueskyLocalAccount,
} from "../../../../shared_types";
import { BaseViewModel } from "../BaseViewModel";
import { AutomationErrorType } from "../../automation_errors";
import {
  State,
  BlueskyJob,
  BlueskyProgress,
  emptyBlueskyProgress,
} from "./types";
import { blueskyDiagnostic } from "./diagnostics";

/**
 * Renderer-side owner of one Bluesky local account's view state.
 *
 * Bluesky uses the AT Protocol directly, so this view model never drives an
 * embedded browser: there is no login page to automate and no page to scrape.
 * Every call into the account's local resources goes through the Bluesky IPC
 * boundary, so the renderer never touches storage itself.
 *
 * The dashboard is reachable with no Bluesky connection and no saved data.
 * Saving and browsing arrive in #676 and #677.
 */
export class BlueskyViewModel extends BaseViewModel {
  public progress: BlueskyProgress = emptyBlueskyProgress();
  public jobs: BlueskyJob[] = [];

  /** The identity's current profile, once this account is connected to one. */
  public profile: BlueskyIdentityProfile | null = null;

  /** The last connection failure, to show beside the handle field. */
  public connectError: string = "";

  constructor(
    account: Account,
    emitter: Emitter<Record<EventType, unknown>> | null,
  ) {
    super(account, emitter);
    this.state = State.BlueskyWizardDashboard;
  }

  /**
   * An automatic Bluesky error report names no account: a handle and a DID both
   * identify a person, and neither belongs in one. Spelled out rather than left
   * to the core's default, so that adding a label here is a deliberate choice
   * against the ADR rather than an oversight.
   *
   * See docs/adr/0029-minimize-bluesky-diagnostics.md.
   */
  protected get errorReportAccountLabel(): string {
    return "";
  }

  /** This installation's local representation of the Bluesky identity. */
  get localAccount(): BlueskyLocalAccount | null {
    return this.account.blueskyLocalAccount;
  }

  /**
   * Whether this installation is authorized to act on the identity right now.
   *
   * A Bluesky local account keeps its DID after disconnecting, because that
   * DID is how an archive import recognizes the identity again. Being
   * connected is the separate, reversible fact.
   */
  get isConnected(): boolean {
    return Boolean(this.localAccount?.connectedAt);
  }

  /** The renderer event this account's own authorization comes back on. */
  get oauthCallbackEventName(): string {
    return blueskyOAuthCallbackEventName({
      platform: "Bluesky",
      accountID: this.account.id,
    });
  }

  /**
   * Prepare the account for use. Local storage that cannot be opened is
   * reported and does not stop the dashboard: a person must still be able to
   * see the account and remove it.
   */
  async init(): Promise<void> {
    this.showBrowser = false;
    this.showAutomationNotice = false;
    this.state = State.BlueskyWizardDashboard;

    try {
      await this.openLocalAccount();
      await this.clearStagingAreas();
      await this.refreshProfile();
    } catch (e) {
      await this.error(
        AutomationErrorType.bluesky_openLocalAccountError,
        blueskyDiagnostic(e, { state: this.state }),
        null,
        true,
      );
    }
  }

  /**
   * Open this account's private local storage, creating it on first use, and
   * pick up whatever profile it already captured.
   */
  async openLocalAccount(): Promise<void> {
    const localAccount = await window.electron.Bluesky.openLocalAccount(
      this.account.id,
    );
    if (localAccount) {
      this.account.blueskyLocalAccount = localAccount;
    }
    this.log("openLocalAccount", "local storage ready");
  }

  /**
   * Discard staged work left behind by a job that failed or was cancelled in
   * an earlier session. Saved data is untouched.
   */
  private async clearStagingAreas(): Promise<void> {
    await window.electron.Bluesky.clearStagingAreas(this.account.id);
  }

  /**
   * Start a browser authorization for a handle.
   *
   * Cyd shares one Bluesky OAuth implementation and one DID-keyed session
   * store across platforms, so an identity already authorized through the X
   * migration wizard connects here without a second browser sign-in.
   * Authorization is OAuth against the identity's own PDS, never an app
   * password.
   */
  async connect(handle: string): Promise<BlueskyConnectStart> {
    this.connectError = "";
    try {
      const started = await window.electron.Bluesky.connect(
        this.account.id,
        handle,
      );
      if (started.status === "error") {
        this.connectError = started.error;
      } else if (started.status === "reused") {
        // The identity was already authorized, so it is connected already and
        // there is no callback to wait for.
        await this.reloadLocalAccount();
        await this.refreshProfile();
      }
      return started;
    } catch (e) {
      await this.error(
        AutomationErrorType.bluesky_connectError,
        blueskyDiagnostic(e, { state: this.state }),
        null,
        true,
      );
      this.connectError = `${e}`;
      return { status: "error", error: `${e}` };
    }
  }

  /**
   * Finish an authorization that came back from the browser, binding the
   * identity and taking its current profile.
   */
  async completeConnection(queryString: string): Promise<boolean> {
    this.connectError = "";
    try {
      const result = await window.electron.Bluesky.completeConnection(
        this.account.id,
        queryString,
      );
      if (result !== true) {
        this.connectError = result;
        return false;
      }
      await this.reloadLocalAccount();
      await this.refreshProfile();
      return true;
    } catch (e) {
      await this.error(
        AutomationErrorType.bluesky_connectError,
        blueskyDiagnostic(e, { state: this.state }),
        null,
        true,
      );
      this.connectError = `${e}`;
      return false;
    }
  }

  /**
   * Remove this installation's authorization, keeping the local account and
   * all of its Bluesky saved data.
   *
   * Only this account's hold on the shared session is released. An X account
   * migrating to the same identity stays connected, and nothing here can sign
   * it out: there is no force-revoke to offer.
   */
  async disconnect(): Promise<void> {
    try {
      await window.electron.Bluesky.disconnect(this.account.id);
      this.profile = null;
      await this.reloadLocalAccount();
    } catch (e) {
      await this.error(
        AutomationErrorType.bluesky_disconnectError,
        blueskyDiagnostic(e, { state: this.state }),
        null,
        true,
      );
    }
  }

  /** Take the identity's current profile, if this account is connected. */
  async refreshProfile(): Promise<void> {
    if (!this.isConnected) {
      this.profile = null;
      return;
    }
    this.profile = await window.electron.Bluesky.getProfile(this.account.id);
    await this.reloadLocalAccount();
  }

  /** Pick up whatever the main process just recorded about this account. */
  private async reloadLocalAccount(): Promise<void> {
    const localAccount = await window.electron.Bluesky.openLocalAccount(
      this.account.id,
    );
    if (localAccount) {
      this.account.blueskyLocalAccount = localAccount;
    }
  }

  async run(): Promise<void> {
    this.resetLogs();
    this.log("run", `running state: ${this.state}`);

    try {
      switch (this.state) {
        case State.BlueskyWizardDashboard:
          await this.showDashboard();
          break;

        case State.BlueskyWizardDashboardDisplay:
          // The state loop stops on display states, so the dashboard stays put
          // until the person picks something to do.
          break;

        case State.BlueskyWizardConnect:
          await this.showConnect();
          break;

        case State.BlueskyWizardConnectDisplay:
          break;

        default:
          this.state = State.BlueskyWizardDashboard;
          break;
      }
    } catch (e) {
      await this.error(
        AutomationErrorType.bluesky_runError,
        blueskyDiagnostic(e, { state: this.state }),
      );
    }
  }

  private async showDashboard(): Promise<void> {
    this.showBrowser = false;
    this.instructions = this.t("viewModels.bluesky.wizard.dashboard");
    this.state = State.BlueskyWizardDashboardDisplay;
  }

  private async showConnect(): Promise<void> {
    this.showBrowser = false;
    this.instructions = this.t("viewModels.bluesky.wizard.connect");
    await this.refreshProfile();
    this.state = State.BlueskyWizardConnectDisplay;
  }
}
