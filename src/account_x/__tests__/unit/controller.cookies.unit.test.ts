import { electronMockHelpers } from "../../../__tests__/platform-fixtures/electronMocks";
import "../../../__tests__/platform-fixtures/network";

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

// getCookie used to read a map built by watching the Cookie header go past on
// outgoing requests. That had two problems: Chromium stopped exposing the
// header to webRequest in Electron 44, and even before that the map was empty
// until some request had already carried the cookie -- so a freshly added
// account failed its very first lookup. These tests seed the session's cookie
// jar and never simulate a request, so they fail if the traffic-watching
// behaviour comes back.
describe("XAccountController - cookies", () => {
  let controllerContext: XControllerTestContext | null = null;
  let partition: string;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
    partition = `persist:account-${controllerContext.account.id}`;
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
    vi.restoreAllMocks();
  });

  test("reads a cookie the session holds, with no request having carried it", async () => {
    electronMockHelpers.seedCookie(partition, "api.x.com", "ct0", "abc123");

    const ct0 = await controllerContext!.controller.getCookie(
      "api.x.com",
      "ct0",
    );

    expect(ct0).toBe("abc123");
  });

  test("returns null when the session has no such cookie", async () => {
    electronMockHelpers.seedCookie(partition, "api.x.com", "ct0", "abc123");

    expect(
      await controllerContext!.controller.getCookie("api.x.com", "auth_token"),
    ).toBeNull();
  });

  test("keeps hosts apart", async () => {
    electronMockHelpers.seedCookie(partition, "api.x.com", "ct0", "from-api");
    electronMockHelpers.seedCookie(partition, "x.com", "ct0", "from-www");

    expect(
      await controllerContext!.controller.getCookie("api.x.com", "ct0"),
    ).toBe("from-api");
    expect(await controllerContext!.controller.getCookie("x.com", "ct0")).toBe(
      "from-www",
    );
  });

  test("asks the session rather than any observed traffic", async () => {
    electronMockHelpers.seedCookie(partition, "api.x.com", "ct0", "abc123");

    await controllerContext!.controller.getCookie("api.x.com", "ct0");

    const ses = electronMockHelpers.getSessionMock(partition) as {
      cookies: { get: ReturnType<typeof vi.fn> };
    };
    expect(ses.cookies.get).toHaveBeenCalledWith({
      url: "https://api.x.com/",
      name: "ct0",
    });
  });
});

// When the cookie lookup fails, login finishes without ever resolving a
// username, and the account is left half-created. initDB already copes with an
// empty data path, so the only job here is to not throw out of path.join.
describe("XAccountController - account with no username", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
    vi.restoreAllMocks();
  });

  test("initDB gives up instead of crashing", () => {
    const controller = controllerContext!.controller;
    controller.account!.username = null as unknown as string;

    expect(() => controller.initDB()).not.toThrow();
  });
});
