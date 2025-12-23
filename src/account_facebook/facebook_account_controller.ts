import path from "path";

import type { OnSendHeadersListenerDetails } from "electron";
import log from "electron-log/main";
import Database from "better-sqlite3";

import { getAccountDataPath } from "../util";
import {
  FacebookAccount,
  FacebookJob,
  FacebookProgress,
  emptyFacebookProgress,
  FacebookProgressInfo,
} from "../shared_types";
import {
  runMigrations,
  getAccount,
  deleteConfig as globalDeleteConfig,
  deleteConfigLike as globalDeleteConfigLike,
} from "../database";
import { IMITMController } from "../mitm";
import { BaseAccountController } from "../shared/controllers/BaseAccountController";
import { FacebookJobRow } from "./types";

// Controller modules
import * as Stats from "./controller/stats";
import * as Jobs from "./controller/jobs";
import { migrations } from "./controller/migrations";

export class FacebookAccountController extends BaseAccountController<FacebookProgress> {
  // Making this public so it can be accessed in tests
  public account: FacebookAccount | null = null;

  protected cookies: Record<string, Record<string, string>> = {};

  constructor(accountID: number, mitmController: IMITMController) {
    super(accountID, mitmController);
    // Initialize progress with Facebook-specific type
    this.progress = emptyFacebookProgress();
  }

  protected getAccountType(): string {
    return "Facebook";
  }

  protected getAccountProperty(): unknown {
    const account = getAccount(this.accountID);
    return account?.facebookAccount;
  }

  protected getAccountDataPath(): string {
    if (!this.account) {
      return "";
    }
    // Use accountID + username for folder name to make it unique
    const folderName = this.account.accountID
      ? `${this.account.accountID} ${this.account.username}`
      : this.account.username;
    return getAccountDataPath("Facebook", folderName);
  }

  protected handleCookieTracking(details: OnSendHeadersListenerDetails): void {
    // Keep track of cookies
    if (details.requestHeaders) {
      const hostname = new URL(details.url).hostname;
      const cookieHeader = details.requestHeaders["Cookie"];
      if (cookieHeader) {
        const cookies = cookieHeader.split(";");
        cookies.forEach((cookie: string) => {
          const parts = cookie.split("=");
          if (parts.length == 2) {
            if (!this.cookies[hostname]) {
              this.cookies[hostname] = {};
            }
            this.cookies[hostname][parts[0].trim()] = parts[1].trim();
          }
        });
      }
    }
  }

  protected getMITMURLs(): string[] {
    // Facebook doesn't currently use MITM interception
    return [];
  }

  refreshAccount() {
    super.refreshAccount();
    // Load the Facebook account after base refresh
    const account = getAccount(this.accountID);
    this.account = account?.facebookAccount || null;
  }

  initDB() {
    // Ensure account is loaded before initializing database
    if (!this.account) {
      this.refreshAccount();
    }

    if (!this.account) {
      log.error("FacebookAccountController.initDB: account does not exist");
      return;
    }

    log.info("FacebookAccountController.initDB: account", this.account);

    // Set the account data path (directory, not file)
    this.accountDataPath = this.getAccountDataPath();
    if (!this.accountDataPath) {
      log.error("FacebookAccountController.initDB: accountDataPath is empty");
      return;
    }

    log.info(
      `FacebookAccountController.initDB: accountDataPath=${this.accountDataPath}`,
    );

    // Build the database file path
    const dbPath = path.join(this.accountDataPath, "data.sqlite3");

    // Initialize the database using the file path
    log.info(`FacebookAccountController.initDB: dbPath=${dbPath}`);
    this.db = new Database(dbPath, {});
    this.db.pragma("journal_mode = WAL");
    runMigrations(this.db, migrations);
    log.info("FacebookAccountController.initDB: database initialized");
  }

  // Convert database row to FacebookJob
  convertFacebookJobRowToFacebookJob = (row: FacebookJobRow): FacebookJob => {
    return {
      id: row.id,
      jobType: row.jobType,
      status: row.status,
      scheduledAt: new Date(row.scheduledAt),
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      finishedAt: row.finishedAt ? new Date(row.finishedAt) : null,
      progressJSON: row.progressJSON || "",
      error: row.error,
    };
  };

  // Job management
  createJobs(jobTypes: string[]): FacebookJob[] {
    return Jobs.createJobs(this, jobTypes);
  }

  async getLastFinishedJob(jobType: string): Promise<FacebookJob | null> {
    return Jobs.getLastFinishedJob(this, jobType);
  }

  // Progress info for API reporting
  async getProgressInfo(): Promise<FacebookProgressInfo> {
    return Stats.getProgressInfo(this);
  }

  // Config management - inherits from BaseAccountController
  // getConfig, setConfig are already available

  async deleteConfig(key: string): Promise<void> {
    if (!this.db) {
      this.initDB();
    }
    globalDeleteConfig(key, this.db);
  }

  async deleteConfigLike(key: string): Promise<void> {
    if (!this.db) {
      this.initDB();
    }
    globalDeleteConfigLike(key, this.db);
  }

  // Increment the total wall posts deleted counter
  async incrementTotalWallPostsDeleted(count: number): Promise<void> {
    const currentValue = await this.getConfig("totalWallPostsDeleted");
    const newValue = (currentValue ? parseInt(currentValue) : 0) + count;
    await this.setConfig("totalWallPostsDeleted", newValue.toString());
  }
}
