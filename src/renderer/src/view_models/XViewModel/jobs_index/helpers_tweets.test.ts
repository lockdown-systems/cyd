import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as IndexHelpers from "./index";
import type { XViewModel } from "../view_model";
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

    // Setup default mock implementations
    vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
    vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);
    vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0);
    vi.spyOn(vm, "scriptClickElementWithinElementLast").mockResolvedValue(true);
    vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "scrollUp").mockResolvedValue(undefined);
    vi.spyOn(vm, "scrollToBottom").mockResolvedValue(true);
    vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("indexTweetsHandleRateLimit", () => {
    it("should return true when more tweets load after scrolling", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(5) // Before scroll
        .mockResolvedValueOnce(10); // After scroll

      const result = await IndexHelpers.indexTweetsHandleRateLimit(vm);

      expect(result).toBe(true);
      expect(vm.scrollUp).toHaveBeenCalled();
      expect(vm.scrollToBottom).toHaveBeenCalled();
    });

    it("should return false when retry button does not exist", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(5); // Same count
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(0); // No button

      const result = await IndexHelpers.indexTweetsHandleRateLimit(vm);

      expect(result).toBe(false);
    });

    it("should click retry button when it exists", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsFound")
        .mockResolvedValueOnce(5) // Before
        .mockResolvedValueOnce(5) // After scroll (no change)
        .mockResolvedValueOnce(5) // Before click
        .mockResolvedValueOnce(10); // After click
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(1); // Button exists

      const result = await IndexHelpers.indexTweetsHandleRateLimit(vm);

      expect(vm.scriptClickElementWithinElementLast).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should handle case when no tweets have loaded", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);
      vi.spyOn(vm, "countSelectorsFound").mockResolvedValue(0);

      const result = await IndexHelpers.indexTweetsHandleRateLimit(vm);

      expect(vm.scriptClickElement).toHaveBeenCalled();
      expect(result).toBe(false); // No tweets loaded
    });
  });

  describe("indexTweetsCheckForSomethingWrong", () => {
    it("should click retry button when something went wrong message exists", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(true);
      vi.spyOn(vm, "countSelectorsWithinElementLastFound").mockResolvedValue(1);

      await IndexHelpers.indexTweetsCheckForSomethingWrong(vm);

      expect(vm.scriptClickElementWithinElementLast).toHaveBeenCalled();
      expect(vm.sleep).toHaveBeenCalledWith(2000);
    });

    it("should do nothing when everything is fine", async () => {
      vi.spyOn(vm, "doesSelectorExist").mockResolvedValue(false);

      await IndexHelpers.indexTweetsCheckForSomethingWrong(vm);

      expect(vm.scriptClickElementWithinElementLast).not.toHaveBeenCalled();
    });
  });

  describe("indexTweetsVerifyThereIsNoMore", () => {
    it("should return true when final API response is received again", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(false);

      const result = await IndexHelpers.indexTweetsVerifyThereIsNoMore(vm);

      expect(result).toBe(true);
      expect(mockElectron.X.resetThereIsMore).toHaveBeenCalled();
      expect(vm.scrollUp).toHaveBeenCalled();
      expect(vm.scrollToBottom).toHaveBeenCalled();
    });

    it("should return true when progress was not updated", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);
      vm.progress.tweetsIndexed = 10;
      vm.progress.retweetsIndexed = 5;
      vm.progress.likesIndexed = 3;
      vm.progress.unknownIndexed = 0;

      mockElectron.X.indexParseTweets.mockResolvedValue({
        tweetsIndexed: 10,
        retweetsIndexed: 5,
        likesIndexed: 3,
        unknownIndexed: 0,
      });

      const result = await IndexHelpers.indexTweetsVerifyThereIsNoMore(vm);

      expect(result).toBe(true);
    });

    it("should return false when there is more to load", async () => {
      mockElectron.X.indexIsThereMore.mockResolvedValue(true);
      vm.progress.tweetsIndexed = 10;

      mockElectron.X.indexParseTweets.mockResolvedValue({
        tweetsIndexed: 15, // Increased
        retweetsIndexed: 0,
        likesIndexed: 0,
        unknownIndexed: 0,
      });

      const result = await IndexHelpers.indexTweetsVerifyThereIsNoMore(vm);

      expect(result).toBe(false);
    });
  });
});
