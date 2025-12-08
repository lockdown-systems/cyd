import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import { formatError } from "../../util";
import * as AuthOps from "./auth";

export async function syncProgress(vm: XViewModel): Promise<void> {
  await window.electron.X.syncProgress(
    vm.account.id,
    JSON.stringify(vm.progress),
  );
}

export async function finishJob(
  vm: XViewModel,
  jobIndex: number,
): Promise<void> {
  const finishedAt = new Date();
  vm.jobs[jobIndex].finishedAt = finishedAt;
  vm.jobs[jobIndex].status = "finished";
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  await window.electron.X.updateJob(
    vm.account.id,
    JSON.stringify(vm.jobs[jobIndex]),
  );
  await window.electron.X.setConfig(
    vm.account.id,
    `lastFinishedJob_${vm.jobs[jobIndex].jobType}`,
    finishedAt.toISOString(),
  );
  vm.log("finishJob", vm.jobs[jobIndex].jobType);
}

export async function errorJob(
  vm: XViewModel,
  jobIndex: number,
): Promise<void> {
  vm.jobs[jobIndex].finishedAt = new Date();
  vm.jobs[jobIndex].status = "error";
  vm.jobs[jobIndex].progressJSON = JSON.stringify(vm.progress);
  await window.electron.X.updateJob(
    vm.account.id,
    JSON.stringify(vm.jobs[jobIndex]),
  );
  vm.log("errorJob", vm.jobs[jobIndex].jobType);
}

export async function getDatabaseStatsString(vm: XViewModel): Promise<string> {
  await vm.refreshDatabaseStats();
  const tweetsCount =
    vm.databaseStats.tweetsSaved - vm.databaseStats.tweetsDeleted;
  const retweetsCount =
    vm.databaseStats.retweetsSaved - vm.databaseStats.retweetsDeleted;
  const likesCount =
    vm.databaseStats.likesSaved - vm.databaseStats.likesDeleted;

  const statsComponents = [];
  if (vm.account.xAccount?.deleteTweets) {
    statsComponents.push(`${tweetsCount.toLocaleString()} tweets`);
  }
  if (vm.account.xAccount?.deleteRetweets) {
    statsComponents.push(`${retweetsCount.toLocaleString()} retweets`);
  }
  if (vm.account.xAccount?.deleteLikes) {
    statsComponents.push(`${likesCount.toLocaleString()} likes`);
  }

  let statsString = "";
  for (let i = 0; i < statsComponents.length; i++) {
    statsString += statsComponents[i];
    if (i < statsComponents.length - 2) {
      statsString += ", ";
    } else if (i < statsComponents.length - 1) {
      statsString += " and ";
    }
  }
  return statsString;
}

export async function runJobLogin(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_LOGIN,
    navigator.userAgent,
  );

  vm.showBrowser = true;
  vm.instructions = vm.t("viewModels.x.helpers.checkingLogin");

  vm.showAutomationNotice = false;
  await AuthOps.login(vm);

  await finishJob(vm, jobIndex);
  return true;
}

export async function runJobArchiveBuild(
  vm: XViewModel,
  jobIndex: number,
): Promise<boolean> {
  await window.electron.trackEvent(
    PlausibleEvents.X_JOB_STARTED_ARCHIVE_BUILD,
    navigator.userAgent,
  );

  vm.showBrowser = false;
  vm.instructions = vm.t("viewModels.x.helpers.buildingArchive");
  vm.showAutomationNotice = true;

  // Build the archive
  try {
    await window.electron.X.archiveBuild(vm.account.id);
    vm.emitter?.emit(`x-update-archive-info-${vm.account.id}`);
  } catch (e) {
    await vm.error(
      AutomationErrorType.x_runJob_archiveBuild_ArchiveBuildError,
      {
        error: formatError(e as Error),
      },
    );
    return false;
  }

  // Submit progress to the API
  vm.emitter?.emit(`x-submit-progress-${vm.account.id}`);

  await vm.finishJob(jobIndex);
  return true;
}
