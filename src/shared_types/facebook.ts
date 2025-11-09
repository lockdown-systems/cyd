// Facebook models

import type { PlatformJob } from "./common";

// status can be "pending", "running", "finished", "failed", "canceled"
export type FacebookJob = PlatformJob & {
  jobType: string; // "login", "...",
  scheduledAt: Date;
};

// Other Facebook types

export type FacebookProgress = {
  currentJob: string;
  isSavePostsFinished: boolean;
  storiesSaved: number;
};

export function emptyFacebookProgress(): FacebookProgress {
  return {
    currentJob: "",
    isSavePostsFinished: false,
    storiesSaved: 0,
  };
}

export type FacebookDatabaseStats = {
  storiesSaved: number;
  storiesDeleted: number;
};

export function emptyFacebookDatabaseStats(): FacebookDatabaseStats {
  return {
    storiesSaved: 0,
    storiesDeleted: 0,
  };
}
