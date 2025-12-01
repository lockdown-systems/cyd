import type { WebviewTag } from "electron";
import type { Emitter, EventType } from "mitt";
import type { Account } from "../../../../shared_types";
import { BaseViewModel } from "../BaseViewModel";
import { PlatformStates } from "../../types/PlatformStates";

const FACEBOOK_WIZARD_START = PlatformStates.WizardStart;
const FACEBOOK_WIZARD_DASHBOARD = PlatformStates.FacebookWizardDashboard;
const FACEBOOK_WIZARD_DASHBOARD_DISPLAY =
  PlatformStates.FacebookWizardDashboardDisplay;

export class FacebookViewModel extends BaseViewModel {
  public progress: null = null;
  public jobs: unknown[] = [];

  constructor(
    account: Account,
    emitter: Emitter<Record<EventType, unknown>> | null,
  ) {
    super(account, emitter);
    this.state = FACEBOOK_WIZARD_START;
  }

  async init(webview: WebviewTag) {
    this.state = FACEBOOK_WIZARD_START;
    await super.init(webview);
  }

  async run() {
    switch (this.state) {
      case FACEBOOK_WIZARD_START:
        this.showBrowser = false;
        await this.loadBlank();
        this.state = FACEBOOK_WIZARD_DASHBOARD;
        break;

      case FACEBOOK_WIZARD_DASHBOARD:
        this.showBrowser = false;
        this.instructions = "";
        await this.loadBlank();
        this.state = FACEBOOK_WIZARD_DASHBOARD_DISPLAY;
        break;

      case FACEBOOK_WIZARD_DASHBOARD_DISPLAY:
        this.showBrowser = false;
        await this.sleep(500);
        break;

      default:
        this.state = FACEBOOK_WIZARD_DASHBOARD_DISPLAY;
        break;
    }
  }
}
