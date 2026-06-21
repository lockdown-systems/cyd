import { PlatformStates } from "../../types/PlatformStates";

// Re-export PlatformStates for convenience
export const State = PlatformStates;

// When state is RunJobs, this tracks which job is currently running
export enum RunJobsState {
  Default = "",
  SaveUserLang = "SaveUserLang",
  SetLangToEnglish = "SetLangToEnglish",
  DeleteActivity = "DeleteActivity",
  RestoreUserLang = "RestoreUserLang",
}

// Facebook job types
export type FacebookJobType =
  | "login"
  | "saveUserLang"
  | "setLangToEnglish"
  | "deleteActivity"
  | "restoreUserLang";

// Facebook job
export type FacebookJob = {
  id: number | null;
  jobType: FacebookJobType;
  status: string; // "pending", "running", "finished", "error"
  startedAt: Date | null;
  finishedAt: Date | null;
  progressJSON: string;
  error: string | null;
};

// Facebook progress tracking.
export type FacebookProgress = {
  currentJob: string;
  // The category currently being processed by the deleteActivity job (a category
  // `setting` id, e.g. "deleteComments"), or "" when not deleting.
  currentCategory: string;
  wallPostsDeleted: number;
  wallPostsUntagged: number;
  wallPostsHidden: number;
  commentsDeleted: number;
  reactionsDeleted: number;
  postsOnOthersDeleted: number;
  othersPostsDeleted: number;
  checkinsDeleted: number;
  taggedPostsDeleted: number;
  taggedMediaDeleted: number;
  isDeleteActivityFinished: boolean;
};

export function emptyFacebookProgress(): FacebookProgress {
  return {
    currentJob: "",
    currentCategory: "",
    wallPostsDeleted: 0,
    wallPostsUntagged: 0,
    wallPostsHidden: 0,
    commentsDeleted: 0,
    reactionsDeleted: 0,
    postsOnOthersDeleted: 0,
    othersPostsDeleted: 0,
    checkinsDeleted: 0,
    taggedPostsDeleted: 0,
    taggedMediaDeleted: 0,
    isDeleteActivityFinished: false,
  };
}

// View model state for save/restore
export type FacebookViewModelState = {
  state: string;
  action: string;
  actionString: string;
  progress: FacebookProgress;
  jobs: FacebookJob[];
  currentJobIndex: number;
};
