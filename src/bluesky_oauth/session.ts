import { shell } from "electron";
import log from "electron-log/main";

import { Agent } from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client-node";

import {
  blueskyOAuthFlowID,
  parseBlueskyOAuthFlowID,
  type BlueskyConnectStart,
  type BlueskyIdentityProfile,
  type BlueskyOAuthFlow,
} from "../shared_types";
import { getAccount } from "../database/account";

import { getBlueskyOAuthClient, resetBlueskyOAuthClient } from "./client";
import { blueskyOAuthCallbackURL } from "./constants";
import { blueskyHolders } from "./holders";
import {
  deleteStoredBlueskyOAuthSession,
  deleteStoredBlueskyOAuthState,
  hasStoredBlueskyOAuthSession,
  storedBlueskyOAuthAppState,
  storedBlueskyOAuthDIDs,
  storedBlueskyOAuthStateKeys,
} from "./store";

// Authorizing, restoring, and releasing a Bluesky identity. Every platform
// in Cyd reaches Bluesky through this file: OAuth against the identity's own
// PDS, never an app password.

/** The outcome of finishing a browser authorization. */
export type BlueskyAuthorization =
  | { ok: true; did: string; flow: BlueskyOAuthFlow | null }
  | { ok: false; error: string };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Every platform restores through here, so all platforms share one live session.
export const restoreBlueskySession = async (
  did: string,
): Promise<OAuthSession> => {
  const client = await getBlueskyOAuthClient();
  return client.restore(did);
};

/** Whether Cyd can act on this identity right now, without a new sign-in. */
export const blueskySessionIsUsable = async (did: string): Promise<boolean> => {
  if (!hasStoredBlueskyOAuthSession(did)) {
    return false;
  }
  try {
    await restoreBlueskySession(did);
    return true;
  } catch (error) {
    log.warn(
      "blueskyOAuth: a stored session could not be restored",
      errorMessage(error),
    );
    return false;
  }
};

/** People write their handle the way they see it on Bluesky. */
const normalizeHandle = (handle: string): string =>
  handle.startsWith("@") ? handle.slice(1) : handle;

// Handles change and DIDs do not: every session decision is made on the DID.
const resolveBlueskyIdentifier = async (
  identifier: string,
): Promise<string | null> => {
  try {
    const client = await getBlueskyOAuthClient();
    const { did } = await client.identityResolver.resolve(identifier);
    return did;
  } catch (error) {
    // Resolution failure is not a connection failure; the authorization
    // request will report a bad handle properly.
    log.info(
      "blueskyOAuth: could not resolve an identifier before authorizing",
      errorMessage(error),
    );
    return null;
  }
};

// When Cyd already holds a usable session for the identity behind the handle,
// the caller becomes another holder of it without a second sign-in. Otherwise
// a browser authorization starts, carrying the flow identifier as OAuth state
// so the answer finds its way back to whichever platform asked.
export const authorizeBlueskyIdentity = async (
  handle: string,
  flow: BlueskyOAuthFlow,
): Promise<BlueskyConnectStart> => {
  const normalizedHandle = normalizeHandle(handle);

  const did = await resolveBlueskyIdentifier(normalizedHandle);
  if (did && (await blueskySessionIsUsable(did))) {
    log.info("blueskyOAuth: reusing an existing session for an identity");
    return { status: "reused", did };
  }

  try {
    const client = await getBlueskyOAuthClient();
    const url = await client.authorize(normalizedHandle, {
      redirect_uri: blueskyOAuthCallbackURL(),
      state: blueskyOAuthFlowID(flow),
    });
    await shell.openExternal(url.toString());
    return { status: "browser" };
  } catch (error) {
    log.error("blueskyOAuth: could not start an authorization", error);
    return { status: "error", error: errorMessage(error) };
  }
};

