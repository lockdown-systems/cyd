import { WebviewTag } from "electron";
import { BaseViewModel } from "../BaseViewModel";
import {
  ArchiveInfo,
  emptyArchiveInfo,
  XJob,
  XProgress,
  emptyXProgress,
  XTweetItem,
  XTweetItemArchive,
  XRateLimitInfo,
  emptyXRateLimitInfo,
  XProgressInfo,
  emptyXProgressInfo,
  XDatabaseStats,
  emptyXDatabaseStats,
  Account,
} from "../../../../shared_types";
import { XUserInfo } from "../../types_x";
import { AutomationErrorType } from "../../automation_errors";
import { getJobsType, formatError } from "../../util";
import { xHasSomeData } from "../../util_x";
import { State, RunJobsState, XViewModelState } from "./types";
import * as AuthOps from "./auth";
import * as GraphQLOps from "./graphql";
import * as RateLimitOps from "./rate_limit";
import * as Helpers from "./helpers";
import * as IndexJobs from "./jobs_index/index";
import * as DeleteJobs from "./jobs_delete/index";
import * as MigrateJobs from "./jobs_migrate_to_bluesky";
import * as TombstoneJobs from "./jobs_tombstone";

export class XViewModel extends BaseViewModel {
  public progress: XProgress = emptyXProgress();
  public rateLimitInfo: XRateLimitInfo = emptyXRateLimitInfo();
  public progressInfo: XProgressInfo = emptyXProgressInfo();
  public databaseStats: XDatabaseStats = emptyXDatabaseStats();
  public archiveInfo: ArchiveInfo = emptyArchiveInfo();
  public jobs: XJob[] = [];
  public currentJobIndex: number = 0;
  public currentTweetItem: XTweetItem | null = null;

  // This is used to track the user's progress through the wizard. If they want to review before
  // they delete, this lets them go back and change settings without starting over
  public isDeleteReviewActive: boolean = false;

  // Variables related to debugging
  public debugAutopauseEndOfStep: boolean = false;

  async init(webview: WebviewTag) {
    if (
      this.account &&
      this.account.xAccount &&
      this.account.xAccount.username
    ) {
      this.state = State.WizardPrestart;
    } else {
      this.state = State.Login;
    }

    this.currentJobIndex = 0;

    await this.refreshDatabaseStats();

    super.init(webview);
  }

  async refreshDatabaseStats() {
    this.databaseStats = await window.electron.X.getDatabaseStats(
      this.account.id,
    );
    this.archiveInfo = await window.electron.archive.getInfo(this.account.id);
    this.emitter?.emit(`x-update-database-stats-${this.account.id}`);
    this.emitter?.emit(`x-update-archive-info-${this.account.id}`);
  }

  async defineJobs() {
    let shouldBuildArchive = false;
    const hasSomeData = await xHasSomeData(this.account.id);

    const jobTypes = [];

    const jobsType = getJobsType(this.account.id);

    // Migrate to Bluesky
    if (jobsType == "migrateBluesky") {
      jobTypes.push("migrateBluesky");
      shouldBuildArchive = true;
    } else if (jobsType == "migrateBlueskyDelete") {
      jobTypes.push("migrateBlueskyDelete");
      shouldBuildArchive = true;
    }
    // Tombstone
    else if (jobsType == "tombstone") {
      jobTypes.push("login");

      if (this.account.xAccount?.tombstoneUpdateBanner) {
        jobTypes.push("tombstoneUpdateBanner");
      }
      if (this.account.xAccount?.tombstoneUpdateBio) {
        jobTypes.push("tombstoneUpdateBio");
      }
      if (this.account.xAccount?.tombstoneLockAccount) {
        jobTypes.push("tombstoneLockAccount");
      }
    }
    // Save, archive, or delete
    else {
      jobTypes.push("login");

      if (this.account.xAccount?.saveMyData) {
        shouldBuildArchive = true;
        if (this.account.xAccount?.archiveTweets) {
          jobTypes.push("indexTweets");
          if (this.account.xAccount?.archiveTweetsHTML) {
            jobTypes.push("archiveTweets");
          }
        }
        if (this.account.xAccount?.archiveLikes) {
          jobTypes.push("indexLikes");
        }
        if (this.account.xAccount?.archiveBookmarks) {
          jobTypes.push("indexBookmarks");
        }
        if (this.account.xAccount?.archiveDMs) {
          jobTypes.push("indexConversations");
          jobTypes.push("indexMessages");
        }
      }

      if (this.account.xAccount?.archiveMyData) {
        shouldBuildArchive = true;
        if (this.account.xAccount?.archiveTweetsHTML) {
          jobTypes.push("archiveTweets");
        }
        if (this.account.xAccount?.archiveBookmarks) {
          jobTypes.push("indexBookmarks");
        }
        if (this.account.xAccount?.archiveDMs) {
          jobTypes.push("indexConversations");
          jobTypes.push("indexMessages");
        }
      }

      if (this.account.xAccount?.deleteMyData) {
        if (hasSomeData && this.account.xAccount?.deleteTweets) {
          jobTypes.push("deleteTweets");
          shouldBuildArchive = true;
        }
        if (hasSomeData && this.account.xAccount?.deleteRetweets) {
          jobTypes.push("deleteRetweets");
          shouldBuildArchive = true;
        }
        if (hasSomeData && this.account.xAccount?.deleteLikes) {
          jobTypes.push("deleteLikes");
          shouldBuildArchive = true;
        }
        if (hasSomeData && this.account.xAccount?.deleteBookmarks) {
          jobTypes.push("deleteBookmarks");
          shouldBuildArchive = true;
        }
        if (this.account.xAccount?.unfollowEveryone) {
          jobTypes.push("unfollowEveryone");
        }
        if (this.account.xAccount?.deleteDMs) {
          jobTypes.push("deleteDMs");
        }
      }
    }

    if (shouldBuildArchive) {
      jobTypes.push("archiveBuild");
    }

    try {
      this.jobs = await window.electron.X.createJobs(this.account.id, jobTypes);
      this.log("defineJobs", JSON.parse(JSON.stringify(this.jobs)));
    } catch (e) {
      await this.error(
        AutomationErrorType.x_unknownError,
        {
          error: formatError(e as Error),
        },
        {
          currentURL: this.webview?.getURL(),
        },
      );
      return;
    }
  }

