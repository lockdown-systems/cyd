import { PlatformStates } from "../../types/PlatformStates";
import type { BlueskyJob } from "../../../../shared_types";

// Re-export PlatformStates for convenience
export const State = PlatformStates;

export type { BlueskyJob };

/**
 * Bluesky job progress. Saving and deleting arrive in later issues, so the
 * shell only tracks which job is running.
 */
export type BlueskyProgress = {
  currentJob: string;
};

export function emptyBlueskyProgress(): BlueskyProgress {
  return {
    currentJob: "",
  };
}
