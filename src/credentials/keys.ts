/**
 * The names Cyd stores account-control credentials under.
 *
 * They live here, apart from every module that reads or writes them, so that
 * the credential store, the legacy sweep, and the config table's guard all
 * agree on what counts as a credential. Adding a credential kind means adding
 * it here once.
 */

// A Bluesky OAuth authorization state, which carries the PKCE verifier and a
// private DPoP key. Keyed by the OAuth `state` parameter.
export const BLUESKY_OAUTH_STATE_PREFIX = "blueskyStateStore-";

// A Bluesky OAuth session, which carries access and refresh tokens and a
// private DPoP key. Keyed by the DID it authorizes, and shared by every part
// of Cyd that acts on that identity.
export const BLUESKY_OAUTH_SESSION_PREFIX = "blueskySessionStore-";

export const CREDENTIAL_KEY_PREFIXES = [
  BLUESKY_OAUTH_STATE_PREFIX,
  BLUESKY_OAUTH_SESSION_PREFIX,
];

/**
 * Whether a name belongs to the credential store rather than to ordinary
 * storage. Cyd once wrote these keys into the plaintext config table.
 */
export const isCredentialKey = (key: string): boolean =>
  CREDENTIAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