  async reset() {
    this.progress = emptyXProgress();
    this.rateLimitInfo = emptyXRateLimitInfo();
    this.jobs = [];
    this.state = State.WizardPrestart;
  }

  // Returns the API response's status code, or 0 on error
  async graphqlDelete(
    ct0: string,
    url: string,
    referrer: string,
    body: string,
  ): Promise<number> {
    return GraphQLOps.graphqlDelete(this, ct0, url, referrer, body);
  }

  // Returns an XUserInfo object, or null on error
  async graphqlGetViewerUser(): Promise<XUserInfo | null> {
    return GraphQLOps.graphqlGetViewerUser(this);
  }

  async waitForRateLimit(): Promise<void> {
    return RateLimitOps.waitForRateLimit(this);
  }

  async loadURLWithRateLimit(
    url: string,
    expectedURLs: (string | RegExp)[] = [],
    redirectOk: boolean = false,
  ): Promise<void> {
    return RateLimitOps.loadURLWithRateLimit(
      this,
      url,
      expectedURLs,
      redirectOk,
    );
  }

  async syncProgress(): Promise<void> {
    return Helpers.syncProgress(this);
  }

  async indexTweetsHandleRateLimit(): Promise<boolean> {
    return IndexJobs.indexTweetsHandleRateLimit(this);
  }

  // Check if there is a "Something went wrong" message, and click retry if there is
  async indexTweetsCheckForSomethingWrong(): Promise<void> {
    return IndexJobs.indexTweetsCheckForSomethingWrong(this);
  }

  // When we get to the bottom of a tweets or likes feed, verify that we're actually
  // at the bottom. Do this by scrolling up, then down again, and making sure we still got the
  // final API response.
  // Returns true if we're actually at the bottom, false if we're not.
  async indexTweetsVerifyThereIsNoMore(): Promise<boolean> {
    return IndexJobs.indexTweetsVerifyThereIsNoMore(this);
  }

  async login(): Promise<void> {
    return AuthOps.login(this);
  }

  async loadUserStats(): Promise<void> {
    return AuthOps.loadUserStats(this);
  }

  async finishJob(jobIndex: number): Promise<void> {
    return Helpers.finishJob(this, jobIndex);
  }

  async errorJob(jobIndex: number): Promise<void> {
    return Helpers.errorJob(this, jobIndex);
  }

  // Load the DMs page, and return true if an error was triggered
  async deleteDMsLoadDMsPage(): Promise<boolean> {
    return DeleteJobs.deleteDMsLoadDMsPage(this);
  }

  // Load the following page, and return true if an error was triggered
  async unfollowEveryoneLoadPage(): Promise<boolean> {
    return DeleteJobs.unfollowEveryoneLoadPage(this);
  }

