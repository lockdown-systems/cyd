import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as GraphQL from "./graphql";
import type { XViewModel } from "./view_model";
import { X_AUTHORIZATION_HEADER } from "./types";
import type { XUserInfo } from "../../types_x";
import type { Account } from "../../../../shared_types";

interface MockWebview {
  executeJavaScript: ReturnType<typeof vi.fn>;
}

interface MockElectronX {
  getCookie: ReturnType<typeof vi.fn>;
  getImageDataURI: ReturnType<typeof vi.fn>;
}

describe("graphql.ts", () => {
  let mockVM: Partial<XViewModel>;
  let mockWebview: MockWebview;
  let mockElectronX: MockElectronX;

  beforeEach(() => {
    // Create mock webview
    mockWebview = {
      executeJavaScript: vi.fn(),
    };

    // Create mock Electron API
    mockElectronX = {
      getCookie: vi.fn(),
      getImageDataURI: vi.fn(),
    };

    // Setup window.electron mock
    (global as unknown as { window: { electron: unknown } }).window = {
      electron: {
        X: mockElectronX,
      },
    };

    // Create mock view model
    mockVM = {
      account: {
        id: 1,
      } as Partial<Account> as Account,
      log: vi.fn(),
      sleep: vi.fn().mockResolvedValue(undefined),
      getWebview: vi.fn().mockReturnValue(mockWebview),
      loadURLWithRateLimit: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("graphqlDelete", () => {
    it("should execute delete request and return status 200", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(200);

      const result = await GraphQL.graphqlDelete(
        mockVM as XViewModel,
        "test-ct0-token",
        "https://api.x.com/graphql/test",
        "https://x.com/home",
        '{"test":"body"}',
      );

      expect(result).toBe(200);
      expect(mockVM.log).toHaveBeenCalledWith("graphqlDelete", [
        "https://api.x.com/graphql/test",
        '{"test":"body"}',
      ]);
    });

    it("should include correct headers in request", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(200);

      await GraphQL.graphqlDelete(
        mockVM as XViewModel,
        "my-csrf-token",
        "https://api.x.com/graphql/deleteTweet",
        "https://x.com/",
        "{}",
      );

      const jsCode = mockWebview.executeJavaScript.mock.calls[0][0];
      expect(jsCode).toContain(`"authorization": "${X_AUTHORIZATION_HEADER}"`);
      expect(jsCode).toContain('"content-type": "application/json"');
      expect(jsCode).toContain("\"x-csrf-token\": 'my-csrf-token'");
      expect(jsCode).toContain('"x-twitter-active-user": "yes"');
      expect(jsCode).toContain('"x-twitter-auth-type": "OAuth2Session"');
    });

    it("should use POST method", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(200);

      await GraphQL.graphqlDelete(
        mockVM as XViewModel,
        "token",
        "https://api.x.com/graphql/test",
        "https://x.com/",
        "{}",
      );

      const jsCode = mockWebview.executeJavaScript.mock.calls[0][0];
      expect(jsCode).toContain('"method": "POST"');
    });

    it("should return 0 on fetch error", async () => {
      // The JavaScript code catches errors and returns 0
      mockWebview.executeJavaScript.mockResolvedValue(0);

      const result = await GraphQL.graphqlDelete(
        mockVM as XViewModel,
        "token",
        "https://api.x.com/graphql/test",
        "https://x.com/",
        "{}",
      );

      expect(result).toBe(0);
    });

    it("should include body in request", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(200);

      const testBody = '{"operation":"delete","id":"123"}';
      await GraphQL.graphqlDelete(
        mockVM as XViewModel,
        "token",
        "https://api.x.com/graphql/test",
        "https://x.com/",
        testBody,
      );

      const jsCode = mockWebview.executeJavaScript.mock.calls[0][0];
      expect(jsCode).toContain(`"body": '${testBody}'`);
    });
  });

  describe("graphqlGetViewerUser", () => {
    const mockViewerResponse = {
      data: {
        viewer: {
          user_results: {
            result: {
              rest_id: "123456789",
              legacy: {
                screen_name: "testuser",
                description: "Test bio",
                profile_image_url_https:
                  "https://pbs.twimg.com/profile_images/test.jpg",
                friends_count: 100,
                followers_count: 200,
                statuses_count: 500,
                favourites_count: 300,
              },
            },
          },
        },
      },
    };

    beforeEach(() => {
      mockElectronX.getCookie.mockResolvedValue("test-ct0-token");
      mockElectronX.getImageDataURI.mockResolvedValue(
        "data:image/png;base64,test",
      );
    });

    it("should return null if ct0 cookie is null", async () => {
      mockElectronX.getCookie.mockResolvedValue(null);

      const result = await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(result).toBeNull();
      expect(mockVM.log).toHaveBeenCalledWith(
        "graphqlGetViewerUser",
        "ct0 is null",
      );
    });

    it("should get ct0 cookie from electron API", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(
        JSON.stringify(mockViewerResponse),
      );

      await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(mockElectronX.getCookie).toHaveBeenCalledWith(
        1,
        "api.x.com",
        "ct0",
      );
    });

    it("should load home URL before making request", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(
        JSON.stringify(mockViewerResponse),
      );

      await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(mockVM.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/home",
      );
    });

    it("should return parsed user info on success", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(
        JSON.stringify(mockViewerResponse),
      );

      const result = await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(result).toEqual({
        username: "testuser",
        userID: "123456789",
        bio: "Test bio",
        profileImageDataURI: "data:image/png;base64,test",
        followingCount: 100,
        followersCount: 200,
        tweetsCount: 500,
        likesCount: 300,
      } as XUserInfo);
    });

    it("should fetch profile image data URI", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(
        JSON.stringify(mockViewerResponse),
      );

      await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(mockElectronX.getImageDataURI).toHaveBeenCalledWith(
        1,
        "https://pbs.twimg.com/profile_images/test.jpg",
      );
    });

    it("should include correct headers in request", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(
        JSON.stringify(mockViewerResponse),
      );

      await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      const jsCode = mockWebview.executeJavaScript.mock.calls[0][0];
      expect(jsCode).toContain(`"authorization": "${X_AUTHORIZATION_HEADER}"`);
      expect(jsCode).toContain("\"x-csrf-token\": 'test-ct0-token'");
      expect(jsCode).toContain('"x-twitter-active-user": "yes"');
      expect(jsCode).toContain('"x-twitter-client-language": "en"');
    });

    it("should use GET method", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(
        JSON.stringify(mockViewerResponse),
      );

      await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      const jsCode = mockWebview.executeJavaScript.mock.calls[0][0];
      expect(jsCode).toContain('"method": "GET"');
    });

    it("should retry up to 3 times if response is null", async () => {
      mockWebview.executeJavaScript
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(mockViewerResponse));

      const result = await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(result).toBeTruthy();
      expect(mockWebview.executeJavaScript).toHaveBeenCalledTimes(3);
      expect(mockVM.sleep).toHaveBeenCalledTimes(2); // Sleep before 2nd and 3rd try
    });

    it("should return null after 3 failed tries", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(null);

      const result = await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(result).toBeNull();
      expect(mockWebview.executeJavaScript).toHaveBeenCalledTimes(3);
      expect(mockVM.log).toHaveBeenCalledWith(
        "graphqlGetViewerUser",
        "failed to get userInfo after 3 tries",
      );
    });

    it("should retry if JSON parsing fails", async () => {
      mockWebview.executeJavaScript
        .mockResolvedValueOnce("invalid json")
        .mockResolvedValueOnce(JSON.stringify(mockViewerResponse));

      const result = await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(result).toBeTruthy();
      expect(mockWebview.executeJavaScript).toHaveBeenCalledTimes(2);
    });

    it("should log parsing errors", async () => {
      const invalidJSON = "not valid json";
      mockWebview.executeJavaScript
        .mockResolvedValueOnce(invalidJSON)
        .mockResolvedValueOnce(JSON.stringify(mockViewerResponse));

      await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(mockVM.log).toHaveBeenCalledWith(
        "graphqlGetViewerUser",
        expect.arrayContaining([
          "error parsing response:",
          invalidJSON,
          expect.any(Error),
        ]),
      );
    });

    it("should log each try attempt", async () => {
      mockWebview.executeJavaScript.mockResolvedValue(
        JSON.stringify(mockViewerResponse),
      );

      await GraphQL.graphqlGetViewerUser(mockVM as XViewModel);

      expect(mockVM.log).toHaveBeenCalledWith("graphqlGetViewerUser", "try #0");
    });
  });
});
