import { test, expect, describe, vi, beforeEach } from "vitest";
import CydAPIClient from "../../cyd-api-client";
import * as UtilFacebook from "./util_facebook";

// Mock window.electron.Facebook
const mockFacebookGetConfig = vi.fn();
const mockFacebookGetProgressInfo = vi.fn();

// Set up window.electron mock
Object.defineProperty(window, "electron", {
  value: {
    Facebook: {
      getConfig: mockFacebookGetConfig,
      getProgressInfo: mockFacebookGetProgressInfo,
    },
  },
  writable: true,
});

describe("util_facebook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("facebookGetLastDelete", () => {
    test("returns null when no lastFinishedJob_deleteWallPosts config exists", async () => {
      mockFacebookGetConfig.mockResolvedValue(null);

      const result = await UtilFacebook.facebookGetLastDelete(1);

      expect(result).toBeNull();
      expect(mockFacebookGetConfig).toHaveBeenCalledWith(
        1,
        "lastFinishedJob_deleteWallPosts",
      );
    });

    test("returns Date when lastFinishedJob_deleteWallPosts config exists", async () => {
      const testDate = "2024-01-15T10:30:00.000Z";
      mockFacebookGetConfig.mockResolvedValue(testDate);

      const result = await UtilFacebook.facebookGetLastDelete(1);

      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(testDate);
      expect(mockFacebookGetConfig).toHaveBeenCalledWith(
        1,
        "lastFinishedJob_deleteWallPosts",
      );
    });
  });

  describe("facebookPostProgress", () => {
    test("calls postFacebookProgress with correct parameters when signed in", async () => {
      const mockPostFacebookProgress = vi.fn().mockResolvedValue(true);
      const mockApiClient = {
        postFacebookProgress: mockPostFacebookProgress,
      } as unknown as CydAPIClient;

      const mockProgressInfo = {
        accountUUID: "test-uuid-123",
        totalWallPostsDeleted: 42,
      };
      mockFacebookGetProgressInfo.mockResolvedValue(mockProgressInfo);

      const deviceInfo = {
        userEmail: "test@example.com",
        deviceDescription: "Test Device",
        deviceToken: "test-token",
        deviceUUID: "test-device-uuid",
        apiToken: "test-api-token",
        valid: true,
      };

      await UtilFacebook.facebookPostProgress(mockApiClient, deviceInfo, 1);

      expect(mockFacebookGetProgressInfo).toHaveBeenCalledWith(1);
      expect(mockPostFacebookProgress).toHaveBeenCalledWith(
        {
          account_uuid: "test-uuid-123",
          total_wall_posts_deleted: 42,
        },
        true,
      );
    });

    test("calls postFacebookProgress with false when device is not valid", async () => {
      const mockPostFacebookProgress = vi.fn().mockResolvedValue(true);
      const mockApiClient = {
        postFacebookProgress: mockPostFacebookProgress,
      } as unknown as CydAPIClient;

      const mockProgressInfo = {
        accountUUID: "test-uuid-456",
        totalWallPostsDeleted: 100,
      };
      mockFacebookGetProgressInfo.mockResolvedValue(mockProgressInfo);

      const deviceInfo = {
        userEmail: "test@example.com",
        deviceDescription: "Test Device",
        deviceToken: "test-token",
        deviceUUID: "test-device-uuid",
        apiToken: "test-api-token",
        valid: false,
      };

      await UtilFacebook.facebookPostProgress(mockApiClient, deviceInfo, 1);

      expect(mockPostFacebookProgress).toHaveBeenCalledWith(
        {
          account_uuid: "test-uuid-456",
          total_wall_posts_deleted: 100,
        },
        false,
      );
    });

    test("calls postFacebookProgress with false when deviceInfo is null", async () => {
      const mockPostFacebookProgress = vi.fn().mockResolvedValue(true);
      const mockApiClient = {
        postFacebookProgress: mockPostFacebookProgress,
      } as unknown as CydAPIClient;

      const mockProgressInfo = {
        accountUUID: "test-uuid-789",
        totalWallPostsDeleted: 0,
      };
      mockFacebookGetProgressInfo.mockResolvedValue(mockProgressInfo);

      await UtilFacebook.facebookPostProgress(mockApiClient, null, 1);

      expect(mockPostFacebookProgress).toHaveBeenCalledWith(
        {
          account_uuid: "test-uuid-789",
          total_wall_posts_deleted: 0,
        },
        false,
      );
    });

    test("logs error when API returns error response", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockPostFacebookProgress = vi.fn().mockResolvedValue({
        error: true,
        message: "Server error",
      });
      const mockApiClient = {
        postFacebookProgress: mockPostFacebookProgress,
      } as unknown as CydAPIClient;

      const mockProgressInfo = {
        accountUUID: "test-uuid",
        totalWallPostsDeleted: 10,
      };
      mockFacebookGetProgressInfo.mockResolvedValue(mockProgressInfo);

      await UtilFacebook.facebookPostProgress(mockApiClient, null, 1);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "facebookPostProgress",
        "failed to post progress to the API",
        "Server error",
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
