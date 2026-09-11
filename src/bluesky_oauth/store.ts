import log from "electron-log/main";

import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from "@atproto/oauth-client-node";

import {
  BLUESKY_OAUTH_SESSION_PREFIX,
  BLUESKY_OAUTH_STATE_PREFIX,
  accountCredentials,
  sharedCredentials,
  type AccountCredentials,
} from "../credentials";

/**
 * Where every Bluesky OAuth session lives, for every part of Cyd.
 *
 * Sessions are keyed by DID, which is the Bluesky identity itself, so one
 * authorization serves every Cyd account that reaches for that identity: the X
 * platform's migration and the Bluesky platform both find the same entry. They
 * used to live in `account-${accountID}` vaults, which made a session
 * authorized under one account invisible to another and turned "disconnect"
 * into a prefix wipe of a whole vault.
 *
 * Nothing here deletes by prefix. A session belongs to a DID, and only that
 * DID's entry is ever removed.
 */
const BLUESKY_OAUTH_VAULT = "bluesky-oauth";

export const blueskyOAuthCredentials = (): AccountCredentials =>
  sharedCredentials(BLUESKY_OAUTH_VAULT);

const stateKey = (key: string): string => `${BLUESKY_OAUTH_STATE_PREFIX}${key}`;

const sessionKey = (did: string): string =>
  `${BLUESKY_OAUTH_SESSION_PREFIX}${did}`;

/**
 * The OAuth authorization state, which carries the PKCE verifier and a private
 * DPoP key. It is short-lived: the client deletes each entry once the matching
 * authorization comes back.
 */
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

/**
 * The OAuth session, which carries access and refresh tokens and a private
 * DPoP key, keyed by the DID it authorizes.
 */
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

/**
 * Remove one identity's session and DPoP key material, and nothing else.
 *
 * This is the local half of revocation. Callers reach it through
 * `releaseBlueskyHold`, which revokes upstream first, because dropping the
 * local copy on its own leaves a refresh token alive at the PDS.
 */
export const deleteStoredBlueskyOAuthSession = (did: string): void => {
  blueskyOAuthCredentials().delete(sessionKey(did));
};

/** Every in-flight authorization state, by its OAuth `state` parameter. */
export const storedBlueskyOAuthStateKeys = (): string[] =>
  blueskyOAuthCredentials()
    .keys()
    .filter((key) => key.startsWith(BLUESKY_OAUTH_STATE_PREFIX))
    .map((key) => key.slice(BLUESKY_OAUTH_STATE_PREFIX.length));

/**
 * The application state an authorization was started with, read without
 * consuming it: the OAuth client still needs the entry to finish the callback.
 *
 * Returns null when the state is unknown, which is what a stale, forged, or
 * already-completed callback looks like.
 */
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

/**
 * Move an account's Bluesky OAuth credentials into the shared store.
 *
 * Before the store was shared, the X migration wrote its sessions into the
 * account's own vault, where a Bluesky local account for the same identity
 * could not see them. Running this when an account database opens carries
 * those sessions forward, so nobody has to authorize an identity Cyd already
 * holds a live session for. It is idempotent, and it never overwrites a
 * shared entry: whatever is already shared is at least as fresh.
 */
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

  log.info(
    `blueskyOAuth: moved ${moved} of ${keys.length} Bluesky OAuth credentials for account ${accountID} into the shared store`,
  );
  return moved;
};
