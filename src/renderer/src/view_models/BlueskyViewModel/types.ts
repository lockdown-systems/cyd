import { PlatformStates } from "../../types/PlatformStates";
import type {
  BlueskyCollectionProgress,
  BlueskyJob,
} from "../../../../shared_types";

// Re-export PlatformStates for convenience
export const State = PlatformStates;

export type { BlueskyJob };

/**
 * What a Bluesky run is doing right now.
 *
 * The collection engine's own progress is carried through as it is, because it
 * is already operational metadata only and the renderer has no business
 * enriching it with anything that identifies a person.
 *
 * See docs/adr/0029-minimize-bluesky-diagnostics.md.
 */
export type BlueskyProgress = {
  currentJob: string;
  /** The category being collected, or null between jobs. */
  collection: BlueskyCollectionProgress | null;
  /** Totals across every job in this run. */
  recordsSaved: number;
  mediaSaved: number;
  mediaFailed: number;
};

export function emptyBlueskyProgress(): BlueskyProgress {
  return {
    currentJob: "",
    collection: null,
    recordsSaved: 0,
    mediaSaved: 0,
    mediaFailed: 0,
  };
}
