import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import { shellMock } from "../../../__tests__/platform-fixtures/electronMocks";
import * as database from "../../../database";
import { BlueskyService } from "../../controller/bluesky/BlueskyService";
import type { XRateLimitInfo } from "../../../shared_types";
import type { XAccountController } from "../../x_account_controller";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";
import { seedTweet } from "../fixtures/tweetFactory";

type AgentOverride = Partial<Record<string, ReturnType<typeof vi.fn>>>;

const agentMockController = {
  nextOverrides: null as AgentOverride | null,
  instances: [] as unknown[],
  setNextOverrides(overrides: AgentOverride) {
    this.nextOverrides = overrides;
  },
  reset() {
    this.nextOverrides = null;
    this.instances.length = 0;
  },
};

vi.mock("@atproto/api", () => {
  class MockAgent {
    public did?: string;
    public getProfile: ReturnType<typeof vi.fn>;
    public post: ReturnType<typeof vi.fn>;
    public uploadBlob: ReturnType<typeof vi.fn>;
    public deletePost: ReturnType<typeof vi.fn>;

    constructor(session: Record<string, unknown> = {}) {
      this.did = session.did as string | undefined;
      const overrides = agentMockController.nextOverrides;
      agentMockController.nextOverrides = null;

      this.getProfile =
        overrides?.getProfile ??
        vi.fn(async () => ({
          data: {
            did: this.did ?? "did:test",
            handle: "handle.test",
            displayName: "Test User",
            avatar: "https://example.com/avatar.jpg",
          },
        }));

      this.post =
        overrides?.post ??
        vi.fn(async () => ({ uri: "at://post", cid: "cid" }));

      this.uploadBlob =
        overrides?.uploadBlob ??
        vi.fn(async () => ({ data: { blob: { cid: "blob" } } }));

      this.deletePost = overrides?.deletePost ?? vi.fn(async () => undefined);

      agentMockController.instances.push(this);
    }
  }

  class MockRichText {
    text: string;
    facets?: unknown[];

    constructor(opts: { text: string; facets?: unknown[] }) {
      this.text = opts.text;
      this.facets = opts.facets;
    }

    async detectFacets() {
      return;
    }

    get graphemeLength() {
      return this.text.length;
    }
  }

  class MockBlobRef {}

  return {
    Agent: MockAgent,
    RichText: MockRichText,
    BlobRef: MockBlobRef,
  };
});

function createService(
  controller: XAccountController,
  accountID: number,
  updateRateLimitInfo?: (info: Partial<XRateLimitInfo>) => void,
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
    updateRateLimitInfo ?? (() => undefined),
  );
}

