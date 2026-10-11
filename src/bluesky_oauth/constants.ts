// The names the Bluesky OAuth round trip is spelled with: Cyd, `cyd-server`,
// and `cyd.social` all have to agree on the scheme and path. Inside Cyd there
// is exactly one spelling, here.

// Cyd registers the reverse-domain form of the API host as a protocol client,
// so the production and development builds can be installed side by side
// without fighting over the same scheme.
const PROD_API_HOST = "api.cyd.social";
const DEV_API_HOST = "dev-api.cyd.social";

// Only production talks to the production authorization server; every other
// mode uses the development one. The mode is passed in because the app reads
// `CYD_MODE` at runtime and the packaging config reads `CYD_ENV` at build time.
export const blueskyOAuthAPIHostForMode = (mode: string | undefined): string =>
  mode === "prod" ? PROD_API_HOST : DEV_API_HOST;

export const blueskyOAuthAPIHost = (): string =>
  blueskyOAuthAPIHostForMode(process.env.CYD_MODE);

// The packaging config registers this scheme with the OS and the app matches
// callbacks against it; both build it from here.
export const blueskyOAuthCallbackSchemeForMode = (
  mode: string | undefined,
): string => blueskyOAuthAPIHostForMode(mode).split(".").reverse().join(".");

export const blueskyOAuthCallbackScheme = (): string =>
  blueskyOAuthCallbackSchemeForMode(process.env.CYD_MODE);

/** The desktop-entry MIME type that registers the scheme on Linux. */
export const blueskyOAuthSchemeHandlerMimeTypeForMode = (
  mode: string | undefined,
): string => `x-scheme-handler/${blueskyOAuthCallbackSchemeForMode(mode)}`;

/**
 * The path of the authorization callback, with its trailing slash.
 *
 * A custom-scheme URL has no authority, so the whole callback is scheme plus
 * path: comparing `url.pathname` against this constant is how Cyd recognizes
 * an authorization coming back.
 */
export const BLUESKY_OAUTH_CALLBACK_PATH = "/atproto-oauth-callback/";

/** The shape `@atproto/oauth-client` recognizes a private-use redirect URI by. */
type PrivateUseURI = `${string}.${string}:/${string}`;

// A single slash follows the colon because a private-use URI scheme has no
// naming authority (RFC 8252 section 7.1); the cast asserts that shape.
export const blueskyOAuthCallbackURL = (): PrivateUseURI =>
  `${blueskyOAuthCallbackScheme()}:${BLUESKY_OAUTH_CALLBACK_PATH}` as PrivateUseURI;

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