// The session is written to the shared store under its DID, so one
// authorization serves every part of Cyd that wants that identity.
export const completeBlueskyAuthorization = async (
  queryString: string,
): Promise<BlueskyAuthorization> => {
  const params = new URLSearchParams(queryString);

  // The authorization server reports a refusal in the redirect itself, before
  // there is anything to exchange.
  const errorDescription = params.get("error_description");
  if (errorDescription) {
    return { ok: false, error: errorDescription };
  }
  const error = params.get("error");
  if (error) {
    return {
      ok: false,
      error: `The authorization failed with error: ${error}`,
    };
  }

  try {
    const client = await getBlueskyOAuthClient();
    // The token exchange has to name the same redirect URI the authorization
    // was requested with, or the authorization server refuses it.
    const { session, state } = await client.callback(params, {
      redirect_uri: blueskyOAuthCallbackURL(),
    });
    // The authorization code and the OAuth state are authorization material,
    // so neither is ever logged.
    log.info("blueskyOAuth: an identity completed authorization");
    return {
      ok: true,
      did: session.did,
      flow: parseBlueskyOAuthFlowID(state),
    };
  } catch (e) {
    log.error("blueskyOAuth: could not finish an authorization", e);
    return { ok: false, error: errorMessage(e) };
  }
};

/** Current profile data for an identity Cyd holds a session for. */
export const getBlueskyProfile = async (
  did: string,
): Promise<BlueskyIdentityProfile | null> => {
  let session: OAuthSession;
  try {
    session = await restoreBlueskySession(did);
  } catch (error) {
    log.warn(
      "blueskyOAuth: could not restore a session to read a profile",
      errorMessage(error),
    );
    return null;
  }

  const agent = new Agent(session);
  if (!agent.did) {
    return null;
  }
  const profile = await agent.getProfile({ actor: agent.did });
  return {
    did: profile.data.did,
    handle: profile.data.handle,
    displayName: profile.data.displayName,
    avatar: profile.data.avatar,
  };
};

// Revoke upstream first (the refresh token is needed to do it), but delete
// local material regardless of whether the revocation succeeded.
const revokeBlueskyIdentity = async (did: string): Promise<void> => {
  try {
    const client = await getBlueskyOAuthClient();
    // revoke() invalidates the tokens at the server and drops them from the
    // session store, even when the issuer cannot be reached.
    await client.revoke(did);
  } catch (error) {
    log.error(
      "blueskyOAuth: could not revoke a session upstream, discarding it locally",
      errorMessage(error),
    );
  }
  deleteStoredBlueskyOAuthSession(did);
  log.info("blueskyOAuth: revoked a session and deleted its local material");
};

// The caller has already cleared its own state, so this only asks who is
// left: while anyone holds the identity the session stays; when nobody does
// it is revoked. No caller can force a revocation on another holder.
export const releaseBlueskyHold = async (did: string): Promise<void> => {
  if (!did) {
    return;
  }
  if (blueskyHolders(did).length > 0) {
    log.info(
      "blueskyOAuth: an identity is still held, leaving its session alone",
    );
    return;
  }
  await revokeBlueskyIdentity(did);
};

// Startup sweep: revoke sessions nothing holds, discard authorizations
// nothing can finish. Makes interrupted work self-correcting.
export const sweepOrphanedBlueskyOAuth = async (): Promise<number> => {
  let swept = 0;

  for (const did of storedBlueskyOAuthDIDs()) {
    let holderCount: number;
    try {
      holderCount = blueskyHolders(did).length;
    } catch (error) {
      // An unreadable account might still hold this identity, so leave it
      // alone; catch per DID so one failure doesn't stop the sweep.
      log.error(
        "blueskyOAuth: could not decide whether an identity is still held, leaving it alone",
        errorMessage(error),
      );
      continue;
    }
    if (holderCount > 0) {
      continue;
    }
    log.info("blueskyOAuth: sweeping a session with no holders");
    await revokeBlueskyIdentity(did);
    swept += 1;
  }

  for (const stateKey of storedBlueskyOAuthStateKeys()) {
    const flow = parseBlueskyOAuthFlowID(storedBlueskyOAuthAppState(stateKey));
    // Unreadable state or a gone account means it can never be completed; an
    // account that still exists may be finishing it in the browser right now.
    if (!flow || getAccount(flow.accountID) === null) {
      deleteStoredBlueskyOAuthState(stateKey);
      swept += 1;
    }
  }

  if (swept > 0) {
    // A swept session may have been the one the cached client was holding.
    resetBlueskyOAuthClient();
  }
  return swept;
};
