#!/usr/bin/env node

// Finish a Bluesky OAuth authorization that a source run could not receive.
//
// The authorization server sends the browser to a private-use URL that Cyd
// registers with the operating system when it is packaged. A run from the
// source tree registers nothing, so the browser refuses the handoff and the
// authorization stops there. Passing that URL to a second Electron process
// delivers it to the running app exactly as the operating system would: the
// second instance loses the single-instance lock and hands its command line to
// the first, which routes it to the account that started the flow.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import electron from "electron";

/**
 * The callback URL to deliver, given whatever the browser was pointed at.
 *
 * The authorization server does not send the browser straight to the
 * private-use callback. It sends it to its own redirect endpoint, carrying the
 * callback in `redirect_uri` and the OAuth response -- `iss`, `state`, `code`
 * -- beside it. That endpoint URL is what sits in the address bar when the
 * handoff fails, so take it as given and do what the browser would have done:
 * hang the response off the callback as a query string.
 *
 * Assembling that by hand invites putting an `&` where the `?` belongs, which
 * parses as one long pathname, matches no route, and reports only "Invalid Cyd
 * URL".
 *
 * A URL with no `redirect_uri` is passed through untouched, which covers a
 * callback that was already assembled correctly.
 */
const callbackURLFrom = (raw) => {
  let redirect;
  try {
    redirect = new URL(raw);
  } catch {
    return raw;
  }

  const callbackURI = redirect.searchParams.get("redirect_uri");
  if (!callbackURI) {
    return raw;
  }

  const response = new URLSearchParams(redirect.search);
  // The redirect endpoint's own parameters, not part of the OAuth response.
  response.delete("redirect_uri");
  response.delete("redirect_mode");

  const callback = new URL(callbackURI);
  callback.search = response.toString();
  return callback.toString();
};

const argument = process.argv[2];
if (!argument) {
  console.error("Usage: npm run finish-oauth '<URL>'");
  console.error();
  console.error("Either URL works:");
  console.error();
  console.error(
    "  the one in the address bar when the browser refused the handoff,",
  );
  console.error("  https://bsky.social/oauth/authorize/redirect?...");
  console.error();
  console.error("  or the callback itself,");
  console.error("  social.cyd.dev-api:/atproto-oauth-callback/?code=...");
  console.error();
  console.error("Quote it: the query string contains ampersands.");
  process.exit(1);
}

const url = callbackURLFrom(argument);
if (url !== argument) {
  console.log("Delivering callback:", url);
}

// The app reads its config from `build/` relative to the working directory, and
// only when NODE_ENV says this is a development run. Without both, the second
// instance dies before it reaches the single-instance lock.
const repositoryPath = path.resolve(fileURLToPath(import.meta.url), "../..");

const child = spawn(electron, [repositoryPath, url], {
  cwd: repositoryPath,
  env: { ...process.env, NODE_ENV: "development" },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
