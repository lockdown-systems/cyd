import "../../__tests__/platform-fixtures/electronMocks";
import "../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const oauthMock = vi.hoisted(() => ({
  authorize: vi.fn(async () => new URL("https://bsky.example/authorize")),
  callback: vi.fn(async () => ({
    session: { did: "did:plc:alice" },
    state: "X:1",
  })),
  restore: vi.fn(async (did: string) => ({ did })),
  revoke: vi.fn(async () => undefined),
  resolve: vi.fn(async () => ({ did: "did:plc:alice" })),
  reset() {
    for (const fn of [
      this.authorize,
      this.callback,
      this.restore,
      this.revoke,
      this.resolve,
    ]) {
      fn.mockClear();
    }
  },
}));

vi.mock("@atproto/oauth-client-node", () => {
  class MockNodeOAuthClient {
    static fetchMetadata = vi.fn(async () => ({ client_id: "https://test" }));
    authorize = oauthMock.authorize;
    callback = oauthMock.callback;
    restore = oauthMock.restore;
    revoke = oauthMock.revoke;
    identityResolver = { resolve: oauthMock.resolve };
  }
  return { NodeOAuthClient: MockNodeOAuthClient };
});

vi.mock("@atproto/api", () => {
  class MockAgent {
    public did?: string;
    constructor(session: Record<string, unknown> = {}) {
      this.did = session.did as string | undefined;
    }
    async getProfile({ actor }: { actor: string }) {
      return {
        data: { did: actor, handle: "alice.bsky.social", displayName: "Alice" },
      };
    }
  }
  return { Agent: MockAgent, RichText: class {}, BlobRef: class {} };
});

vi.mock("../../shared/utils/image-utils", () => ({
  getImageDataURI: vi.fn(async () => ""),
  getImageDimensions: vi.fn(async () => null),
}));

import { BlueskyService } from "../../account_x/controller/bluesky/BlueskyService";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../../account_x/__tests__/fixtures/accountTestHarness";
import {
  createBlueskyControllerTestContext,
  type BlueskyControllerTestContext,
} from "../../account_bluesky/__tests__/fixtures/accountTestHarness";
import { resetBlueskyOAuthClient } from "../client";
import { blueskyHolders } from "../holders";
import { blueskyOAuthCredentials, blueskyOAuthSessionStore } from "../store";

const DID = "did:plc:alice";
const HANDLE = "alice.bsky.social";

const storeSession = async (did: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (blueskyOAuthSessionStore() as any).set(did, {
    dpopJwk: { kty: "EC", d: "private-dpop-key-material" },
    tokenSet: { refresh_token: "refresh-token-value" },
  });

describe("one authorization, every platform", () => {
  let x: XControllerTestContext | null = null;
  let bluesky: BlueskyControllerTestContext | null = null;

  const xService = () =>
    new BlueskyService(
      x!.controller.db!,
      x!.controller.account!,
      x!.account.id,
      (key) => x!.controller.getConfig(key),
      (key, value) => x!.controller.setConfig(key, value),
      (key) => x!.controller.deleteConfig(key),
      (key) => x!.controller.deleteConfigLike(key),
      (whereClause, params) =>
        x!.controller.fetchTweetsWithMediaAndURLs(whereClause, params),
      () => x!.controller.getMediaPath(),
      () => undefined,
    );

  beforeEach(() => {
    oauthMock.reset();
    resetBlueskyOAuthClient();
    x = createXControllerTestContext();
    bluesky = createBlueskyControllerTestContext();
  });

  afterEach(() => {
    for (const key of blueskyOAuthCredentials().keys()) {
      blueskyOAuthCredentials().delete(key);
    }
    bluesky?.cleanup();
    bluesky = null;
    x?.cleanup();
    x = null;
    resetBlueskyOAuthClient();
  });

  test("X migration first, then the Bluesky platform, with no second sign-in", async () => {
    // The migration wizard authorizes the identity.
    await xService().callback("code=abc&state=s");
    await storeSession(DID);

    // The same identity is then added as a Bluesky account.
    const local = bluesky!.createLocalAccount();
    const started = await local.controller.connect(HANDLE);

    expect(started).toEqual({ status: "reused", did: DID });
    expect(oauthMock.authorize).not.toHaveBeenCalled();
    expect(local.controller.isConnected).toBe(true);
    expect(blueskyHolders(DID)).toHaveLength(2);
  });

  test("Bluesky platform first, then the X migration, with no second sign-in", async () => {
    const local = bluesky!.createLocalAccount();
    await local.controller.completeConnection("code=abc&state=s");
    await storeSession(DID);

    const started = await xService().authorize(HANDLE);

    expect(started).toEqual({ status: "reused", did: DID });
    expect(oauthMock.authorize).not.toHaveBeenCalled();
    expect(await x!.controller.getConfig("blueskyDID")).toBe(DID);
    expect(blueskyHolders(DID)).toHaveLength(2);
  });

  test("reusing a session in the X migration still refreshes the profile", async () => {
    const local = bluesky!.createLocalAccount();
    await local.controller.completeConnection("code=abc&state=s");
    await storeSession(DID);

    await xService().authorize(HANDLE);

    // Binding and reading the identity's current profile happen on the reuse
    // path exactly as they do after a browser authorization.
    expect(oauthMock.restore).toHaveBeenCalledWith(DID);
    expect(await xService().getProfile()).toMatchObject({
      did: DID,
      handle: "alice.bsky.social",
    });
  });

  test("a profile Cyd cannot read is reported rather than silently connected", async () => {
    await storeSession(DID);
    // The session restores well enough to be reused, then the profile call
    // fails: a half-connected migration must say so.
    oauthMock.restore.mockImplementationOnce(
      async (did: string) => ({ did }) as never,
    );
    oauthMock.restore.mockImplementationOnce(async () => {
      throw new Error("PDS unreachable");
    });

    const started = await xService().authorize(HANDLE);

    expect(started).toEqual({
      status: "error",
      error: "Could not read the Bluesky profile for the authorized identity",
    });
  });

  test("an identity with no stored session still opens a browser", async () => {
    const local = bluesky!.createLocalAccount();

    const started = await local.controller.connect(HANDLE);

    expect(started).toEqual({ status: "browser" });
    expect(oauthMock.authorize).toHaveBeenCalledTimes(1);
  });

  test("a stored session that cannot be restored is not reused", async () => {
    await storeSession(DID);
    oauthMock.restore.mockRejectedValueOnce(new Error("refresh token revoked"));
    const local = bluesky!.createLocalAccount();

    const started = await local.controller.connect(HANDLE);

    expect(started).toEqual({ status: "browser" });
    expect(local.controller.isConnected).toBe(false);
  });
});
