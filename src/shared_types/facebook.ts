// Facebook models

import type { PlatformJob } from "./common";

// status can be "pending", "running", "finished", "failed", "canceled"
export type FacebookJob = PlatformJob & {
  jobType: string; // "deleteWallPosts"
  scheduledAt: Date;
};

export type FacebookProgress = {
  wallPostsDeleted: number;
};

export function emptyFacebookProgress(): FacebookProgress {
  return {
    wallPostsDeleted: 0,
  };
}

export type FacebookRateLimitInfo = {
  isRateLimited: boolean;
  rateLimitReset: number;
};

export function emptyFacebookRateLimitInfo(): FacebookRateLimitInfo {
  return {
    isRateLimited: false,
    rateLimitReset: 0,
  };
}

// Re-export FacebookProgressInfo from account.ts where it's already defined
export type { FacebookProgressInfo } from "./account";
export { emptyFacebookProgressInfo } from "./account";
