import log from "electron-log/main";

import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from "@atproto/oauth-client-node";

import { getAccounts } from "../database/account";
import {
  BLUESKY_OAUTH_SESSION_PREFIX,
  BLUESKY_OAUTH_STATE_PREFIX,
  accountCredentials,
  sharedCredentials,
  type AccountCredentials,
} from "../credentials";

// Shared OAuth store keyed by DID: one authorization serves every Cyd
// account reaching for that identity. Only a DID's own entry is ever removed.
const BLUESKY_OAUTH_VAULT = "bluesky-oauth";

export const blueskyOAuthCredentials = (): AccountCredentials =>
  sharedCredentials(BLUESKY_OAUTH_VAULT);

const stateKey = (key: string): string => `${BLUESKY_OAUTH_STATE_PREFIX}${key}`;

const sessionKey = (did: string): string =>
  `${BLUESKY_OAUTH_SESSION_PREFIX}${did}`;

// Short-lived OAuth state (PKCE verifier, DPoP key); the client deletes each
// entry once the matching authorization comes back.
export const blueskyOAuthStateStore = (): NodeSavedStateStore => {
  const credentials = blueskyOAuthCredentials();
  return {
    set: async (key: string, state: NodeSavedState): Promise<void> => {
      credentials.set(stateKey(key), JSON.stringify(state));
    },
    get: async (key: string): Promise<NodeSavedState | undefined> => {
      const stored = credentials.get(stateKey(key));
      return stored ? (JSON.parse(stored) as NodeSavedState) : undefined;
    },
    del: async (key: string): Promise<void> => {
      credentials.delete(stateKey(key));
    },
  };
};

// OAuth session (tokens + DPoP key), keyed by the DID it authorizes.
export const blueskyOAuthSessionStore = (): NodeSavedSessionStore => {
  const credentials = blueskyOAuthCredentials();
  return {
    set: async (did: string, session: NodeSavedSession): Promise<void> => {
      credentials.set(sessionKey(did), JSON.stringify(session));
    },
    get: async (did: string): Promise<NodeSavedSession | undefined> => {
      const stored = credentials.get(sessionKey(did));
      return stored ? (JSON.parse(stored) as NodeSavedSession) : undefined;
    },
    del: async (did: string): Promise<void> => {
      credentials.delete(sessionKey(did));
    },
  };
};

/** Every DID Cyd currently holds a stored session for. */
export const storedBlueskyOAuthDIDs = (): string[] =>
  blueskyOAuthCredentials()
    .keys()
    .filter((key) => key.startsWith(BLUESKY_OAUTH_SESSION_PREFIX))
    .map((key) => key.slice(BLUESKY_OAUTH_SESSION_PREFIX.length));

/** Whether Cyd holds a stored session for this identity. */
export const hasStoredBlueskyOAuthSession = (did: string): boolean =>
  blueskyOAuthCredentials().get(sessionKey(did)) !== null;

// The local half of revocation; callers go through `releaseBlueskyHold`,
// which revokes upstream first so no refresh token is left alive at the PDS.
export const deleteStoredBlueskyOAuthSession = (did: string): void => {
  blueskyOAuthCredentials().delete(sessionKey(did));
};

/** Every in-flight authorization state, by its OAuth `state` parameter. */
export const storedBlueskyOAuthStateKeys = (): string[] =>
  blueskyOAuthCredentials()
    .keys()
    .filter((key) => key.startsWith(BLUESKY_OAUTH_STATE_PREFIX))
    .map((key) => key.slice(BLUESKY_OAUTH_STATE_PREFIX.length));

// Reads without consuming: the OAuth client still needs the entry to finish
// the callback. Null means a stale, forged, or already-completed callback.
export const storedBlueskyOAuthAppState = (key: string): string | null => {
  const stored = blueskyOAuthCredentials().get(stateKey(key));
  if (!stored) {
    return null;
  }
  try {
    return (JSON.parse(stored) as NodeSavedState).appState ?? null;
  } catch (error) {
    log.warn(
      "blueskyOAuth: could not read an authorization state, ignoring it",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
};

/** Discard one in-flight authorization state. */
export const deleteStoredBlueskyOAuthState = (key: string): void => {
  blueskyOAuthCredentials().delete(stateKey(key));
};

// Idempotent; never overwrites a shared entry (whatever is shared is at
// least as fresh).
export const migrateAccountBlueskyOAuthCredentials = (
  accountID: number,
): number => {
  const from = accountCredentials(accountID);
  const keys = from
    .keys()
    .filter(
      (key) =>
        key.startsWith(BLUESKY_OAUTH_SESSION_PREFIX) ||
        key.startsWith(BLUESKY_OAUTH_STATE_PREFIX),
    );
  if (keys.length === 0) {
    return 0;
  }

  const shared = blueskyOAuthCredentials();
  let moved = 0;
  for (const key of keys) {
    const value = from.get(key);
    if (value !== null && shared.get(key) === null) {
      shared.set(key, value);
      moved += 1;
    }
    from.delete(key);
  }

  // The account is not named: an account ID identifies a person.
  log.info(
    `blueskyOAuth: moved ${moved} of ${keys.length} Bluesky OAuth credentials into the shared store`,
  );
  return moved;
};

// Run at startup, before anything asks who holds a session: migrating per
// account at database-open is not enough.
export const migrateAllAccountBlueskyOAuthCredentials = (): number => {
  let moved = 0;
  for (const account of getAccounts()) {
    try {
      moved += migrateAccountBlueskyOAuthCredentials(account.id);
    } catch (error) {
      // One unreadable vault must not stop the rest from moving forward.
      log.error(
        "blueskyOAuth: could not carry an account's Bluesky OAuth credentials forward",
        error instanceof Error ? error.name : typeof error,
      );
    }
  }
  return moved;
};
