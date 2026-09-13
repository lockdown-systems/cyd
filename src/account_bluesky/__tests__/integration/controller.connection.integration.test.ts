import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const oauthMock = vi.hoisted(() => ({
  authorize: vi.fn(async () => new URL("https://bsky.example/authorize")),
  callback: vi.fn(async () => ({
    session: { did: "did:plc:alice" },
    state: "Bluesky:1",
  })),
  restore: vi.fn(async (did: string) => ({ did })),
  revoke: vi.fn(async () => undefined),
  resolve: vi.fn(async () => {
    throw new Error("handle does not resolve in this test");
  }),
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

const profileMock = vi.hoisted(() => ({
  handle: "alice.bsky.social",
  displayName: "Alice",
  avatar: "https://cdn.example/alice.jpg",
}));

vi.mock("@atproto/api", () => {
  class MockAgent {
    public did?: string;
    constructor(session: Record<string, unknown> = {}) {
      this.did = session.did as string | undefined;
    }
    async getProfile({ actor }: { actor: string }) {
      return {
        data: {
          did: actor,
          handle: profileMock.handle,
          displayName: profileMock.displayName,
          avatar: profileMock.avatar,
        },
      };
    }
  }
  return { Agent: MockAgent };
});

vi.mock("../../../shared/utils/image-utils", () => ({
  getImageDataURI: vi.fn(async (url: string) =>
    url ? `data:image/jpeg;base64,${url}` : "",
  ),
  getImageDimensions: vi.fn(async () => null),
}));

import {
  blueskyOAuthCallbackURL,
  resetBlueskyOAuthClient,
} from "../../../bluesky_oauth";
import {
  blueskyOAuthCredentials,
  blueskyOAuthSessionStore,
  hasStoredBlueskyOAuthSession,
} from "../../../bluesky_oauth";
import {
  createBlueskyControllerTestContext,
  type BlueskyControllerTestContext,
} from "../fixtures/accountTestHarness";

const DID = "did:plc:alice";

const storeSession = async (did: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (blueskyOAuthSessionStore() as any).set(did, {
    dpopJwk: { kty: "EC", d: "private-dpop-key-material" },
    tokenSet: { refresh_token: "refresh-token-value" },
  });

describe("Bluesky local account connection", () => {
  let context: BlueskyControllerTestContext | null = null;

  beforeEach(() => {
    oauthMock.reset();
    profileMock.handle = "alice.bsky.social";
    profileMock.displayName = "Alice";
    profileMock.avatar = "https://cdn.example/alice.jpg";
    resetBlueskyOAuthClient();
    context = createBlueskyControllerTestContext();
  });

  afterEach(() => {
    for (const key of blueskyOAuthCredentials().keys()) {
      blueskyOAuthCredentials().delete(key);
    }
    context?.cleanup();
    context = null;
    resetBlueskyOAuthClient();
  });

  test("starts a browser authorization carrying its own flow identifier", async () => {
    const { account, controller } = context!.createLocalAccount();

    const started = await controller.connect("@alice.bsky.social");

    expect(started).toEqual({ status: "browser" });
    expect(oauthMock.authorize).toHaveBeenCalledWith("alice.bsky.social", {
      redirect_uri: blueskyOAuthCallbackURL(),
      state: `Bluesky:${account.id}`,
    });
  });

  test("binds the identity and takes its profile on success", async () => {
    const { controller } = context!.createLocalAccount();

    const result = await controller.completeConnection("code=abc&state=s");

    expect(result).toBe(true);
    expect(controller.isConnected).toBe(true);
    expect(controller.account?.did).toBe(DID);
    expect(controller.account?.handle).toBe("alice.bsky.social");
    expect(controller.account?.displayName).toBe("Alice");
    expect(controller.account?.profileImageDataURI).toContain("data:image");
  });

  test("reports a refused authorization without binding anything", async () => {
    const { controller } = context!.createLocalAccount();

    const result = await controller.completeConnection(
      "error=access_denied&error_description=denied",
    );

    expect(result).toBe("denied");
    expect(controller.isConnected).toBe(false);
    expect(controller.account?.did).toBeNull();
  });

  test("reports a failed code exchange without binding anything", async () => {
    const { controller } = context!.createLocalAccount();
    oauthMock.callback.mockRejectedValueOnce(new Error("bad code"));

    const result = await controller.completeConnection("code=abc&state=s");

    expect(result).toBe("bad code");
    expect(controller.isConnected).toBe(false);
  });

  test("a handle change keeps the UUID and the storage path", async () => {
    const { account, controller } = context!.createLocalAccount();
    await controller.completeConnection("code=abc&state=s");
    const pathsBefore = controller.getPaths();

    profileMock.handle = "alice.example.com";
    profileMock.displayName = "Alice Elsewhere";
    await controller.refreshProfile();

    expect(controller.account?.handle).toBe("alice.example.com");
    expect(controller.account?.did).toBe(DID);
    expect(controller.accountUUID).toBe(account.uuid);
    expect(controller.getPaths()).toEqual(pathsBefore);
  });

  test("disconnecting keeps the local account and its saved data", async () => {
    const { account, controller } = context!.createLocalAccount();
    await controller.completeConnection("code=abc&state=s");
    controller.saveMedia(Buffer.from("a saved image"), "image/jpeg");
    const mediaDigest = controller.saveMedia(
      Buffer.from("a saved image"),
      "image/jpeg",
    ).digest;

    await controller.disconnect();

    expect(controller.isConnected).toBe(false);
    // The account and everything it saved are still here, and the DID stays so
    // an archive import can still recognize the identity.
    expect(controller.account?.did).toBe(DID);
    expect(controller.accountUUID).toBe(account.uuid);
    expect(controller.getMedia(mediaDigest)).not.toBeNull();
  });

  test("reconnecting the same identity works after a disconnect", async () => {
    const { controller } = context!.createLocalAccount();
    await controller.completeConnection("code=abc&state=s");
    await controller.disconnect();

    const result = await controller.completeConnection("code=abc&state=s");

    expect(result).toBe(true);
    expect(controller.isConnected).toBe(true);
    expect(controller.account?.did).toBe(DID);
  });

  test("connect reuses a stored session rather than opening a browser", async () => {
    await storeSession(DID);
    oauthMock.resolve.mockResolvedValueOnce({ did: DID } as never);
    const { controller } = context!.createLocalAccount();

    const started = await controller.connect("alice.bsky.social");

    expect(started).toEqual({ status: "reused", did: DID });
    expect(oauthMock.authorize).not.toHaveBeenCalled();
    expect(controller.isConnected).toBe(true);
  });

  test("a second local account cannot claim an identity another one holds", async () => {
    const first = context!.createLocalAccount();
    await first.controller.completeConnection("code=abc&state=s");
    const second = context!.createLocalAccount("bob");

    const result =
      await second.controller.completeConnection("code=abc&state=s");

    expect(result).toMatch(/already belongs to another/);
    expect(second.controller.isConnected).toBe(false);
  });

  test("the connection survives a restart", async () => {
    // The real client writes the session to the shared store as it finishes
    // the exchange; the mocked one does not, so the store is seeded here.
    await storeSession(DID);
    const { account, controller } = context!.createLocalAccount();
    await controller.completeConnection("code=abc&state=s");
    controller.cleanup();

    const reopened = context!.reopenLocalAccount(account.id);

    expect(reopened.isConnected).toBe(true);
    expect(reopened.account?.did).toBe(DID);
    expect(hasStoredBlueskyOAuthSession(DID)).toBe(true);
  });

  test("browsing saved data needs no connection and no network", async () => {
    const { account, controller } = context!.createLocalAccount();
    await controller.completeConnection("code=abc&state=s");
    const media = controller.saveMedia(
      Buffer.from("offline bytes"),
      "image/png",
    );
    await controller.disconnect();
    controller.cleanup();

    // A restart with nothing authorized: the account still opens and its saved
    // data still reads.
    const reopened = context!.reopenLocalAccount(account.id);

    expect(reopened.isConnected).toBe(false);
    expect(reopened.getMedia(media.digest)?.byteLength).toBe(media.byteLength);
  });
});
