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
  let mockElectron: ReturnType<typeof mockElectronAPI>;

  beforeEach(() => {
    mockElectron = mockElectronAPI();
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
    it("should call graphqlDelete with the operation X's own client sends", async () => {
      await DeleteHelpers.deleteLikeItem(vm, "test-ct0", "tweet-123");

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/ZYKSe-w7KEslx3JhSIk5LA/UnfavoriteTweet",
        "https://x.com/i/history/likes",
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
      );

      expect(result).toBe(200);
    });
  });

  describe("deleteBookmarkItem", () => {
    it("should call graphqlDelete with the operation X's own client sends", async () => {
      await DeleteHelpers.deleteBookmarkItem(vm, "test-ct0", "tweet-456");

      expect(vm.graphqlDelete).toHaveBeenCalledWith(
        "test-ct0",
        "https://x.com/i/api/graphql/Wlmlj2-xzyS1GN3a6cj-mQ/DeleteBookmark",
        "https://x.com/i/history",
        JSON.stringify({
          variables: {
            tweet_id: "tweet-456",
          },
          queryId: "Wlmlj2-xzyS1GN3a6cj-mQ",
        }),
      );
    });

    it("should use an operation identifier observed this session", async () => {
      mockElectron.X.getObservedGraphqlQueryIDs.mockResolvedValue({
        DeleteBookmark: "rotated-identifier",
      });

      await DeleteHelpers.deleteBookmarkItem(vm, "test-ct0", "tweet-456");

      const call = vi.mocked(vm.graphqlDelete).mock.calls[0];
      expect(call[1]).toBe(
        "https://x.com/i/api/graphql/rotated-identifier/DeleteBookmark",
      );
    });
  });
});
