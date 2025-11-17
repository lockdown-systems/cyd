import "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";

import type {
  BlueskyMigrationProfile,
  XRateLimitInfo,
  XMigrateTweetCounts,
} from "../../../shared_types";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

type ServiceMethods = {
  authorize: ReturnType<typeof vi.fn>;
  getProfile: ReturnType<typeof vi.fn>;
  callback: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  getTweetCounts: ReturnType<typeof vi.fn>;
  migrateTweet: ReturnType<typeof vi.fn>;
  deleteMigratedTweet: ReturnType<typeof vi.fn>;
};

type BlueskyServiceMockInstance = {
  ctorArgs: unknown[];
  methods: ServiceMethods;
  updateRateLimitInfo: (info: Partial<XRateLimitInfo>) => void;
};

type ServiceOverrideFactory = (deps: {
  updateRateLimitInfo: (info: Partial<XRateLimitInfo>) => void;
}) => Partial<ServiceMethods>;

const serviceMockControl = {
  instances: [] as BlueskyServiceMockInstance[],
  nextFactory: null as ServiceOverrideFactory | null,
  reset() {
    this.instances = [];
    this.nextFactory = null;
  },
  useNext(factory: ServiceOverrideFactory) {
    this.nextFactory = factory;
  },
};

const createDefaultProfile = (): BlueskyMigrationProfile => ({
  did: "did:test",
  handle: "tester",
  displayName: "Tester",
  avatar: "https://example.com/avatar.jpg",
});

const createMethods = (): ServiceMethods => ({
  authorize: vi.fn().mockResolvedValue(true),
  getProfile: vi.fn().mockImplementation(async () => createDefaultProfile()),
  callback: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
  getTweetCounts: vi.fn().mockImplementation(
    async (): Promise<XMigrateTweetCounts> => ({
      totalTweetsCount: 1,
      totalRetweetsCount: 0,
      toMigrateTweets: [],
      cannotMigrateCount: 0,
      alreadyMigratedTweets: [],
    }),
  ),
  migrateTweet: vi.fn().mockResolvedValue(true),
  deleteMigratedTweet: vi.fn().mockResolvedValue(true),
});

vi.mock("../../controller/bluesky/BlueskyService", () => {
  class MockBlueskyService {
    authorize!: ServiceMethods["authorize"];
    getProfile!: ServiceMethods["getProfile"];
    callback!: ServiceMethods["callback"];
    disconnect!: ServiceMethods["disconnect"];
    getTweetCounts!: ServiceMethods["getTweetCounts"];
    migrateTweet!: ServiceMethods["migrateTweet"];
    deleteMigratedTweet!: ServiceMethods["deleteMigratedTweet"];

    constructor(...args: unknown[]) {
      const updateRateLimitInfo = args[args.length - 1] as (
        info: Partial<XRateLimitInfo>,
      ) => void;
      const defaults = createMethods();
      const overrides =
        serviceMockControl.nextFactory?.({ updateRateLimitInfo }) ?? {};
      serviceMockControl.nextFactory = null;
      const methods = { ...defaults, ...overrides } as ServiceMethods;
      Object.assign(this, methods);
      serviceMockControl.instances.push({
        ctorArgs: args,
        methods,
        updateRateLimitInfo,
      });
    }
  }

  return { BlueskyService: MockBlueskyService };
});

describe("XAccountController - Bluesky integration", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    serviceMockControl.reset();
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
    serviceMockControl.reset();
  });

  test("controller reuses BlueskyService instance for all API calls", async () => {
    const controller = controllerContext!.controller;

    await controller.blueskyAuthorize("@cyd");
    const instance = serviceMockControl.instances[0];
    expect(serviceMockControl.instances).toHaveLength(1);
    expect(instance.methods.authorize).toHaveBeenCalledWith("@cyd");

    const profile = await controller.blueskyGetProfile();
    expect(instance.methods.getProfile).toHaveBeenCalledTimes(1);
    expect(profile?.did).toBe("did:test");

    await controller.blueskyGetTweetCounts();
    expect(instance.methods.getTweetCounts).toHaveBeenCalledTimes(1);

    await controller.blueskyMigrateTweet("tweet-1");
    expect(instance.methods.migrateTweet).toHaveBeenCalledWith("tweet-1");

    await controller.blueskyDeleteMigratedTweet("tweet-1");
    expect(instance.methods.deleteMigratedTweet).toHaveBeenCalledWith(
      "tweet-1",
    );

    await controller.blueskyDisconnect();
    expect(instance.methods.disconnect).toHaveBeenCalledTimes(1);
    expect(serviceMockControl.instances).toHaveLength(1);

    const ctorArgs = instance.ctorArgs;
    expect(ctorArgs[2]).toBe(controllerContext!.account.id);
    expect(typeof instance.updateRateLimitInfo).toBe("function");
  });

  test("rate limit info updates when service invokes injected callback", async () => {
    const controller = controllerContext!.controller;

    serviceMockControl.useNext(({ updateRateLimitInfo }) => ({
      migrateTweet: vi.fn().mockImplementation(async () => {
        updateRateLimitInfo({ isRateLimited: true, rateLimitReset: 4242 });
        return "migrated";
      }),
    }));

    const result = await controller.blueskyMigrateTweet("tweet-rate-limit");
    expect(result).toBe("migrated");

    const rateLimitInfo = await controller.isRateLimited();
    expect(rateLimitInfo.isRateLimited).toBe(true);
    expect(rateLimitInfo.rateLimitReset).toBe(4242);
  });
});
