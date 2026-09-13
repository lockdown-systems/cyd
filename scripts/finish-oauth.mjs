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

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run finish-oauth '<callback URL>'");
  console.error();
  console.error(
    "The URL is the one the browser refused to open. Chromium logs it to the",
  );
  console.error(
    "devtools console; it starts with the scheme Cyd registers, for example",
  );
  console.error("social.cyd.dev-api:/atproto-oauth-callback/?code=...");
  console.error();
  console.error("Quote it: the query string contains an ampersand.");
  process.exit(1);
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