describe("BlueskyService", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(() => {
    shellMock.openExternal.mockReset();
    agentMockController.reset();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
  });

  test("getTweetCounts filters replies and migrations", async () => {
    const controller = controllerContext!.controller;
    controller.account!.userID = "account-user";

    seedTweet(controller, { tweetID: "eligible" });
    seedTweet(controller, {
      tweetID: "self-reply",
      isReply: 1,
      replyUserID: "account-user",
    });
    seedTweet(controller, {
      tweetID: "other-reply",
      isReply: 1,
      replyUserID: "someone-else",
    });
    seedTweet(controller, { tweetID: "retweet", text: "RT @someone" });
    seedTweet(controller, { tweetID: "liked", isLiked: 1 });
    seedTweet(controller, {
      tweetID: "deleted",
      deletedTweetAt: new Date().toISOString(),
    });
    const alreadyMigrated = seedTweet(controller, { tweetID: "migrated" });

    database.exec(
      controller.db!,
      "INSERT INTO tweet_bsky_migration (tweetID, atprotoURI, atprotoCID, migratedAt) VALUES (?, ?, ?, ?)",
      [alreadyMigrated, "at://did", "cid", new Date().toISOString()],
    );

    const service = createService(controller, controllerContext!.account.id);

    const counts = await service.getTweetCounts();

    expect(counts.totalTweetsCount).toBe(5);
    expect(counts.totalRetweetsCount).toBe(1);
    expect(counts.toMigrateTweets.map((tweet) => tweet.id).sort()).toEqual([
      "deleted",
      "eligible",
      "self-reply",
    ]);
    expect(counts.cannotMigrateCount).toBe(1);
    expect(counts.alreadyMigratedTweets.map((tweet) => tweet.id)).toEqual([
      "migrated",
    ]);
  });

  test("authorize trims @ and opens browser", async () => {
    const controller = controllerContext!.controller;
    const service = createService(controller, controllerContext!.account.id);
    const authorizeURL = new URL("https://cyd.social/auth");
    const mockClient = {
      authorize: vi.fn().mockResolvedValue(authorizeURL),
    } as const;
    const initSpy = vi
      .spyOn(service, "initClient")
      .mockResolvedValue(mockClient as never);
    const setConfigSpy = vi.spyOn(database, "setConfig");

    const result = await service.authorize("@example");

    expect(result).toBe(true);
    expect(mockClient.authorize).toHaveBeenCalledWith("example");
    expect(shellMock.openExternal).toHaveBeenCalledWith(
      authorizeURL.toString(),
    );
    const call = setConfigSpy.mock.calls.find(
      ([key]) => key === "blueskyOAuthAccountID",
    );
    expect(call?.[1]).toBe(`${controllerContext!.account.id}`);
    initSpy.mockRestore();
    setConfigSpy.mockRestore();
  });

  test("authorize returns error string when client throws", async () => {
    const controller = controllerContext!.controller;
    const service = createService(controller, controllerContext!.account.id);
    const mockClient = {
      authorize: vi.fn().mockRejectedValue(new Error("Nope")),
    };
    vi.spyOn(service, "initClient").mockResolvedValue(mockClient as never);

    const result = await service.authorize("example");

    expect(result).toBe("Nope");
    expect(shellMock.openExternal).not.toHaveBeenCalled();
  });

  test("callback returns error description when provided", async () => {
    const controller = controllerContext!.controller;
    const service = createService(controller, controllerContext!.account.id);
    const mockClient = {};
    vi.spyOn(service, "initClient").mockResolvedValue(mockClient as never);

    const result = await service.callback("error_description=denied");

    expect(result).toBe("denied");
  });

  test("callback stores bluesky DID and resolves true", async () => {
    const controller = controllerContext!.controller;
    const service = createService(controller, controllerContext!.account.id);
    const mockClient = {
      callback: vi.fn().mockResolvedValue({
        session: { did: "did:web:cyd" },
        state: "state",
      }),
    };
    vi.spyOn(service, "initClient").mockResolvedValue(mockClient as never);

    const result = await service.callback("code=1234");

    expect(result).toBe(true);
    expect(await controller.getConfig("blueskyDID")).toBe("did:web:cyd");
  });

  test("disconnect revokes session and clears config", async () => {
    const controller = controllerContext!.controller;
    const service = createService(controller, controllerContext!.account.id);
    await controller.setConfig("blueskyDID", "did:web:cyd");
    const session = { signOut: vi.fn() };
    const mockClient = {
      restore: vi.fn().mockResolvedValue(session),
    };
    vi.spyOn(service, "initClient").mockResolvedValue(mockClient as never);
    const deleteConfigSpy = vi.spyOn(database, "deleteConfig");
    const deleteConfigLikeSpy = vi.spyOn(controller, "deleteConfigLike");
    const deleteConfigSpyController = vi.spyOn(controller, "deleteConfig");

    await service.disconnect();

    expect(mockClient.restore).toHaveBeenCalledWith("did:web:cyd");
    expect(session.signOut).toHaveBeenCalled();
    expect(
      deleteConfigSpy.mock.calls.some(
        ([key]) => key === "blueskyOAuthAccountID",
      ),
    ).toBe(true);
    expect(deleteConfigSpyController).toHaveBeenCalledWith("blueskyDID");
    expect(deleteConfigLikeSpy).toHaveBeenCalledWith("blueskyStateStore-%");
    expect(deleteConfigLikeSpy).toHaveBeenCalledWith("blueskySessionStore-%");
  });

  test("migrateTweet surfaces Bluesky rate limit errors", async () => {
    const controller = controllerContext!.controller;
    const rateLimitSpy = vi.fn();
    const service = createService(
      controller,
      controllerContext!.account.id,
      rateLimitSpy,
    );
    await controller.setConfig("blueskyDID", "did:web:cyd");
    const rateLimitError = {
      error: "RateLimitExceeded",
      headers: { "ratelimit-reset": "1700000000" },
      success: false,
      status: 429,
    };
    const postMock = vi.fn(async () => {
      throw rateLimitError;
    });
    agentMockController.setNextOverrides({ post: postMock });
    const session = { did: "did:web:cyd" };
    const mockClient = {
      restore: vi.fn().mockResolvedValue(session),
    };
    vi.spyOn(service, "initClient").mockResolvedValue(mockClient as never);
    vi.spyOn(service, "migrateTweetBuildRecord").mockResolvedValue([
      {
        $type: "app.bsky.feed.post",
        text: "Hello",
        facets: [],
        createdAt: new Date().toISOString(),
      },
      "",
    ]);

    const result = await service.migrateTweet("tweet-rate-limit");

    expect(result).toBe("RateLimitExceeded");
    expect(postMock).toHaveBeenCalled();
    expect(rateLimitSpy).toHaveBeenCalledWith({
      isRateLimited: true,
      rateLimitReset: 1700000000,
    });
  });
});
