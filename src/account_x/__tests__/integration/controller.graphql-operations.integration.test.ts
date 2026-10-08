import "../../../__tests__/platform-fixtures/network";

import { beforeEach, afterEach, describe, expect, test } from "vitest";

import { electronMockHelpers } from "../../../__tests__/platform-fixtures/electronMocks";
import {
  createXControllerTestContext,
  type XControllerTestContext,
} from "../fixtures/accountTestHarness";

describe("XAccountController - Observed GraphQL operations", () => {
  let controllerContext: XControllerTestContext | null = null;

  beforeEach(() => {
    controllerContext = createXControllerTestContext();
  });

  afterEach(async () => {
    await controllerContext?.cleanup();
    controllerContext = null;
  });

  function request(url: string) {
    const partition = `persist:account-${controllerContext!.account.id}`;
    electronMockHelpers.triggerOnCompleted(partition, {
      statusCode: 200,
      method: "POST",
      url,
    });
  }

  test("records the identifier X's own client used, keyed by operation name", async () => {
    const controller = controllerContext!.controller;

    request("https://x.com/i/api/graphql/rotated-identifier/DeleteTweet");

    expect(await controller.getObservedGraphqlQueryIDs()).toEqual({
      DeleteTweet: "rotated-identifier",
    });
  });

  test("keeps the most recent identifier for an operation", async () => {
    const controller = controllerContext!.controller;

    request("https://x.com/i/api/graphql/first-identifier/DeleteTweet");
    request("https://x.com/i/api/graphql/second-identifier/DeleteTweet");

    expect(await controller.getObservedGraphqlQueryIDs()).toEqual({
      DeleteTweet: "second-identifier",
    });
  });

  test("reads operations from a GraphQL request with a query string", async () => {
    const controller = controllerContext!.controller;

    request(
      "https://x.com/i/api/graphql/likes-identifier/Likes?variables=%7B%7D",
    );

    expect(await controller.getObservedGraphqlQueryIDs()).toEqual({
      Likes: "likes-identifier",
    });
  });

  test("ignores requests that are not GraphQL operations", async () => {
    const controller = controllerContext!.controller;

    request("https://x.com/i/api/1.1/friendships/destroy.json");
    request("https://x.com/home");

    expect(await controller.getObservedGraphqlQueryIDs()).toEqual({});
  });
});
