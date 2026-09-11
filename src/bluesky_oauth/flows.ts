import {
  parseBlueskyOAuthFlowID,
  type BlueskyOAuthFlow,
} from "../shared_types";
import { storedBlueskyOAuthAppState } from "./store";

// The flow identifier itself is a contract between the main process and the
// renderer, so it is defined with the other shared types. Only resolving a
// callback against stored authorization state belongs to the main process.
export * from "../shared_types/bluesky_oauth";

/**
 * Which flow an authorization callback belongs to.
 *
 * The callback URL carries the OAuth `state` parameter, which names the stored
 * authorization state; that state holds the flow identifier. Reading it does
 * not consume it, because the OAuth client still needs the entry to finish the
 * exchange. A callback whose state Cyd does not hold — stale, forged, or
 * already spent — resolves to null and is not dispatched anywhere.
 */
export const resolveBlueskyOAuthFlow = (
  queryString: string,
): BlueskyOAuthFlow | null => {
  const stateKey = new URLSearchParams(queryString).get("state");
  if (!stateKey) {
    return null;
  }
  return parseBlueskyOAuthFlowID(storedBlueskyOAuthAppState(stateKey));
};
