import type { Emitter, EventType } from "mitt";
import type { Account, BlueskyLocalAccount } from "../../../../shared_types";
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
 * Connecting an identity arrives in #674; saving and browsing arrive in #676
 * and #677.
 */
export class BlueskyViewModel extends BaseViewModel {
  public progress: BlueskyProgress = emptyBlueskyProgress();
  public jobs: BlueskyJob[] = [];

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
}
