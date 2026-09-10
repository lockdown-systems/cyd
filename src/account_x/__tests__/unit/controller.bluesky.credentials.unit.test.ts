import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import { safeStorageMock } from "../../../__tests__/platform-fixtures/electronMocks";
import {
  CredentialStorageUnavailableError,
  accountCredentialNamespace,
  deleteCredentialNamespace,
  getCredential,
  listCredentialKeys,
  setCredential,
} from "../../../credentials";
import { getConfig, setConfig } from "../../../database";
import { BlueskyService } from "../../controller/bluesky/BlueskyService";
import type { XRateLimitInfo } from "../../../shared_types";
import type { XAccountController } from "../../x_account_controller";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

type OAuthClientOptions = {
  stateStore: {
    set: (key: string, value: unknown) => Promise<void>;
    get: (key: string) => Promise<unknown>;
    del: (key: string) => Promise<void>;
  };
  sessionStore: {
    set: (sub: string, value: unknown) => Promise<void>;
    get: (sub: string) => Promise<unknown>;
    del: (sub: string) => Promise<void>;
  };
};

const oauthClientMock = vi.hoisted(() => ({
  capturedOptions: [] as unknown[],
}));

vi.mock("@atproto/oauth-client-node", () => {
  class MockNodeOAuthClient {
    static fetchMetadata = vi.fn(async () => ({ client_id: "https://test" }));

    constructor(options: unknown) {
      oauthClientMock.capturedOptions.push(options);
    }
  }
  return { NodeOAuthClient: MockNodeOAuthClient };
});

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

const oauthStores = async (
  service: BlueskyService,
): Promise<OAuthClientOptions> => {
  oauthClientMock.capturedOptions.length = 0;
  await service.initClient();
  return oauthClientMock.capturedOptions[0] as OAuthClientOptions;
};

describe("BlueskyService credential storage", () => {
  let context: XControllerTestContext | null = null;
  let namespace = "";

  beforeEach(() => {
    context = createXControllerTestContext();
    namespace = accountCredentialNamespace(context.account.id);
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    deleteCredentialNamespace(namespace);
    context?.cleanup();
    context = null;
    oauthClientMock.capturedOptions.length = 0;
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
  });

  test("stores the OAuth session in protected storage, not SQLite", async () => {
    const service = createService(context!.controller, context!.account.id);
    const stores = await oauthStores(service);

    await stores.sessionStore.set("did:web:cyd", SESSION_CREDENTIAL);

    expect(getCredential(namespace, "blueskySessionStore-did:web:cyd")).toBe(
      JSON.stringify(SESSION_CREDENTIAL),
    );
    expect(
      getConfig("blueskySessionStore-did:web:cyd", context!.controller.db),
    ).toBeNull();
    await expect(stores.sessionStore.get("did:web:cyd")).resolves.toEqual(
      SESSION_CREDENTIAL,
    );
  });

  test("stores the OAuth state in protected storage, not SQLite", async () => {
    const service = createService(context!.controller, context!.account.id);
    const stores = await oauthStores(service);

    await stores.stateStore.set("state-key", STATE_CREDENTIAL);

    expect(getCredential(namespace, "blueskyStateStore-state-key")).toBe(
      JSON.stringify(STATE_CREDENTIAL),
    );
    expect(
      getConfig("blueskyStateStore-state-key", context!.controller.db),
    ).toBeNull();
  });

  test("deleting OAuth state removes it rather than blanking it", async () => {
    const service = createService(context!.controller, context!.account.id);
    const stores = await oauthStores(service);
    await stores.stateStore.set("state-key", STATE_CREDENTIAL);

    await stores.stateStore.del("state-key");

    expect(listCredentialKeys(namespace)).toEqual([]);
    await expect(stores.stateStore.get("state-key")).resolves.toBeUndefined();
  });

  test("refuses to persist an OAuth session with no credential backend", async () => {
    const service = createService(context!.controller, context!.account.id);
    const stores = await oauthStores(service);
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false);

    await expect(
      stores.sessionStore.set("did:web:cyd", SESSION_CREDENTIAL),
    ).rejects.toBeInstanceOf(CredentialStorageUnavailableError);

    safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
    expect(listCredentialKeys(namespace)).toEqual([]);
    expect(
      getConfig("blueskySessionStore-did:web:cyd", context!.controller.db),
    ).toBeNull();
  });

  test("disconnect removes stored OAuth credentials", async () => {
    const service = createService(context!.controller, context!.account.id);
    setCredential(
      namespace,
      "blueskySessionStore-did:web:cyd",
      JSON.stringify(SESSION_CREDENTIAL),
    );
    setCredential(
      namespace,
      "blueskyStateStore-state-key",
      JSON.stringify(STATE_CREDENTIAL),
    );
    await context!.controller.setConfig("blueskyDID", "did:web:cyd");
    vi.spyOn(service, "initClient").mockResolvedValue({
      restore: vi.fn().mockResolvedValue({ signOut: vi.fn() }),
    } as never);

    await service.disconnect();

    expect(listCredentialKeys(namespace)).toEqual([]);
    expect(await context!.controller.getConfig("blueskyDID")).toBeNull();
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

  test("opening an account database sweeps legacy plaintext credentials", () => {
    const db = context!.controller.db!;
    db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(
      "blueskySessionStore-did:web:cyd",
      JSON.stringify(SESSION_CREDENTIAL),
    );

    context!.controller.initDB();

    expect(getCredential(namespace, "blueskySessionStore-did:web:cyd")).toBe(
      JSON.stringify(SESSION_CREDENTIAL),
    );
    expect(
      context!.controller
        .db!.prepare("SELECT key FROM config WHERE key LIKE ?")
        .all("blueskySessionStore-%"),
    ).toEqual([]);
  });
});
