import { session } from "electron";
import type { OnSendHeadersListenerDetails } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";
import { getAccount, exec, getConfig, setConfig } from "../../database";
import { IMITMController } from "../../mitm";
import type { PlatformJob } from "../../shared_types/common";

export abstract class BaseAccountController<TProgress = unknown> {
  accountUUID: string = "";
  protected accountID: number = 0;
  accountDataPath: string = "";
  thereIsMore: boolean = false;

  // Making this public so it can be accessed in tests
  public db: Database.Database | null = null;
  public mitmController: IMITMController;

  // Cookies can be flat (Record<string, string>) or nested (Record<string, Record<string, string>>)
  // depending on the subclass implementation
  protected cookies: Record<string, unknown> = {};

  // Progress tracking - each subclass specifies its specific progress type
  progress!: TProgress;

  constructor(accountID: number, mitmController: IMITMController) {
    this.mitmController = mitmController;
    this.accountID = accountID;
    this.refreshAccount();

    // Monitor web request metadata
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    ses.webRequest.onCompleted((_details) => {
      // TODO: Monitor for rate limits
    });

    ses.webRequest.onSendHeaders((details) => {
      this.handleCookieTracking(details);
    });
  }

  cleanup() {
    if (this.db) {
      this.db.pragma("wal_checkpoint(FULL)");
      this.db.close();
      this.db = null;
    }
  }

  protected abstract getAccountType(): string;
  protected abstract getAccountProperty(): unknown;
  protected abstract getAccountDataPath(): string;
  protected abstract handleCookieTracking(
    details: OnSendHeadersListenerDetails,
  ): void;
  protected abstract initDB(): void;
  /**
   * Returns the list of URL patterns to monitor for MITM interception.
   * Each platform has different API endpoints to intercept.
   */
  protected abstract getMITMURLs(): string[];

  refreshAccount() {
    // Load the account
    const account = getAccount(this.accountID);
    if (!account) {
      log.error(
        `${this.constructor.name}.refreshAccount: account ${this.accountID} not found`,
      );
      return;
    }

    // Make sure it's the correct account type
    if (account.type !== this.getAccountType()) {
      log.error(
        `${this.constructor.name}.refreshAccount: account ${this.accountID} is not a ${this.getAccountType()} account`,
      );
      return;
    }

    // Get the account UUID
    this.accountUUID = account.uuid;
    log.debug(
      `${this.constructor.name}.refreshAccount: accountUUID=${this.accountUUID}`,
    );

    // Load the account-specific data
    const accountData = this.getAccountProperty();
    if (!accountData) {
      log.error(
        `${this.constructor.name}.refreshAccount: ${this.getAccountType()} account ${this.accountID} not found`,
      );
      return;
    }
  }

  async syncProgress(progressJSON: string): Promise<void> {
    this.progress = JSON.parse(progressJSON) as TProgress;
  }

  async getProgress(): Promise<TProgress> {
    return this.progress;
  }

  updateJob(job: PlatformJob): void {
    if (!this.db) {
      this.initDB();
    }

    exec(
      this.db,
      "UPDATE job SET status = ?, startedAt = ?, finishedAt = ?, progressJSON = ?, error = ? WHERE id = ?",
      [
        job.status,
        job.startedAt ? job.startedAt : null,
        job.finishedAt ? job.finishedAt : null,
        job.progressJSON,
        job.error,
        job.id,
      ],
    );
  }

  async getConfig(key: string): Promise<string | null> {
    return getConfig(key, this.db);
  }

  async setConfig(key: string, value: string): Promise<void> {
    setConfig(key, value, this.db);
  }

  async indexStart(): Promise<void> {
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    await ses.clearCache();
    await this.mitmController.startMonitoring();
    await this.mitmController.startMITM(ses, this.getMITMURLs());
    this.thereIsMore = true;
  }

  async indexStop(): Promise<void> {
    await this.mitmController.stopMonitoring();
    const ses = session.fromPartition(`persist:account-${this.accountID}`);
    await this.mitmController.stopMITM(ses);
  }
}
