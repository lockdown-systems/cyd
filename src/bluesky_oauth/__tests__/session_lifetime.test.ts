import "../../__tests__/platform-fixtures/electronMocks";
import "../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

const oauthMock = vi.hoisted(() => ({
  revoke: vi.fn(async () => undefined),
  restore: vi.fn(async (did: string) => ({ did })),
  authorize: vi.fn(async () => new URL("https://bsky.example/authorize")),
  callback: vi.fn(async () => ({
    session: { did: "did:plc:one" },
    state: "Bluesky:1",
  })),
  reset() {
    this.revoke.mockClear();
    this.restore.mockClear();
    this.authorize.mockClear();
    this.callback.mockClear();
  },
}));

vi.mock("@atproto/oauth-client-node", () => {
  class MockNodeOAuthClient {
    static fetchMetadata = vi.fn(async () => ({ client_id: "https://test" }));
    revoke = oauthMock.revoke;
    restore = oauthMock.restore;
    authorize = oauthMock.authorize;
    callback = oauthMock.callback;
  }
  return { NodeOAuthClient: MockNodeOAuthClient };
});

import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../../account_x/__tests__/fixtures/accountTestHarness";
import {
  createBlueskyControllerTestContext,
  type BlueskyControllerTestContext,
} from "../../account_bluesky/__tests__/fixtures/accountTestHarness";
import { setBlueskyLocalAccountConnected } from "../../database";
import { resetBlueskyOAuthClient } from "../client";
import { blueskyHolders } from "../holders";
import { releaseBlueskyHold, sweepOrphanedBlueskyOAuth } from "../session";
import {
  blueskyOAuthCredentials,
  blueskyOAuthSessionStore,
  blueskyOAuthStateStore,
  hasStoredBlueskyOAuthSession,
} from "../store";

const DID = "did:plc:shared-identity";

