import {
  parseBlueskyOAuthFlowID,
  type BlueskyOAuthFlow,
} from "../shared_types";
import { storedBlueskyOAuthAppState } from "./store";

// The flow identifier itself is a contract between the main process and the
// renderer, so it is defined with the other shared types. Only resolving a
// callback against stored authorization state belongs to the main process.
export * from "../shared_types/bluesky_oauth";

// Reads without consuming (the OAuth client still needs the entry); a
// callback whose state Cyd does not hold resolves to null and is not dispatched.
export const resolveBlueskyOAuthFlow = (
  queryString: string,
): BlueskyOAuthFlow | null => {
  const stateKey = new URLSearchParams(queryString).get("state");
  if (!stateKey) {
    return null;
  }
  return parseBlueskyOAuthFlowID(storedBlueskyOAuthAppState(stateKey));
};
