import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as DeleteHelpers from "./index";
import type { XViewModel } from "../view_model";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../../test_util";
import { createMockXViewModel } from "../test_util";

describe("helpers_likes.ts", () => {
  let vm: XViewModel;

  beforeEach(() => {
    mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({ username: "testuser" }),
    });

    vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("deleteLikeItem", () => {
    it("should call graphqlDelete with correct parameters for like", async () => {
      await DeleteHelpers.deleteLikeItem(
        vm,
        "test-ct0",
        "tweet-123",
        "testuser",
      );

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet",
        "https://x.com/testuser/likes",
        JSON.stringify({
          variables: {
            tweet_id: "tweet-123",
          },
          queryId: "ZYKSe-w7KEslx3JhSIk5LA",
        }),
      );
    });

    it("should return status code from graphqlDelete", async () => {
      vi.spyOn(vm, "graphqlDelete").mockResolvedValue(200);

      const result = await DeleteHelpers.deleteLikeItem(
        vm,
        "test-ct0",
        "tweet-123",
        "testuser",
      );

      expect(result).toBe(200);
    });
  });

  describe("deleteBookmarkItem", () => {
    it("should call graphqlDelete with correct parameters for bookmark", async () => {
      await DeleteHelpers.deleteBookmarkItem(vm, "test-ct0", "tweet-456");

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark",
        "https://x.com/i/bookmarks",
        JSON.stringify({
          variables: {
            tweet_id: "tweet-456",
          },
          queryId: "Wlmlj2-xzyS1GN3a6cj-mQ",
        }),
      );
    });

    it("should not require username parameter", async () => {
      // Bookmarks don't need username in the referer URL
      await DeleteHelpers.deleteBookmarkItem(vm, "ct0", "123");

      const call = vi.mocked(vm.graphqlDelete).mock.calls[0];
      expect(call[2]).toBe("https://x.com/i/bookmarks");
    });
  });
});
