import { XJob, XProgress } from "../../../../shared_types";

// This is the Bearer token used by X's public web client, it's not a secret
export const X_AUTHORIZATION_HEADER =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export enum State {
  Login = "Login",

  WizardPrestart = "WizardPrestart",
  WizardStart = "WizardStart",

  WizardDashboard = "WizardDashboard",
  WizardDashboardDisplay = "WizardDashboardDisplay",

  WizardDatabase = "WizardDatabase",
  WizardDatabaseDisplay = "WizardDatabaseDisplay",

  WizardImportOrBuild = "WizardImportOrBuild",
  WizardImportOrBuildDisplay = "WizardImportOrBuildDisplay",

  WizardImportStart = "WizardImportStart",
  WizardImportStartDisplay = "WizardImportStartDisplay",
  WizardImporting = "WizardImporting",
  WizardImportingDisplay = "WizardImportingDisplay",

  WizardBuildOptions = "WizardBuildOptions",
  WizardBuildOptionsDisplay = "WizardBuildOptionsDisplay",

  WizardArchiveOptions = "WizardArchiveOptions",
  WizardArchiveOptionsDisplay = "WizardArchiveOptionsDisplay",

  WizardDeleteOptions = "WizardDeleteOptions",
  WizardDeleteOptionsDisplay = "WizardDeleteOptionsDisplay",

  WizardReview = "WizardReview",
  WizardReviewDisplay = "WizardReviewDisplay",

  WizardDeleteReview = "WizardDeleteReview",
  WizardDeleteReviewDisplay = "WizardDeleteReviewDisplay",

  WizardCheckPremium = "WizardCheckPremium",
  WizardCheckPremiumDisplay = "WizardCheckPremiumDisplay",

  WizardMigrateToBluesky = "WizardMigrateToBluesky",
  WizardMigrateToBlueskyDisplay = "WizardMigrateToBlueskyDisplay",

  WizardTombstone = "WizardTombstone",
  WizardTombstoneDisplay = "WizardTombstoneDisplay",

  WizardArchiveOnly = "WizardArchiveOnly",
  WizardArchiveOnlyDisplay = "WizardArchiveOnlyDisplay",

  RunJobs = "RunJobs",

  FinishedRunningJobs = "FinishedRunningJobs",
  FinishedRunningJobsDisplay = "FinishedRunningJobsDisplay",

  Debug = "Debug",
}

// When state is state is RunJobs, this is the job that is currently running, if
// it requires hiding the browser and instead showing stuff in AccountXView
export enum RunJobsState {
  Default = "",
  DeleteTweets = "DeleteTweets",
  DeleteRetweets = "DeleteRetweets",
  DeleteLikes = "DeleteLikes",
  DeleteBookmarks = "DeleteBookmarks",
  MigrateBluesky = "MigrateBluesky",
  MigrateBlueskyDelete = "MigrateBlueskyDelete",
}

export enum FailureState {
  indexTweets_FailedToRetryAfterRateLimit = "indexTweets_FailedToRetryAfterRateLimit",
  indexLikes_FailedToRetryAfterRateLimit = "indexLikes_FailedToRetryAfterRateLimit",
  indexBookmarks_FailedToRetryAfterRateLimit = "indexBookmarks_FailedToRetryAfterRateLimit",
}

export type XViewModelState = {
  state: State;
  action: string;
  actionString: string;
  progress: XProgress;
  jobs: XJob[];
  currentJobIndex: number;
};

export const tombstoneUpdateBioCreditCydText =
  " (I escaped X using https://cyd.social)";