const SESSION = {
  dpopJwk: { kty: "EC", d: "private-dpop-key-material" },
  tokenSet: { refresh_token: "refresh-token-value" },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const storeSession = async (did: string) =>
  (blueskyOAuthSessionStore() as any).set(did, SESSION);
const storeState = async (key: string, appState: string) =>
  (blueskyOAuthStateStore() as any).set(key, {
    dpopJwk: { kty: "EC", d: "key" },
    verifier: "verifier",
    appState,
  });
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("Bluesky session lifetime", () => {
  let x: XControllerTestContext | null = null;
  let bluesky: BlueskyControllerTestContext | null = null;

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

  /** An X account with its Bluesky migration connected to `did`. */
  const connectX = async (did: string) => {
    await x!.controller.setConfig("blueskyDID", did);
  };

  /** A connected Bluesky local account bound to `did`. */
  const connectBluesky = (did: string) => {
    const local = bluesky!.createLocalAccount();
    local.controller.setDID(did);
    setBlueskyLocalAccountConnected(local.account.uuid, true);
    local.controller.refreshAccount();
    return local;
  };

  describe("holders", () => {
    test("counts an X migration and a Bluesky account as two holders", async () => {
      await storeSession(DID);
      await connectX(DID);
      const local = connectBluesky(DID);

      expect(blueskyHolders(DID)).toEqual(
        expect.arrayContaining([
          { platform: "X", accountID: x!.account.id },
          { platform: "Bluesky", accountID: local.account.id },
        ]),
      );
      expect(blueskyHolders(DID)).toHaveLength(2);
    });

    test("counts nobody for an identity no account is connected to", async () => {
      await storeSession(DID);

      expect(blueskyHolders(DID)).toEqual([]);
    });

    test("does not count a Bluesky account that is bound but disconnected", () => {
      const local = connectBluesky(DID);
      setBlueskyLocalAccountConnected(local.account.uuid, false);

      // The DID survives disconnection, because that is how an archive import
      // recognizes the identity again. The hold does not.
      expect(blueskyHolders(DID)).toEqual([]);
    });
  });

  describe("releasing one hold of two", () => {
    test("disconnecting X leaves the Bluesky account connected", async () => {
      await storeSession(DID);
      await connectX(DID);
      const local = connectBluesky(DID);

      await x!.controller.blueskyDisconnect();

      expect(oauthMock.revoke).not.toHaveBeenCalled();
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(true);
      expect(blueskyHolders(DID)).toEqual([
        { platform: "Bluesky", accountID: local.account.id },
      ]);
      // X's own connection state reflects the release immediately.
      expect(await x!.controller.getConfig("blueskyDID")).toBeNull();
    });

    test("disconnecting the Bluesky account leaves X connected", async () => {
      await storeSession(DID);
      await connectX(DID);
      const local = connectBluesky(DID);

      await local.controller.disconnect();

      expect(oauthMock.revoke).not.toHaveBeenCalled();
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(true);
      expect(blueskyHolders(DID)).toEqual([
        { platform: "X", accountID: x!.account.id },
      ]);
      expect(local.controller.isConnected).toBe(false);
    });

    test("deleting the Bluesky account leaves X connected", async () => {
      await storeSession(DID);
      await connectX(DID);
      const local = connectBluesky(DID);

      local.controller.deleteLocalAccount({
        confirmedAccountUUID: local.account.uuid,
      });
      await releaseBlueskyHold(DID);

      expect(oauthMock.revoke).not.toHaveBeenCalled();
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(true);
      expect(blueskyHolders(DID)).toEqual([
        { platform: "X", accountID: x!.account.id },
      ]);
    });
  });

  describe("releasing the last hold", () => {
    test("revokes once when X releases last", async () => {
      await storeSession(DID);
      await connectX(DID);
      const local = connectBluesky(DID);

      await local.controller.disconnect();
      expect(oauthMock.revoke).not.toHaveBeenCalled();

      await x!.controller.blueskyDisconnect();

      expect(oauthMock.revoke).toHaveBeenCalledTimes(1);
      expect(oauthMock.revoke).toHaveBeenCalledWith(DID);
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(false);
      expect(blueskyOAuthCredentials().keys()).toEqual([]);
    });

    test("revokes once when the Bluesky account releases last", async () => {
      await storeSession(DID);
      await connectX(DID);
      const local = connectBluesky(DID);

      await x!.controller.blueskyDisconnect();
      expect(oauthMock.revoke).not.toHaveBeenCalled();

      await local.controller.disconnect();

      expect(oauthMock.revoke).toHaveBeenCalledTimes(1);
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(false);
    });

    test("destroys local material even when the PDS cannot be reached", async () => {
      await storeSession(DID);
      await connectX(DID);
      oauthMock.revoke.mockRejectedValueOnce(new Error("network down"));

      await x!.controller.blueskyDisconnect();

      expect(oauthMock.revoke).toHaveBeenCalledTimes(1);
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(false);
    });

    test("releasing an identity that is still held revokes nothing", async () => {
      await storeSession(DID);
      await connectX(DID);

      // A stray release for an identity another account still holds cannot
      // sign it out: a holder is never asked to give up someone else's hold.
      await releaseBlueskyHold(DID);

      expect(oauthMock.revoke).not.toHaveBeenCalled();
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(true);
    });
  });

  describe("sweeping after an interrupted release", () => {
    test("revokes a session no account holds", async () => {
      // A quit between clearing the last account's connection and revoking.
      await storeSession(DID);

      const swept = await sweepOrphanedBlueskyOAuth();

      expect(swept).toBe(1);
      expect(oauthMock.revoke).toHaveBeenCalledTimes(1);
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(false);
    });

    test("leaves a held session signed in", async () => {
      await storeSession(DID);
      await connectX(DID);

      const swept = await sweepOrphanedBlueskyOAuth();

      expect(swept).toBe(0);
      expect(oauthMock.revoke).not.toHaveBeenCalled();
      expect(hasStoredBlueskyOAuthSession(DID)).toBe(true);
      // The hold survived the restart rather than leaking or dropping.
      expect(blueskyHolders(DID)).toEqual([
        { platform: "X", accountID: x!.account.id },
      ]);
    });

    test("discards an authorization whose account no longer exists", async () => {
      await storeSession(DID);
      await connectX(DID);
      await storeState("state-orphan", "Bluesky:99999");
      await storeState("state-live", `X:${x!.account.id}`);

      await sweepOrphanedBlueskyOAuth();

      const keys = blueskyOAuthCredentials().keys();
      expect(keys).not.toContain("blueskyStateStore-state-orphan");
      // An authorization for an account that still exists is left alone: the
      // person may be finishing it in their browser right now.
      expect(keys).toContain("blueskyStateStore-state-live");
    });
  });
});
