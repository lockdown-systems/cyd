import { PlatformStates } from "../../types/PlatformStates";

// Re-export PlatformStates for convenience
export const State = PlatformStates;

// When state is RunJobs, this tracks which job is currently running
export enum RunJobsState {
  Default = "",
  DeleteWallPosts = "DeleteWallPosts",
}

// Facebook job types
export type FacebookJobType = "login" | "deleteWallPosts";

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

// Facebook progress tracking
export type FacebookProgress = {
  currentJob: string;
  wallPostsDeleted: number;
  totalWallPostsToDelete: number;
  isDeleteWallPostsFinished: boolean;
};

export function emptyFacebookProgress(): FacebookProgress {
  return {
    currentJob: "",
    wallPostsDeleted: 0,
    totalWallPostsToDelete: 0,
    isDeleteWallPostsFinished: false,
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
