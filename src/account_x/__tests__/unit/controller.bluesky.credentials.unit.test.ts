import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import { safeStorageMock } from "../../../__tests__/platform-fixtures/electronMocks";
import {
  accountCredentials,
  type AccountCredentials,
} from "../../../credentials";
import { getConfig, setConfig } from "../../../database";
import { BlueskyService } from "../../controller/bluesky/BlueskyService";
import type { XRateLimitInfo } from "../../../shared_types";
import type { XAccountController } from "../../x_account_controller";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

const oauthMock = vi.hoisted(() => ({
  revoke: vi.fn(async () => undefined),
  restore: vi.fn(async (did: string) => ({ did })),
}));

vi.mock("@atproto/oauth-client-node", () => {
  class MockNodeOAuthClient {
    static fetchMetadata = vi.fn(async () => ({ client_id: "https://test" }));
    revoke = oauthMock.revoke;
    restore = oauthMock.restore;
  }
  return { NodeOAuthClient: MockNodeOAuthClient };
});

import {
  blueskyOAuthCredentials,
  blueskyOAuthSessionStore,
  blueskyOAuthStateStore,
  resetBlueskyOAuthClient,
} from "../../../bluesky_oauth";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sessionStore = () => blueskyOAuthSessionStore() as any;
const stateStore = () => blueskyOAuthStateStore() as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const SESSION_CREDENTIAL = {
  dpopJwk: { kty: "EC", d: "private-dpop-key-material" },
  tokenSet: { refresh_token: "refresh-token-value" },
};
const STATE_CREDENTIAL = { verifier: "pkce-verifier-value" };

function createService(
  controller: XAccountController,
  accountID: number,
): BlueskyService {
  return new BlueskyService(
    controller.db!,
    controller.account!,
    accountID,
    (key) => controller.getConfig(key),
    (key, value) => controller.setConfig(key, value),
    (key) => controller.deleteConfig(key),
    (key) => controller.deleteConfigLike(key),
    (whereClause, params) =>
      controller.fetchTweetsWithMediaAndURLs(whereClause, params),
    () => controller.getMediaPath(),
    (_info: Partial<XRateLimitInfo>) => undefined,
  );
}

describe("BlueskyService credential storage", () => {
  let context: XControllerTestContext | null = null;
  let credentials: AccountCredentials | null = null;

  beforeEach(() => {
    resetBlueskyOAuthClient();
    context = createXControllerTestContext();
    credentials = accountCredentials(context.account.id);
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    credentials?.deleteAll();
    credentials = null;
    for (const key of blueskyOAuthCredentials().keys()) {
      blueskyOAuthCredentials().delete(key);
    }
    context?.cleanup();
    context = null;
    oauthMock.revoke.mockClear();
    resetBlueskyOAuthClient();
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
  });

  test("stores the OAuth session in the shared store, not SQLite", async () => {
    await sessionStore().set("did:web:cyd", SESSION_CREDENTIAL);

    expect(
      blueskyOAuthCredentials().get("blueskySessionStore-did:web:cyd"),
    ).toBe(JSON.stringify(SESSION_CREDENTIAL));
    // Not in the account's plaintext config table, and not in the account's
    // own vault either: a session belongs to an identity, not to an account.
    expect(
      getConfig("blueskySessionStore-did:web:cyd", context!.controller.db),
    ).toBeNull();
    expect(credentials!.keys()).toEqual([]);
    await expect(sessionStore().get("did:web:cyd")).resolves.toEqual(
      SESSION_CREDENTIAL,
    );
  });

  test("stores the OAuth state in the shared store, not SQLite", async () => {
    await stateStore().set("state-key", STATE_CREDENTIAL);

    expect(blueskyOAuthCredentials().get("blueskyStateStore-state-key")).toBe(
      JSON.stringify(STATE_CREDENTIAL),
    );
    expect(
      getConfig("blueskyStateStore-state-key", context!.controller.db),
    ).toBeNull();
  });

  test("deleting OAuth state removes it rather than blanking it", async () => {
    await stateStore().set("state-key", STATE_CREDENTIAL);

    await stateStore().del("state-key");

    expect(blueskyOAuthCredentials().keys()).toEqual([]);
    await expect(stateStore().get("state-key")).resolves.toBeUndefined();
  });

  test("persists an OAuth session with no credential backend, in the clear", async () => {
    safeStorageMock.getSelectedStorageBackend.mockReturnValue("basic_text");
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    await expect(
      sessionStore().set("did:web:cyd", SESSION_CREDENTIAL),
    ).resolves.toBeUndefined();

    // It goes to the credential vault, disclosed as unprotected, and still
    // never to the account's plaintext config table.
    expect(blueskyOAuthCredentials().keys()).toEqual([
      "blueskySessionStore-did:web:cyd",
    ]);
    expect(
      getConfig("blueskySessionStore-did:web:cyd", context!.controller.db),
    ).toBeNull();
  });

  test("disconnect removes the stored OAuth credentials it last held", async () => {
    const service = createService(context!.controller, context!.account.id);
    await sessionStore().set("did:web:cyd", SESSION_CREDENTIAL);
    await context!.controller.setConfig("blueskyDID", "did:web:cyd");

    await service.disconnect();

    expect(blueskyOAuthCredentials().keys()).toEqual([]);
    expect(oauthMock.revoke).toHaveBeenCalledWith("did:web:cyd");
    expect(await context!.controller.getConfig("blueskyDID")).toBeNull();
  });

  test("disconnect also sweeps credentials left in the account's own vault", async () => {
    const service = createService(context!.controller, context!.account.id);
    // What an install that connected before the store was shared looks like.
    credentials!.set(
      "blueskySessionStore-did:web:cyd",
      JSON.stringify(SESSION_CREDENTIAL),
    );
    await context!.controller.setConfig("blueskyDID", "did:web:cyd");

    await service.disconnect();

    expect(credentials!.keys()).toEqual([]);
  });

  test("the config table refuses to hold credential keys", () => {
    expect(() =>
      setConfig(
        "blueskySessionStore-did:web:cyd",
        JSON.stringify(SESSION_CREDENTIAL),
        context!.controller.db,
      ),
    ).toThrow(/Refusing to store a credential/);
  });

  test("opening an account database sweeps legacy plaintext credentials into the shared store", () => {
    const db = context!.controller.db!;
    db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(
      "blueskySessionStore-did:web:cyd",
      JSON.stringify(SESSION_CREDENTIAL),
    );

    context!.controller.initDB();

    // The sweep moves it out of SQLite and the forward migration carries it
    // into the shared store, where a Bluesky local account can find it.
    expect(
      blueskyOAuthCredentials().get("blueskySessionStore-did:web:cyd"),
    ).toBe(JSON.stringify(SESSION_CREDENTIAL));
    expect(credentials!.keys()).toEqual([]);
    expect(
      context!.controller
        .db!.prepare("SELECT key FROM config WHERE key LIKE ?")
        .all("blueskySessionStore-%"),
    ).toEqual([]);
  });
});
