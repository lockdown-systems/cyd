import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, describe, expect, test } from "vitest";

import { electronMockHelpers } from "../../../__tests__/platform-fixtures/electronMocks";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

describe("XAccountController - Rate limit integration", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
  });

  function triggerRateLimit(details: Partial<Record<string, unknown>>) {
    const accountID = controllerContext!.account.id;
    const partition = `persist:account-${accountID}`;
    electronMockHelpers.triggerOnCompleted(partition, {
      statusCode: 200,
      method: "GET",
      url: "https://x.com/i/api/graphql",
      ...details,
    });
  }

  test("rate limit info derives reset timestamp from response headers", async () => {
    const controller = controllerContext!.controller;

    triggerRateLimit({
      statusCode: 429,
      responseHeaders: {
        "x-rate-limit-reset": "12345",
      },
    });

    const info = await controller.isRateLimited();
    expect(info.isRateLimited).toBe(true);
    expect(info.rateLimitReset).toBe(12345);

    await controller.resetRateLimitInfo();
    const reset = await controller.isRateLimited();
    expect(reset.isRateLimited).toBe(false);
    expect(reset.rateLimitReset).toBe(0);
  });

  test("rate limit handler falls back to fifteen minutes when header missing", async () => {
    const controller = controllerContext!.controller;
    const now = Math.floor(Date.now() / 1000);

    triggerRateLimit({ statusCode: 429, responseHeaders: undefined });

    const info = await controller.isRateLimited();
    expect(info.isRateLimited).toBe(true);
    expect(info.rateLimitReset).toBeGreaterThanOrEqual(now + 880);
    expect(info.rateLimitReset).toBeLessThanOrEqual(now + 930);
  });
});
