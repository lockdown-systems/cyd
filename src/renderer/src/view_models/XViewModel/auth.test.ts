import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Auth from "./auth";
import type { XViewModel } from "./view_model";
import { State } from "./types";
import { URLChangedError } from "../BaseViewModel";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import type { XUserInfo } from "../../types_x";
import type { Account, XAccount } from "../../../../shared_types";
import { createTestTranslator } from "../../test_util";

interface MockElectron {
  trackEvent: ReturnType<typeof vi.fn>;
  database: {
    saveAccount: ReturnType<typeof vi.fn>;
  };
  X: {
    setConfig: ReturnType<typeof vi.fn>;
  };
}

describe("auth.ts", () => {
  let mockVM: Partial<XViewModel>;
  let mockElectron: MockElectron;

  beforeEach(() => {
    // Create mock Electron API
    mockElectron = {
      trackEvent: vi.fn().mockResolvedValue(undefined),
      database: {
        saveAccount: vi.fn().mockResolvedValue(undefined),
      },
      X: {
        setConfig: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Setup window.electron mock
    (global as unknown as { window: { electron: unknown } }).window = {
      electron: mockElectron,
    };

    // Create mock view model
    const translator = createTestTranslator();
    mockVM = {
      account: {
        id: 1,
        xAccount: {
          username: "",
          userID: "",
          bio: "",
          profileImageDataURI: "",
          followersCount: 0,
          followingCount: 0,
          tweetsCount: 0,
          likesCount: 0,
        } as Partial<XAccount> as XAccount,
      } as Partial<Account> as Account,
      state: State.Login,
      showBrowser: false,
      showAutomationNotice: false,
      cancelWaitForURL: false,
      instructions: "",
      webview: {
        getURL: vi.fn().mockReturnValue("https://x.com/home"),
      } as Partial<XViewModel["webview"]> as XViewModel["webview"],
      log: vi.fn(),
      sleep: vi.fn().mockResolvedValue(undefined),
      error: vi.fn().mockResolvedValue(undefined),
      loadURLWithRateLimit: vi.fn().mockResolvedValue(undefined),
      waitForURL: vi.fn().mockResolvedValue(undefined),
      waitForPause: vi.fn().mockResolvedValue(undefined),
      doesSelectorExist: vi.fn().mockResolvedValue(false),
      scriptClickElementWithinElementLast: vi.fn().mockResolvedValue(undefined),
      graphqlGetViewerUser: vi.fn().mockResolvedValue({
        username: "testuser",
        userID: "123456789",
        bio: "Test bio",
        profileImageDataURI: "data:image/png;base64,test",
        followersCount: 200,
        followingCount: 100,
        tweetsCount: 500,
        likesCount: 300,
      } as XUserInfo),
      emitter: {
        emit: vi.fn(),
      } as Partial<XViewModel["emitter"]> as XViewModel["emitter"],
      login: vi.fn(),
      t: vi.fn(translator),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("should show browser", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockVM.showBrowser).toBe(true);
    });

    it("should load login page and wait for home URL", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockVM.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/login",
        ["https://x.com/home", "https://x.com/i/flow/login"],
      );
      expect(mockVM.waitForURL).toHaveBeenCalledWith("https://x.com/home");
    });

    it("should return early if login is cancelled before page loads", async () => {
      mockVM.cancelWaitForURL = true;

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.log).toHaveBeenCalledWith("login", "Login cancelled");
      expect(mockVM.waitForURL).not.toHaveBeenCalled();
    });

    it("should return early if login is cancelled during URL wait", async () => {
      vi.mocked(mockVM.waitForURL!).mockImplementationOnce(async () => {
        mockVM.cancelWaitForURL = true;
      });

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.log).toHaveBeenCalledWith("login", "Login cancelled");
      expect(mockVM.graphqlGetViewerUser).not.toHaveBeenCalled();
    });

    it("should handle URLChangedError", async () => {
      const urlError = new URLChangedError(
        "https://x.com/home",
        "https://x.com/other",
      );
      vi.mocked(mockVM.waitForURL!).mockRejectedValueOnce(urlError);

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.error).toHaveBeenCalledWith(
        AutomationErrorType.X_login_URLChanged,
        expect.objectContaining({
          error: expect.any(String),
        }),
        expect.objectContaining({
          currentURL: "https://x.com/home",
        }),
      );
    });

    it("should handle other waitForURL errors", async () => {
      const genericError = new Error("Timeout");
      vi.mocked(mockVM.waitForURL!).mockRejectedValueOnce(genericError);

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.error).toHaveBeenCalledWith(
        AutomationErrorType.X_login_WaitingForURLFailed,
        expect.objectContaining({
          error: expect.stringContaining("Timeout"),
        }),
        expect.objectContaining({
          currentURL: "https://x.com/home",
        }),
      );
    });

    it("should enable automation notice after login succeeds", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockVM.showAutomationNotice).toBe(true);
      expect(mockVM.sleep).toHaveBeenCalledWith(1000);
    });

    it("should track sign-in event for first-time login", async () => {
      mockVM.state = State.Login;

      await Auth.login(mockVM as XViewModel);

      expect(mockElectron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_USER_SIGNED_IN,
        navigator.userAgent,
      );
    });

    it("should not track sign-in event if not in Login state", async () => {
      mockVM.state = State.WizardStart;

      await Auth.login(mockVM as XViewModel);

      expect(mockElectron.trackEvent).not.toHaveBeenCalled();
    });

    it("should load home page if not already there", async () => {
      vi.mocked(mockVM.webview!.getURL).mockReturnValue(
        "https://x.com/other-page",
      );

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/home",
      );
    });

    it("should not reload home page if already there", async () => {
      vi.mocked(mockVM.webview!.getURL).mockReturnValue("https://x.com/home");

      await Auth.login(mockVM as XViewModel);

      // Should only be called once for the login page
      expect(mockVM.loadURLWithRateLimit).toHaveBeenCalledTimes(1);
      expect(mockVM.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/login",
        expect.any(Array),
      );
    });

    it("should handle cookie banner by clicking refuse button", async () => {
      vi.mocked(mockVM.doesSelectorExist!).mockResolvedValue(true);

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.doesSelectorExist).toHaveBeenCalledWith(
        'div[data-testid="BottomBar"]',
      );
      expect(mockVM.scriptClickElementWithinElementLast).toHaveBeenCalledTimes(
        2,
      );
      expect(mockVM.scriptClickElementWithinElementLast).toHaveBeenCalledWith(
        'div[data-testid="BottomBar"]',
        "button",
      );
    });

    it("should get user info via GraphQL", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockVM.graphqlGetViewerUser).toHaveBeenCalled();
    });

    it("should handle null user info", async () => {
      vi.mocked(mockVM.graphqlGetViewerUser!).mockResolvedValue(null);

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.error).toHaveBeenCalledWith(
        AutomationErrorType.X_login_GetViewerUserFailed,
        {
          error: "userInfo is null",
        },
      );
    });

    it("should save user information to account", async () => {
      const userInfo: XUserInfo = {
        username: "testuser",
        userID: "123456789",
        bio: "Test bio",
        profileImageDataURI: "data:image/png;base64,test",
        followersCount: 200,
        followingCount: 100,
        tweetsCount: 500,
        likesCount: 300,
      };
      vi.mocked(mockVM.graphqlGetViewerUser!).mockResolvedValue(userInfo);

      await Auth.login(mockVM as XViewModel);

      expect(mockVM.account?.xAccount?.username).toBe("testuser");
      expect(mockVM.account?.xAccount?.userID).toBe("123456789");
      expect(mockVM.account?.xAccount?.bio).toBe("Test bio");
      expect(mockVM.account?.xAccount?.profileImageDataURI).toBe(
        "data:image/png;base64,test",
      );
      expect(mockVM.account?.xAccount?.followersCount).toBe(200);
      expect(mockVM.account?.xAccount?.followingCount).toBe(100);
      expect(mockVM.account?.xAccount?.tweetsCount).toBe(500);
      expect(mockVM.account?.xAccount?.likesCount).toBe(300);
    });

    it("should save account to database", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockElectron.database.saveAccount).toHaveBeenCalledWith(
        JSON.stringify(mockVM.account),
      );
    });

    it("should emit reload media path event", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockVM.emitter?.emit).toHaveBeenCalledWith(
        "x-reload-media-path-1",
      );
    });

    it("should wait for pause at appropriate times", async () => {
      await Auth.login(mockVM as XViewModel);

      // Should be called twice: after tracking event and at the end
      expect(mockVM.waitForPause).toHaveBeenCalledTimes(2);
    });

    it("should log important steps", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockVM.log).toHaveBeenCalledWith("login", "logging in");
      expect(mockVM.log).toHaveBeenCalledWith("login", "login succeeded");
      expect(mockVM.log).toHaveBeenCalledWith(
        "login",
        "getting username and userID and profile picture",
      );
      expect(mockVM.log).toHaveBeenCalledWith("login", [
        "saved user information",
        expect.any(Object),
      ]);
    });

    it("should update instructions for user", async () => {
      await Auth.login(mockVM as XViewModel);

      expect(mockVM.instructions).toContain("username");
      expect(mockVM.instructions).toContain("profile picture");
    });
  });

  describe("loadUserStats", () => {
    it("should show browser and automation notice", async () => {
      await Auth.loadUserStats(mockVM as XViewModel);

      expect(mockVM.showBrowser).toBe(true);
      expect(mockVM.showAutomationNotice).toBe(true);
    });

    it("should call login", async () => {
      await Auth.loadUserStats(mockVM as XViewModel);

      expect(mockVM.login).toHaveBeenCalled();
    });

    it("should set reloadUserStats config to false", async () => {
      await Auth.loadUserStats(mockVM as XViewModel);

      expect(mockElectron.X.setConfig).toHaveBeenCalledWith(
        1,
        "reloadUserStats",
        "false",
      );
    });

    it("should wait for pause", async () => {
      await Auth.loadUserStats(mockVM as XViewModel);

      expect(mockVM.waitForPause).toHaveBeenCalled();
    });

    it("should log user stats loading", async () => {
      await Auth.loadUserStats(mockVM as XViewModel);

      expect(mockVM.log).toHaveBeenCalledWith(
        "loadUserStats",
        "loading user stats",
      );
      expect(mockVM.log).toHaveBeenCalledWith("login", "getting user stats");
    });

    it("should update instructions", async () => {
      await Auth.loadUserStats(mockVM as XViewModel);

      expect(mockVM.instructions).toContain("total tweets and likes");
    });
  });
});
