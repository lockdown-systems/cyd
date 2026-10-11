// How a Bluesky authorization finds its way back to whoever started it: a
// flow identifier travels inside the OAuth request, so two authorizations can
// be in the air at once and each returns to the platform that asked. These
// names are a contract between the main process and the renderer.

export type BlueskyOAuthPlatform = "X" | "Bluesky";

export type BlueskyOAuthFlow = {
  platform: BlueskyOAuthPlatform;
  accountID: number;
};

const FLOW_ID_PATTERN = /^(X|Bluesky):(\d+)$/;

// Carried as OAuth application state, so it survives a browser round trip
// and an app restart without Cyd holding anything in memory.
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

// `reused`: the identity is already authorized via the shared session store,
// so the caller binds it with no browser round trip.
export type BlueskyConnectStart =
  | { status: "reused"; did: string }
  | { status: "browser" }
  | { status: "error"; error: string };
