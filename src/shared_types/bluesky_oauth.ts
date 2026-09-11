/**
 * How a Bluesky authorization finds its way back to whoever started it.
 *
 * Cyd used to remember the account in a single global config key and dispatch
 * the callback to `blueskyOAuthCallback-${accountID}`. That allowed exactly one
 * authorization at a time and assumed the initiator was an X account. A flow
 * identifier travels inside the OAuth request instead, so two authorizations
 * can be in the air at once and each comes back to the platform that asked.
 *
 * These names are a contract between the main process, which routes the
 * callback, and the renderer, which listens for it, so they live with the
 * other shared types rather than inside either side.
 */

export type BlueskyOAuthPlatform = "X" | "Bluesky";

export type BlueskyOAuthFlow = {
  platform: BlueskyOAuthPlatform;
  accountID: number;
};

const FLOW_ID_PATTERN = /^(X|Bluesky):(\d+)$/;

/**
 * The flow identifier, carried as the OAuth request's application state. The
 * authorization server echoes it back, so the identifier survives a browser
 * round trip and an app restart without Cyd holding anything in memory.
 */
export const blueskyOAuthFlowID = (flow: BlueskyOAuthFlow): string =>
  `${flow.platform}:${flow.accountID}`;

export const parseBlueskyOAuthFlowID = (
  flowID: string | null | undefined,
): BlueskyOAuthFlow | null => {
  const match = flowID ? FLOW_ID_PATTERN.exec(flowID) : null;
  if (!match) {
    return null;
  }
  return {
    platform: match[1] as BlueskyOAuthPlatform,
    accountID: Number(match[2]),
  };
};

/** The renderer event one flow's answer is delivered on. */
export const blueskyOAuthCallbackEventName = (flow: BlueskyOAuthFlow): string =>
  `blueskyOAuthCallback-${blueskyOAuthFlowID(flow)}`;

/**
 * What happened when a platform asked to connect a handle.
 *
 * `reused` is the point of sharing one session store across platforms: the
 * identity is already authorized, so the caller binds it and there is no
 * browser round trip and no callback to wait for.
 */
export type BlueskyConnectStart =
  | { status: "reused"; did: string }
  | { status: "browser" }
  | { status: "error"; error: string };