  async archiveSaveTweet(
    outputPath: string,
    tweetItem: XTweetItemArchive,
  ): Promise<boolean> {
    return IndexJobs.archiveSaveTweet(this, outputPath, tweetItem);
  }

  async getDatabaseStatsString(): Promise<string> {
    return Helpers.getDatabaseStatsString(this);
  }

  async runJobLogin(jobIndex: number): Promise<boolean> {
    return Helpers.runJobLogin(this, jobIndex);
  }

  async runJobIndexTweets(jobIndex: number): Promise<boolean> {
    return IndexJobs.runJobIndexTweets(this, jobIndex);
  }

  async runJobArchiveTweets(jobIndex: number): Promise<boolean> {
    return IndexJobs.runJobArchiveTweets(this, jobIndex);
  }

  async runJobIndexConversations(jobIndex: number): Promise<boolean> {
    return IndexJobs.runJobIndexConversations(this, jobIndex);
  }

  async runJobIndexMessages(jobIndex: number) {
    return IndexJobs.runJobIndexMessages(this, jobIndex);
  }

  async runJobArchiveBuild(jobIndex: number): Promise<boolean> {
    return Helpers.runJobArchiveBuild(this, jobIndex);
  }

  async runJobIndexLikes(jobIndex: number): Promise<boolean> {
    return IndexJobs.runJobIndexLikes(this, jobIndex);
  }

  async runJobIndexBookmarks(jobIndex: number): Promise<boolean> {
    return IndexJobs.runJobIndexBookmarks(this, jobIndex);
  }

  async runJobDeleteTweets(jobIndex: number) {
    return DeleteJobs.runJobDeleteTweets(this, jobIndex);
  }

  async runJobDeleteRetweets(jobIndex: number) {
    return DeleteJobs.runJobDeleteRetweets(this, jobIndex);
  }

  async runJobDeleteLikes(jobIndex: number) {
    return DeleteJobs.runJobDeleteLikes(this, jobIndex);
  }

  async runJobDeleteBookmarks(jobIndex: number) {
    return DeleteJobs.runJobDeleteBookmarks(this, jobIndex);
  }

  async runJobDeleteDMs(jobIndex: number): Promise<boolean> {
    return DeleteJobs.runJobDeleteDMs(this, jobIndex);
  }

  async runJobUnfollowEveryone(jobIndex: number): Promise<boolean> {
    return DeleteJobs.runJobUnfollowEveryone(this, jobIndex);
  }

  async runJobMigrateBluesky(jobIndex: number): Promise<boolean> {
    return MigrateJobs.runJobMigrateBluesky(this, jobIndex);
  }

  async runJobMigrateBlueskyDelete(jobIndex: number): Promise<boolean> {
    return MigrateJobs.runJobMigrateBlueskyDelete(this, jobIndex);
  }

  async runJobTombstoneUpdateBanner(jobIndex: number): Promise<boolean> {
    return TombstoneJobs.runJobTombstoneUpdateBanner(this, jobIndex);
  }

  async runJobTombstoneUpdateBio(jobIndex: number): Promise<boolean> {
    return TombstoneJobs.runJobTombstoneUpdateBio(this, jobIndex);
  }

  async runJobTombstoneLockAccount(jobIndex: number): Promise<boolean> {
    return TombstoneJobs.runJobTombstoneLockAccount(this, jobIndex);
  }

