import { getConnectedBlueskyLocalAccountIDs } from "../database/bluesky_account";
import { xBlueskyHolderAccountIDs } from "../account_x/bluesky_holder";

import type { BlueskyOAuthPlatform } from "../shared_types";

// Who still depends on one Bluesky identity's authorization: each account
// reaching a DID is a **holder**. Recomputed from account state every time —
// never tracked in a counter, which a crash or partial delete could desync.
export type BlueskyHolder = {
  platform: BlueskyOAuthPlatform;
  accountID: number;
};

// Reads account state only, so it is safe to ask at any moment. Callers
// release a hold by first making the holder's own state say it is
// disconnected, then asking again.
export const blueskyHolders = (did: string): BlueskyHolder[] => [
  ...xBlueskyHolderAccountIDs(did).map((accountID) => ({
    platform: "X" as BlueskyOAuthPlatform,
    accountID,
  })),
  ...getConnectedBlueskyLocalAccountIDs(did).map((accountID) => ({
    platform: "Bluesky" as BlueskyOAuthPlatform,
    accountID,
  })),
];
