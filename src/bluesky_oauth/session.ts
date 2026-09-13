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

/**
 * Authorizing, restoring, and releasing a Bluesky identity.
 *
 * Every platform in Cyd reaches Bluesky through this file. Authorization is
 * OAuth against the identity's own PDS and every call afterwards is a direct
 * AT Protocol call: Cyd never asks for an app password, never scrapes a page,
 * and never intercepts a request.
 */

/** The outcome of finishing a browser authorization. */
export type BlueskyAuthorization =
  | { ok: true; did: string; flow: BlueskyOAuthFlow | null }
  | { ok: false; error: string };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The live session for an identity, refreshed if it is close to expiring.
 *
 * Every platform restores through here, so a session refreshed for the X
 * migration is the same one the Bluesky platform picks up a moment later.
 */
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

/**
 * The identity behind a handle. Handles change and DIDs do not, so every
 * decision about a session is made on the DID.
 */
const resolveBlueskyIdentifier = async (
  identifier: string,
): Promise<string | null> => {
  try {
    const client = await getBlueskyOAuthClient();
    const { did } = await client.identityResolver.resolve(identifier);
    return did;
  } catch (error) {
    // Not being able to resolve a handle is not a failure to connect: it just
    // means Cyd cannot shortcut, and the authorization request will report a
    // bad handle properly.
    log.info(
      "blueskyOAuth: could not resolve an identifier before authorizing",
      errorMessage(error),
    );
    return null;
  }
};

/**
 * Connect a handle on behalf of one flow.
 *
 * When Cyd already holds a usable session for the identity behind the handle,
 * nothing opens: the caller simply becomes another holder of the session that
 * is already there. That is what keeps a person from authorizing the same
 * identity twice, once through the X migration wizard and once as a Bluesky
 * account.
 *
 * Otherwise a browser authorization starts, carrying the flow identifier as
 * the OAuth request's application state so the answer finds its way back to
 * whichever platform asked — even if Cyd is restarted in between, and even if
 * another authorization is already in the air.
 */
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

/**
 * Finish a browser authorization.
 *
 * The session it produces is written to the shared store under the DID it
 * authorizes, which is what makes one authorization enough for every part of
 * Cyd that wants that identity.
 */
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

/**
 * Sign an identity out at its PDS and destroy every local trace of it.
 *
 * Revoking upstream comes first, because once the refresh token is gone
 * locally Cyd can no longer tell the authorization server to invalidate it. A
 * server Cyd cannot reach must not strand the local material either, so the
 * local delete runs whether or not the revocation succeeded.
 */
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

/**
 * Release one account's hold on an identity.
 *
 * The caller has already made its own state say it is disconnected — cleared
 * its DID, or deleted the account — so this only has to ask who is left. While
 * anyone is, the session stays exactly as it is and nobody is signed out. When
 * nobody is, the session is revoked at the PDS and every local trace of it is
 * destroyed.
 *
 * No caller passes in which holder it was, and none can force a revocation: an
 * account can only ever release its own hold.
 */
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

/**
 * Revoke sessions nothing holds and discard authorizations nothing can finish.
 *
 * Interrupted work is the only way to reach either state: a quit between
 * clearing an account's connection and revoking its session, or an account
 * deleted while its browser authorization was still open. Run at startup, this
 * makes both self-correcting rather than permanent.
 */
export const sweepOrphanedBlueskyOAuth = async (): Promise<number> => {
  let swept = 0;

  for (const did of storedBlueskyOAuthDIDs()) {
    let holderCount: number;
    try {
      holderCount = blueskyHolders(did).length;
    } catch (error) {
      // An account whose state cannot be read might still be holding this
      // identity, so it is left alone. One unreadable account must not stop
      // the sweep for every other identity, which is why this is caught per
      // DID rather than around the loop.
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
    // An authorization whose state Cyd cannot read, or whose account is gone,
    // can never be completed. An authorization for an account that still
    // exists is left alone: the user may be finishing it in their browser
    // right now, and on Linux and Windows that can outlive the app.
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
