import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as DeleteHelpers from "./index";
import type { XViewModel } from "../view_model";
import { XDeleteTweetsStartResponse } from "../../../../../shared_types";
import { AutomationErrorType } from "../../../automation_errors";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../../test_util";
import { createMockXViewModel } from "../test_util";

describe("helpers_tweets.ts", () => {
  let vm: XViewModel;

  beforeEach(() => {
    mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    vi.spyOn(vm, "log").mockReturnValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
    vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("deleteTweetsLoadList", () => {
    it("should successfully load list of tweets to delete", async () => {
      const mockResponse = {
        tweets: [{ id: "123" }, { id: "456" }],
      } as XDeleteTweetsStartResponse;
      const mockLoadFn = vi.fn().mockResolvedValue(mockResponse);

      const result = await DeleteHelpers.deleteTweetsLoadList(
        vm,
        mockLoadFn,
        AutomationErrorType.x_runJob_deleteTweets_FailedToStart,
      );

      expect(result).toEqual(mockResponse);
      expect(mockLoadFn).toHaveBeenCalledWith(1);
      expect(vm.log).toHaveBeenCalledWith(
        "deleteTweetsLoadList",
        "found 2 items to delete",
      );
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should return null and trigger error when loading fails", async () => {
      const mockLoadFn = vi.fn().mockRejectedValue(new Error("Load failed"));

      const result = await DeleteHelpers.deleteTweetsLoadList(
        vm,
        mockLoadFn,
        AutomationErrorType.x_runJob_deleteTweets_FailedToStart,
      );

      expect(result).toBeNull();
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_deleteTweets_FailedToStart,
        { error: expect.stringContaining("Load failed") },
      );
    });
  });

  describe("deleteTweetItem", () => {
    it("should call graphqlDelete with correct parameters for tweet", async () => {
      await DeleteHelpers.deleteTweetItem(
        vm,
        "test-ct0",
        "tweet-123",
        "testuser",
      );

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet",
        "https://x.com/testuser/with_replies",
        JSON.stringify({
          variables: {
            tweet_id: "tweet-123",
            dark_request: false,
          },
          queryId: "VaenaVgh5q5ih7kvyVjgtg",
        }),
      );
    });

    it("should return status code from graphqlDelete", async () => {
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);

      const result = await DeleteHelpers.deleteTweetItem(
        vm,
        "test-ct0",
        "tweet-123",
        "testuser",
      );

      expect(result).toBe(200);
    });
  });

  describe("deleteRetweetItem", () => {
    it("should call graphqlDelete with correct parameters for retweet", async () => {
      await DeleteHelpers.deleteRetweetItem(
        vm,
        "test-ct0",
        "retweet-456",
        "testuser",
      );

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/VaenaVgh5q5ih7kvyVjgtg/DeleteTweet",
        "https://x.com/testuser/with_replies",
        JSON.stringify({
          variables: {
            tweet_id: "retweet-456",
            dark_request: false,
          },
          queryId: "VaenaVgh5q5ih7kvyVjgtg",
        }),
      );
    });

    it("should use same endpoint as deleteTweetItem", async () => {
      await DeleteHelpers.deleteTweetItem(vm, "ct0", "123", "user");
      const tweetCall = vi.mocked(vm.graphqlDelete).mock.calls[0];

      vi.clearAllMocks();

      await DeleteHelpers.deleteRetweetItem(vm, "ct0", "456", "user");
      const retweetCall = vi.mocked(vm.graphqlDelete).mock.calls[0];

      // Same endpoint URL
      expect(tweetCall[1]).toBe(retweetCall[1]);
    });
  });
});
