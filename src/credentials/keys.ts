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

/**
 * Where an X account records the Bluesky identity its migration is connected
 * to.
 *
 * A DID is a public identifier, not a credential, so this key holds nothing
 * secret and the config table is free to store it. It lives here anyway,
 * beside the credential names, because it is the thing that points at them:
 * the legacy sweep, the migration service, and the holder derivation all have
 * to agree on it, and they sit in three different layers.
 */
export const BLUESKY_DID_CONFIG_KEY = "blueskyDID";

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
