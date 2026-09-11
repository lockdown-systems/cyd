import log from "electron-log/main";

import { getAccounts } from "../database/account";
import { getConnectedBlueskyLocalAccountIDs } from "../database/bluesky_account";
import { xBlueskyMigrationDID } from "../account_x/bluesky_holder";

import type { BlueskyOAuthFlow, BlueskyOAuthPlatform } from "../shared_types";

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
 */
export type BlueskyHolder = BlueskyOAuthFlow;

const holderKey = (holder: BlueskyHolder): string =>
  `${holder.platform}:${holder.accountID}`;

const xHolders = (did: string): BlueskyHolder[] => {
  const holders: BlueskyHolder[] = [];
  for (const account of getAccounts()) {
    if (account.type !== "X" || !account.xAccount?.username) {
      continue;
    }
    if (xBlueskyMigrationDID(account.xAccount.username) === did) {
      holders.push({ platform: "X", accountID: account.id });
    }
  }
  return holders;
};

const blueskyPlatformHolders = (did: string): BlueskyHolder[] =>
  getConnectedBlueskyLocalAccountIDs(did).map((accountID) => ({
    platform: "Bluesky" as BlueskyOAuthPlatform,
    accountID,
  }));

/**
 * Every account that currently depends on this identity's session.
 *
 * This reads account state and nothing else, so it is safe to ask at any
 * moment. Callers release a hold by first making the holder's own state say it
 * is disconnected — or by deleting the account outright — and only then asking
 * again.
 */
export const blueskyHolders = (did: string): BlueskyHolder[] => {
  const holders = [...xHolders(did), ...blueskyPlatformHolders(did)];
  const seen = new Set<string>();
  return holders.filter((holder) => {
    const key = holderKey(holder);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/** Whether any account still depends on this identity's session. */
export const blueskyIdentityIsHeld = (did: string): boolean => {
  const holders = blueskyHolders(did);
  // Holders are never named in a log line: a DID and a handle both identify a
  // person, and an account ID points straight at one.
  log.info(`blueskyOAuth: identity has ${holders.length} holder(s)`);
  return holders.length > 0;
};
