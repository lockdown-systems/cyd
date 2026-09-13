import type { Emitter, EventType } from "mitt";
import {
  blueskyOAuthCallbackEventName,
  blueskyPublicCategories,
  blueskySaveJobType,
  type Account,
  type BlueskyBrowsePage,
  type BlueskyCategory,
  type BlueskyCategorySettings,
  type BlueskyConnectStart,
  type BlueskyIdentityProfile,
  type BlueskyLocalAccount,
  type BlueskySavedDataSummary,
  type BlueskyStoragePreflight,
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

/** How often a running job's progress is read while it runs. */
const PROGRESS_POLL_MS = 500;

const emptyCategorySettings = (): BlueskyCategorySettings => ({
  posts: false,
  reposts: false,
  likes: false,
  bookmarks: false,
});

/**
 * Renderer-side owner of one Bluesky local account's view state.
 *
 * Bluesky uses the AT Protocol directly, so this view model never drives an
 * embedded browser: there is no login page to automate and no page to scrape.
 * Every call into the account's local resources goes through the Bluesky IPC
 * boundary, so the renderer never touches storage itself.
 *
 * The dashboard is reachable with no Bluesky connection and no saved data, and
 * so is every Browse view: reading what Cyd has saved needs neither an
 * authorization nor the network.
 */
export class BlueskyViewModel extends BaseViewModel {
  public progress: BlueskyProgress = emptyBlueskyProgress();
  public jobs: BlueskyJob[] = [];

  /** The identity's current profile, once this account is connected to one. */
  public profile: BlueskyIdentityProfile | null = null;

  /** The last connection failure, to show beside the handle field. */
  public connectError: string = "";

  /** Which categories this account saves. */
  public categorySettings: BlueskyCategorySettings = emptyCategorySettings();

  /** What a run over the chosen categories is expected to need on disk. */
  public preflight: BlueskyStoragePreflight | null = null;

  /** What this account has saved, and whether the backup is complete. */
  public savedData: BlueskySavedDataSummary | null = null;

  /** The category whose Browse view is open. */
  public browseCategory: BlueskyCategory = "posts";

  /** The Browse page currently open. */
  public browsePage: BlueskyBrowsePage | null = null;

  /**
   * Where the bytes of each saved asset on the open page are, by digest. A
   * Browse view reads media off this disk, so it needs paths and not URLs.
   */
  public browseMediaPaths: Record<string, string> = {};

  /** The last save failure, as a class of error and nothing more. */
  public saveError: string = "";

  /** Cursors of the older pages walked into, so going back is possible. */
  private browseCursors: string[] = [];

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
      await this.loadCategorySettings();
      await this.refreshSavedData();
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

  // Saving

  /** Pick up which categories this account saves. */
  async loadCategorySettings(): Promise<void> {
    this.categorySettings = await window.electron.Bluesky.getCategorySettings(
      this.account.id,
    );
  }

  /**
   * Turn a category on or off. Turning one off stops future collection and
   * never deletes anything already saved.
   */
  async setCategoryEnabled(
    category: BlueskyCategory,
    enabled: boolean,
  ): Promise<void> {
    await window.electron.Bluesky.setCategoryEnabled(
      this.account.id,
      category,
      enabled,
    );
    await this.loadCategorySettings();
  }

  get enabledCategories(): BlueskyCategory[] {
    return blueskyPublicCategories.filter(
      (category) => this.categorySettings[category],
    );
  }

  /**
   * Ask what the chosen categories are expected to need on disk.
   *
   * Most of the answer is an estimate, and the answer says so. A failure to
   * work it out is not a reason to block someone from saving, so it leaves the
   * report empty rather than raising.
   */
  async refreshPreflight(): Promise<void> {
    if (this.enabledCategories.length === 0) {
      this.preflight = null;
      return;
    }
    try {
      this.preflight = await window.electron.Bluesky.storagePreflight(
        this.account.id,
        this.enabledCategories,
      );
    } catch (e) {
      this.preflight = null;
      await this.error(
        AutomationErrorType.bluesky_saveError,
        blueskyDiagnostic(e, { state: this.state }),
        null,
        true,
      );
    }
  }

  /** Whether Cyd knows for certain that this run does not fit. */
  get storageIsInsufficient(): boolean {
    return this.preflight?.sufficiency === "insufficient";
  }

  /**
   * Start saving the chosen categories.
   *
   * One job per category, so a category that fails or is interrupted does not
   * take the others with it, and each one resumes on its own.
   */
  async startSaving(): Promise<void> {
    this.saveError = "";
    this.progress = emptyBlueskyProgress();

    const categories = this.enabledCategories;
    if (categories.length === 0 || this.storageIsInsufficient) {
      return;
    }

    this.jobs = await window.electron.Bluesky.createJobs(
      this.account.id,
      categories.map(blueskySaveJobType),
    );
    this.state = State.RunJobs;
  }

  /**
   * Run every pending save job to completion.
   *
   * A job that is rate limited is waiting, not stuck, and one that runs out of
   * disk or is cancelled keeps everything it saved: all of that is the engine's
   * to handle, so this only reports what came back.
   */
  async runJobs(): Promise<void> {
    // Running a job is one call that does not return until the job is done, so
    // how far it has got is read from the main process while it runs. Without
    // this, a long category — or one waiting out a rate limit — would look
    // like nothing happening.
    const poll = setInterval(() => {
      void this.refreshCollectionProgress();
    }, PROGRESS_POLL_MS);

    try {
      await this.runEachJob();
    } finally {
      clearInterval(poll);
    }

    this.jobs = await window.electron.Bluesky.getJobs(this.account.id);
    await this.refreshSavedData();
    this.state = State.FinishedRunningJobs;
  }

  private async runEachJob(): Promise<void> {
    for (const job of this.jobs) {
      if (job.id === null || job.status !== "pending") {
        continue;
      }

      this.progress.currentJob = job.jobType;
      try {
        const result = await window.electron.Bluesky.runJob(
          this.account.id,
          job.id,
        );
        this.progress.collection = result.progress;
        this.progress.recordsSaved += result.progress.recordsSaved;
        this.progress.mediaSaved += result.progress.mediaSaved;
        this.progress.mediaFailed += result.progress.mediaFailed;

        if (result.outcome === "outOfSpace") {
          this.saveError = "outOfSpace";
          break;
        }
        if (result.outcome === "cancelled") {
          break;
        }
        if (result.outcome === "failed") {
          // Only the class of error, never its message: a message can quote a
          // handle, a DID, record text, or a local path.
          this.saveError = result.errorClass ?? "failed";
        }
      } catch (e) {
        await this.error(
          AutomationErrorType.bluesky_saveError,
          blueskyDiagnostic(e, { state: this.state, jobType: job.jobType }),
          null,
          true,
        );
        this.saveError = "failed";
        break;
      }
    }
  }

  /** Pick up how far the running job has got, for the progress display. */
  async refreshCollectionProgress(): Promise<void> {
    const collection = await window.electron.Bluesky.getCollectionProgress(
      this.account.id,
    );
    if (collection) {
      this.progress.collection = collection;
    }
  }

  /** Ask the running job to stop. Everything saved so far stays saved. */
  async cancelSaving(): Promise<void> {
    await window.electron.Bluesky.cancelCollection(this.account.id);
  }

  // Browsing

  /** What this account has saved, and whether every expected asset is here. */
  async refreshSavedData(): Promise<void> {
    this.savedData = await window.electron.Bluesky.getSavedDataSummary(
      this.account.id,
    );
  }

  get hasSavedData(): boolean {
    return Boolean(
      this.savedData?.categories.some((each) => each.recordCount > 0),
    );
  }

  /**
   * Read one page of a category, newest first.
   *
   * This reads only local storage, so it works with no Bluesky connection and
   * no network at all.
   */
  async browse(
    category: BlueskyCategory,
    before: string | null = null,
  ): Promise<void> {
    if (category !== this.browseCategory) {
      this.browseCursors = [];
    }
    this.browseCategory = category;
    try {
      this.browsePage = await window.electron.Bluesky.browse(
        this.account.id,
        category,
        before,
      );
      await this.resolveBrowseMedia();
    } catch (e) {
      this.browsePage = null;
      await this.error(
        AutomationErrorType.bluesky_browseError,
        blueskyDiagnostic(e, { state: this.state }),
        null,
        true,
      );
    }
  }

  /** The next, older page. */
  async browseOlder(): Promise<void> {
    const cursor = this.browsePage?.nextCursor;
    if (!cursor) {
      return;
    }
    this.browseCursors.push(cursor);
    await this.browse(this.browseCategory, cursor);
  }

  /** Back to the newest page of the category being browsed. */
  async browseNewest(): Promise<void> {
    this.browseCursors = [];
    await this.browse(this.browseCategory);
  }

  get isBrowsingNewest(): boolean {
    return this.browseCursors.length === 0;
  }

  /**
   * Find where every asset on the open page is stored. Assets Cyd never
   * fetched have no path, which is what the page shows as absent.
   */
  private async resolveBrowseMedia(): Promise<void> {
    const digests = new Set<string>();
    for (const record of this.browsePage?.records ?? []) {
      const summaries = [
        record,
        ...(record.subject ? [record.subject] : []),
        ...record.context.flatMap((each) => (each.record ? [each.record] : [])),
      ];
      for (const summary of summaries) {
        for (const asset of summary.assets) {
          if (asset.digest) {
            digests.add(asset.digest);
          }
        }
        if (summary.author?.avatar?.digest) {
          digests.add(summary.author.avatar.digest);
        }
      }
    }

    const paths: Record<string, string> = {};
    for (const digest of digests) {
      const mediaPath = await window.electron.Bluesky.getMediaPath(
        this.account.id,
        digest,
      );
      if (mediaPath) {
        paths[digest] = mediaPath;
      }
    }
    this.browseMediaPaths = paths;
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

        case State.BlueskyWizardSave:
          await this.showSave();
          break;

        case State.BlueskyWizardSaveDisplay:
          break;

        case State.BlueskyWizardBrowse:
          await this.showBrowse();
          break;

        case State.BlueskyWizardBrowseDisplay:
          break;

        case State.RunJobs:
          await this.runJobs();
          break;

        case State.FinishedRunningJobs:
          this.showBrowser = false;
          this.instructions = this.t("viewModels.bluesky.wizard.finished");
          this.state = State.FinishedRunningJobsDisplay;
          break;

        case State.FinishedRunningJobsDisplay:
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

  private async showSave(): Promise<void> {
    this.showBrowser = false;
    this.instructions = this.t("viewModels.bluesky.wizard.save");
    await this.loadCategorySettings();
    await this.refreshPreflight();
    this.state = State.BlueskyWizardSaveDisplay;
  }

  private async showBrowse(): Promise<void> {
    this.showBrowser = false;
    this.instructions = this.t("viewModels.bluesky.wizard.browse");
    await this.refreshSavedData();
    await this.browse(this.browseCategory);
    this.state = State.BlueskyWizardBrowseDisplay;
  }
}
