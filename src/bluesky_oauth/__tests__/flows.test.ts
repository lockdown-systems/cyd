import fs from "fs";
import os from "os";
import path from "path";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import "../../__tests__/platform-fixtures/electronMocks";

const settingsPathHolder = vi.hoisted(() => ({ value: "" }));

vi.mock("../../util", async () => {
  const actual =
    await vi.importActual<typeof import("../../util")>("../../util");
  return { ...actual, getSettingsPath: () => settingsPathHolder.value };
});

import {
  BLUESKY_OAUTH_CALLBACK_PATH,
  blueskyOAuthCallbackScheme,
  blueskyOAuthCallbackSchemeForMode,
  blueskyOAuthCallbackURL,
  blueskyOAuthClientID,
  blueskyOAuthSchemeHandlerMimeTypeForMode,
} from "../constants";
import {
  blueskyOAuthCallbackEventName,
  blueskyOAuthFlowID,
  parseBlueskyOAuthFlowID,
  resolveBlueskyOAuthFlow,
} from "../flows";
import { blueskyOAuthStateStore } from "../store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stateStore = () => blueskyOAuthStateStore() as any;

const storeFlow = async (stateKey: string, appState: string) => {
  await stateStore().set(stateKey, {
    dpopJwk: { kty: "EC", d: "key" },
    verifier: "verifier",
    appState,
  });
};

describe("Bluesky OAuth callback names", () => {
  const originalMode = process.env.CYD_MODE;

  afterEach(() => {
    process.env.CYD_MODE = originalMode;
  });

  test("production and development use different schemes", () => {
    process.env.CYD_MODE = "prod";
    expect(blueskyOAuthCallbackScheme()).toBe("social.cyd.api");

    process.env.CYD_MODE = "dev";
    expect(blueskyOAuthCallbackScheme()).toBe("social.cyd.dev-api");
  });

  test("every mode that is not production talks to the development server", () => {
    for (const mode of ["dev", "local", "open"]) {
      process.env.CYD_MODE = mode;
      expect(blueskyOAuthClientID()).toBe(
        "https://dev-api.cyd.social/bluesky/client-metadata.json",
      );
    }
  });

  test("the packaging config and the app derive the same scheme", () => {
    // forge.config.ts registers the scheme with the operating system from
    // `CYD_ENV` at build time; the app matches callbacks against `CYD_MODE` at
    // runtime. Two spellings of this is what broke the callback in #699.
    for (const mode of ["prod", "dev", "local", "open", undefined]) {
      process.env.CYD_MODE = mode;
      expect(blueskyOAuthCallbackSchemeForMode(mode)).toBe(
        blueskyOAuthCallbackScheme(),
      );
      expect(blueskyOAuthSchemeHandlerMimeTypeForMode(mode)).toBe(
        `x-scheme-handler/${blueskyOAuthCallbackScheme()}`,
      );
    }
  });

  test("the redirect URI is the scheme and the path, spelled once", () => {
    process.env.CYD_MODE = "prod";

    // #699 was two codebases spelling this differently. The path the main
    // process matches on and the URI the client registers come from the same
    // two constants, so they cannot drift apart inside Cyd.
    expect(blueskyOAuthCallbackURL()).toBe(
      `${blueskyOAuthCallbackScheme()}:${BLUESKY_OAUTH_CALLBACK_PATH}`,
    );
    expect(BLUESKY_OAUTH_CALLBACK_PATH).toBe("/atproto-oauth-callback/");
    expect(new URL(blueskyOAuthCallbackURL()).pathname).toBe(
      BLUESKY_OAUTH_CALLBACK_PATH,
    );
  });
});

describe("Bluesky OAuth flow identifiers", () => {
  const originalMode = process.env.CYD_MODE;

  beforeEach(() => {
    settingsPathHolder.value = fs.mkdtempSync(
      path.join(os.tmpdir(), "cyd-bluesky-flows-"),
    );
  });

  afterEach(() => {
    process.env.CYD_MODE = originalMode;
    fs.rmSync(settingsPathHolder.value, { recursive: true, force: true });
  });

  test("round-trips a flow through its identifier", () => {
    for (const flow of [
      { platform: "X" as const, accountID: 7 },
      { platform: "Bluesky" as const, accountID: 12 },
    ]) {
      expect(parseBlueskyOAuthFlowID(blueskyOAuthFlowID(flow))).toEqual(flow);
    }
  });

  test("rejects an identifier Cyd did not write", () => {
    for (const flowID of ["", "7", "X:", "Mastodon:7", "X:seven", null]) {
      expect(parseBlueskyOAuthFlowID(flowID)).toBeNull();
    }
  });

  test("each flow listens on its own renderer event", () => {
    expect(blueskyOAuthCallbackEventName({ platform: "X", accountID: 7 })).toBe(
      "blueskyOAuthCallback-X:7",
    );
    expect(
      blueskyOAuthCallbackEventName({ platform: "Bluesky", accountID: 7 }),
    ).toBe("blueskyOAuthCallback-Bluesky:7");
  });

  test("routes a callback to whichever platform started it", async () => {
    await storeFlow("state-from-bluesky", "Bluesky:12");

    expect(
      resolveBlueskyOAuthFlow("?state=state-from-bluesky&code=abc"),
    ).toEqual({ platform: "Bluesky", accountID: 12 });
  });

  test("routes interleaved authorizations to their own initiators", async () => {
    // Two flows in the air at once: the old single global account-ID key could
    // only remember the most recent one.
    await storeFlow("state-x", "X:7");
    await storeFlow("state-bluesky", "Bluesky:12");

    expect(resolveBlueskyOAuthFlow("?state=state-bluesky&code=b")).toEqual({
      platform: "Bluesky",
      accountID: 12,
    });
    expect(resolveBlueskyOAuthFlow("?state=state-x&code=a")).toEqual({
      platform: "X",
      accountID: 7,
    });
  });

  test("dispatches nothing for a callback Cyd holds no state for", () => {
    expect(resolveBlueskyOAuthFlow("?state=never-issued&code=abc")).toBeNull();
    expect(resolveBlueskyOAuthFlow("?code=abc")).toBeNull();
    expect(resolveBlueskyOAuthFlow("")).toBeNull();
  });

  test("a callback URL built from the constants reaches the right renderer event", async () => {
    process.env.CYD_MODE = "prod";
    await storeFlow("state-x", "X:7");

    // Exactly the hop #699 broke: the URL the authorization server redirects
    // to, matched against what the main process listens for.
    const url = new URL(`${blueskyOAuthCallbackURL()}?state=state-x&code=abc`);
    expect(url.pathname).toBe(BLUESKY_OAUTH_CALLBACK_PATH);

    const flow = resolveBlueskyOAuthFlow(url.search);
    expect(flow).not.toBeNull();
    expect(blueskyOAuthCallbackEventName(flow!)).toBe(
      "blueskyOAuthCallback-X:7",
    );
  });

  test("leaves the authorization state in place for the client to spend", async () => {
    await storeFlow("state-x", "X:7");

    resolveBlueskyOAuthFlow("?state=state-x&code=a");

    await expect(stateStore().get("state-x")).resolves.toMatchObject({
      appState: "X:7",
    });
  });
});