  async runJob(jobIndex: number) {
    this.runJobsState = RunJobsState.Default;

    // Reset logs before each job, so the sensitive context data in error reports will only includes
    // logs from the current job
    this.resetLogs();

    await this.waitForPause();

    // Start the job
    this.jobs[jobIndex].startedAt = new Date();
    this.jobs[jobIndex].status = "running";
    await window.electron.X.updateJob(
      this.account.id,
      JSON.stringify(this.jobs[jobIndex]),
    );

    // Set the current job immediately
    this.progress.currentJob = this.jobs[jobIndex].jobType;
    await this.syncProgress();

    this.log("runJob", `running job ${this.jobs[jobIndex].jobType}`);
    switch (this.jobs[jobIndex].jobType) {
      case "login":
        await this.runJobLogin(jobIndex);
        break;

      case "indexTweets":
        await this.runJobIndexTweets(jobIndex);
        break;

      case "archiveTweets":
        await this.runJobArchiveTweets(jobIndex);
        break;

      case "indexConversations":
        await this.runJobIndexConversations(jobIndex);
        break;

      case "indexMessages":
        await this.runJobIndexMessages(jobIndex);
        break;

      case "archiveBuild":
        await this.runJobArchiveBuild(jobIndex);
        break;

      case "indexLikes":
        await this.runJobIndexLikes(jobIndex);
        break;

      case "indexBookmarks":
        await this.runJobIndexBookmarks(jobIndex);
        break;

      case "deleteTweets":
        await this.runJobDeleteTweets(jobIndex);
        break;

      case "deleteRetweets":
        await this.runJobDeleteRetweets(jobIndex);
        break;

      case "deleteLikes":
        await this.runJobDeleteLikes(jobIndex);
        break;

      case "deleteBookmarks":
        await this.runJobDeleteBookmarks(jobIndex);
        break;

      case "unfollowEveryone":
        await this.runJobUnfollowEveryone(jobIndex);
        break;

      case "deleteDMs":
        await this.runJobDeleteDMs(jobIndex);
        break;

      case "migrateBluesky":
        await this.runJobMigrateBluesky(jobIndex);
        break;

      case "migrateBlueskyDelete":
        await this.runJobMigrateBlueskyDelete(jobIndex);
        break;

      case "tombstoneUpdateBanner":
        await this.runJobTombstoneUpdateBanner(jobIndex);
        break;

      case "tombstoneUpdateBio":
        await this.runJobTombstoneUpdateBio(jobIndex);
        break;

      case "tombstoneLockAccount":
        await this.runJobTombstoneLockAccount(jobIndex);
        break;
    }
  }

