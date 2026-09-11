/**
 * The names the Bluesky OAuth round trip is spelled with.
 *
 * The authorization server redirects to a custom URL scheme that Cyd registers
 * with the operating system. Three independent codebases have to agree on that
 * scheme and path — Cyd, `cyd-server`, which publishes the client metadata, and
 * `cyd.social`, which bounces the browser back — and spelling it out separately
 * in each is what broke the callback in #699. Inside Cyd there is now exactly
 * one spelling, here.
 */

// Cyd registers the reverse-domain form of the API host as a protocol client,
// so the production and development builds can be installed side by side
// without fighting over the same scheme.
const PROD_API_HOST = "api.cyd.social";
const DEV_API_HOST = "dev-api.cyd.social";

// Only production talks to the production authorization server. Every other
// mode Cyd ships — dev, local, and open — uses the development one.
const isProdMode = (): boolean => process.env.CYD_MODE === "prod";

/** The API host whose client metadata identifies Cyd to Bluesky. */
export const blueskyOAuthAPIHost = (): string =>
  isProdMode() ? PROD_API_HOST : DEV_API_HOST;

/** The custom URL scheme the authorization callback arrives on. */
export const blueskyOAuthCallbackScheme = (): string =>
  blueskyOAuthAPIHost().split(".").reverse().join(".");

/**
 * The path of the authorization callback, with its trailing slash.
 *
 * A custom-scheme URL has no authority, so the whole callback is scheme plus
 * path: comparing `url.pathname` against this constant is how Cyd recognizes
 * an authorization coming back.
 */
export const BLUESKY_OAUTH_CALLBACK_PATH = "/atproto-oauth-callback/";

/** The full redirect URI registered in Cyd's client metadata. */
export const blueskyOAuthCallbackURL = (): string =>
  `${blueskyOAuthCallbackScheme()}:${BLUESKY_OAUTH_CALLBACK_PATH}`;

// Where the API host publishes the client metadata document that describes Cyd
// to a Bluesky authorization server.
const CLIENT_METADATA_PATH = "bluesky/client-metadata.json";

/**
 * The `client_id` Cyd authorizes as, which is a URL the server fetches. The
 * OAuth client types it as a `https://` URL with a path, so it is spelled that
 * way here rather than widened to a string at the call site.
 */
export const blueskyOAuthClientID = (): `https://${string}/${string}` =>
  `https://${blueskyOAuthAPIHost()}/${CLIENT_METADATA_PATH}`;
