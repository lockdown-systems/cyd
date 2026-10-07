import { getConnectedBlueskyLocalAccountIDs } from "../database/bluesky_account";
import { xBlueskyHolderAccountIDs } from "../account_x/bluesky_holder";

import type { BlueskyOAuthPlatform } from "../shared_types";

/**
 * Who still depends on one Bluesky identity's authorization.
 *
 * A single authorized DID can be reached from more than one place at once: an
 * X account with the migration connected, and a Bluesky local account for the
 * same identity. Each of those is a **holder**. Releasing one hold must leave
 * the others signed in; releasing the last one must genuinely sign out.
 *
 * Holders are recomputed from account state every time they are asked for,
 * never tracked in a counter beside the session. A counter can be left one too
 * high by a crash, stranding a session nothing can ever revoke, or one too low
 * by a partial delete, signing out an account that is still connected. Account
 * state cannot drift from itself.
 *
 * A holder names the same pair as a flow does, but it is not one: a flow is an
 * authorization in progress, and a holder is an account depending on one that
 * finished.
 */
export type BlueskyHolder = {
  platform: BlueskyOAuthPlatform;
  accountID: number;
};

/**
 * Every account that currently depends on this identity's session.
 *
 * Each platform is asked about its own accounts, because how an X account
 * records a connected migration and how a Bluesky local account records a
 * connection are each that platform's business.
 *
 * This reads account state and nothing else, so it is safe to ask at any
 * moment. Callers release a hold by first making the holder's own state say it
 * is disconnected — or by deleting the account outright — and only then asking
 * again.
 */
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