  async run() {
    // Reset logs before running any state
    this.resetLogs();

    // Temp variables
    let databaseStatsString: string = "";
    let updatedAccount: Account | null = null;

    this.log("run", `running state: ${this.state}`);
    try {
      switch (this.state) {
        case State.Login:
          this.actionString = `Hello, friend! My name is **Cyd**. I can help you save and delete your tweets, likes, and direct messages from X.`;
          this.instructions = `${this.actionString}

# To get started, log in to your X account below.`;
          this.showBrowser = true;
          this.showAutomationNotice = false;
          await this.login();
          this.state = State.WizardPrestart;
          break;

        case State.WizardPrestart:
          // Only load user stats if we don't know them yet, or if there's a config telling us to,
          // and be sure to skip loading user stats if we're in archive-only mode
          if (
            (this.account.xAccount?.tweetsCount === -1 ||
              this.account.xAccount?.likesCount === -1 ||
              (await window.electron.X.getConfig(
                this.account.id,
                "reloadUserStats",
              )) == "true") &&
            !this.account.xAccount?.archiveOnly
          ) {
            await this.loadUserStats();
          }
          this.showBrowser = false;
          this.state = State.WizardStart;
          break;

        case State.WizardStart:
          this.showBrowser = false;
          await this.loadBlank();
          this.state = State.WizardDashboard;
          break;

        case State.WizardDashboard:
          this.showBrowser = false;
          this.instructions = `
# It's _your_ data. What do you want to do with it?`;
          this.state = State.WizardDashboardDisplay;
          await this.loadBlank();
          break;

        case State.WizardDatabase:
          this.showBrowser = false;
          this.instructions = `
# I need a local database of the data in your X account before I can delete it.

You can either import an X archive, or I can build it from scratch by scrolling through your profile.`;
          this.state = State.WizardDatabaseDisplay;
          await this.loadBlank();
          break;

        case State.WizardImportStart:
          this.showBrowser = false;
          this.instructions = `
# Before you can import your X archive, you need to download it from X. Here's how.`;
          await this.loadBlank();
          this.state = State.WizardImportStartDisplay;
          break;

        case State.WizardImporting:
          this.showBrowser = false;
          this.instructions = `
# I'll help you import your X archive into your local database.`;
          await this.loadBlank();
          this.state = State.WizardImportingDisplay;
          break;

        case State.WizardBuildOptions:
          this.showBrowser = false;
          this.instructions = `
I'll help you build a private local database of your X data to the \`Documents\` folder on your computer.
You'll be able to access it even after you delete it from X.

# Which data do you want to save?`;
          await this.loadBlank();
          this.state = State.WizardBuildOptionsDisplay;
          break;

        case State.WizardArchiveOptions:
          this.showBrowser = false;
          this.instructions = `
- I can save an HTML version of each of your tweets.
- I can backup a copy of your bookmarks, which isn't included in the official X archive.
- And I can also save a more detailed backup of your direct messages than is available in the official X archive.

# Which data do you want to save?`;
          await this.loadBlank();
          this.state = State.WizardArchiveOptionsDisplay;
          break;

        case State.WizardDeleteOptions:
          this.showBrowser = false;
          this.instructions = `
# Which data do you want to delete?`;
          await this.loadBlank();
          this.state = State.WizardDeleteOptionsDisplay;
          break;

        case State.WizardReview:
          this.showBrowser = false;
          this.instructions = `I'm almost ready to start helping you claw back your data from X!

# Here's what I'm planning on doing.`;
          await this.loadBlank();
          this.state = State.WizardReviewDisplay;
          break;

        case State.WizardDeleteReview:
          this.showBrowser = false;
          databaseStatsString = await this.getDatabaseStatsString();
          this.instructions =
            "I've finished saving the data I need before I can start deleting.";
          if (databaseStatsString != "") {
            this.instructions += `\n\nI've saved: **${await this.getDatabaseStatsString()}**.`;
          }
          await this.loadBlank();
          this.state = State.WizardDeleteReviewDisplay;
          break;

        case State.WizardMigrateToBluesky:
          this.showBrowser = false;
          await this.loadBlank();
          this.instructions = `
# Just because you're quitting X doesn't mean your posts need to disappear.

After you build a local database of your tweets, I can help you migrate them into a Bluesky account.`;
          this.state = State.WizardMigrateToBlueskyDisplay;
          break;

        case State.WizardTombstone:
          this.showBrowser = false;
          await this.loadURL("about:blank");
          this.instructions = `
**Quitting X? Good riddance.**
Using my Tombstone feature, I can help you update your profile to tell your followers where to find you next. I can also help you lock your account.`;
          this.state = State.WizardTombstoneDisplay;
          break;

        case State.WizardArchiveOnly:
          // Set the account to archive-only mode
          await window.electron.X.initArchiveOnlyMode(this.account.id);
          updatedAccount = await window.electron.database.getAccount(
            this.account.id,
          );
          if (updatedAccount !== null) {
            this.account = updatedAccount;
          }

          this.showBrowser = false;
          this.instructions = `
# You've chosen to use a pre-existing X archive.

I'll help you import your X data so you can view it locally or migrate your tweets to Bluesky.`;
          await this.loadBlank();
          this.state = State.WizardArchiveOnlyDisplay;
          break;

        case State.FinishedRunningJobs:
          this.showBrowser = false;
          this.instructions = `
All done!

# Here's what I did.`;
          await this.loadBlank();
          this.state = State.FinishedRunningJobsDisplay;
          break;

        case State.WizardCheckPremium:
          this.showBrowser = false;
          this.instructions = `# I'm almost ready to delete your data from X!

You can save all your data for free, but you need a Premium plan to delete your data.`;
          await this.loadBlank();
          this.state = State.WizardCheckPremiumDisplay;
          break;

        case State.RunJobs:
          this.progress = await window.electron.X.resetProgress(
            this.account.id,
          );

          // Dismiss old error reports
          await window.electron.database.dismissNewErrorReports(
            this.account.id,
          );

          // i is starting at currentJobIndex instead of 0, in case we restored state
          for (let i = this.currentJobIndex; i < this.jobs.length; i++) {
            this.currentJobIndex = i;
            try {
              await this.runJob(i);
              if (this.debugAutopauseEndOfStep) {
                this.pause();
                await this.waitForPause();
              }
            } catch (e) {
              await this.error(AutomationErrorType.x_runJob_UnknownError, {
                error: formatError(e as Error),
              });
              break;
            }
          }
          this.currentJobIndex = 0;

          await this.refreshDatabaseStats();

          // Determine the next state
          this.state = State.FinishedRunningJobs;

          this.showBrowser = false;
          await this.loadBlank();
          break;

        case State.Debug:
          // Stay in this state until the user cancels it
          this.showBrowser = false;
          await this.loadBlank();
          this.instructions = `I'm in my debug state.`;
          while (this.state === State.Debug) {
            await this.sleep(1000);
          }
          break;
      }
    } catch (e) {
      await this.error(AutomationErrorType.x_runError, {
        error: formatError(e as Error),
        state: this.state,
        jobs: this.jobs,
        currentJobIndex: this.currentJobIndex,
      });
    }
  }

  saveState(): XViewModelState {
    return {
      state: this.state as State,
      action: this.action,
      actionString: this.actionString,
      progress: this.progress,
      jobs: this.jobs,
      currentJobIndex: this.currentJobIndex,
    };
  }

  restoreState(state: XViewModelState) {
    this.state = state.state;
    this.action = state.action;
    this.actionString = state.actionString;
    this.progress = state.progress;
    this.jobs = state.jobs;
    this.currentJobIndex = state.currentJobIndex;
  }
}
