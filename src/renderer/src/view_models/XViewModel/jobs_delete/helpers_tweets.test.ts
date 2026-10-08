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
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
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
    it("should call graphqlDelete with the operation X's own client sends", async () => {
      await DeleteHelpers.deleteTweetItem(vm, "test-ct0", "tweet-123");

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/nxpZCY2K-I6QoFHAHeojFQ/DeleteTweet",
        "https://x.com/testuser",
        JSON.stringify({
          variables: {
            tweet_id: "tweet-123",
            dark_request: false,
          },
          queryId: "nxpZCY2K-I6QoFHAHeojFQ",
        }),
      );
    });

    it("should use an operation identifier observed this session", async () => {
      mockElectron.X.getObservedGraphqlQueryIDs.mockResolvedValue({
        DeleteTweet: "rotated-identifier",
      });

      await DeleteHelpers.deleteTweetItem(vm, "test-ct0", "tweet-123");

      const call = vi.mocked(vm.graphqlDelete).mock.calls[0];
      expect(call[1]).toBe(
        "https://x.com/i/api/graphql/rotated-identifier/DeleteTweet",
      );
      expect(call[3]).toContain('"queryId":"rotated-identifier"');
    });

    it("should return status code from graphqlDelete", async () => {
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);

      const result = await DeleteHelpers.deleteTweetItem(
        vm,
        "test-ct0",
        "tweet-123",
      );

      expect(result).toBe(200);
    });
  });

  describe("deleteRetweetItem", () => {
    it("should undo the repost by naming the post that was reposted", async () => {
      await DeleteHelpers.deleteRetweetItem(
        vm,
        "test-ct0",
        "retweet-456",
        "reposted-123",
      );

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/ZyZigVsNiFO6v1dEks1eWg/DeleteRetweet",
        "https://x.com/testuser/reposts",
        JSON.stringify({
          variables: {
            source_tweet_id: "reposted-123",
          },
          queryId: "ZyZigVsNiFO6v1dEks1eWg",
        }),
      );
    });

    it("should delete the repost itself when the reposted post is unknown", async () => {
      await DeleteHelpers.deleteRetweetItem(
        vm,
        "test-ct0",
        "retweet-456",
        null,
      );

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/nxpZCY2K-I6QoFHAHeojFQ/DeleteTweet",
        "https://x.com/testuser",
        JSON.stringify({
          variables: {
            tweet_id: "retweet-456",
            dark_request: false,
          },
          queryId: "nxpZCY2K-I6QoFHAHeojFQ",
        }),
      );
    });
  });
});
