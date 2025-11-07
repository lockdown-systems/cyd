import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as RateLimit from "./rate_limit";
import type { XViewModel } from "./view_model";
import { InternetDownError, URLChangedError } from "../BaseViewModel";
import { AutomationErrorType } from "../../automation_errors";
import type { Account } from "../../../../shared_types";
import { emptyXRateLimitInfo } from "../../../../shared_types";

interface MockElectronX {
  resetRateLimitInfo: ReturnType<typeof vi.fn>;
  isRateLimited: ReturnType<typeof vi.fn>;
}

describe("rate_limit.ts", () => {
  let mockVM: Partial<XViewModel>;
  let mockElectronX: MockElectronX;
  let currentURL: string;

  beforeEach(() => {
    // Track current URL to simulate browser behavior
    currentURL = "https://x.com/home";

    // Create mock Electron API
    mockElectronX = {
      resetRateLimitInfo: vi.fn().mockResolvedValue(undefined),
      isRateLimited: vi.fn().mockResolvedValue(emptyXRateLimitInfo()),
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
      rateLimitInfo: emptyXRateLimitInfo(),
      webview: {
        getURL: vi.fn().mockImplementation(() => currentURL),
      } as Partial<XViewModel["webview"]> as XViewModel["webview"],
      cancelWaitForURL: false,
      log: vi.fn(),
      sleep: vi.fn().mockResolvedValue(undefined),
      error: vi.fn().mockResolvedValue(undefined),
      waitForPause: vi.fn().mockResolvedValue(undefined),
      loadURL: vi.fn().mockImplementation(async (url: string) => {
        // Simulate loading the URL
        currentURL = url;
      }),
      emitter: {
        emit: vi.fn(),
      } as Partial<XViewModel["emitter"]> as XViewModel["emitter"],
      waitForRateLimit: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("waitForRateLimit", () => {
    it("should calculate wait time from rateLimitReset", async () => {
      const futureTime = Math.floor(Date.now() / 1000) + 300; // 5 minutes in the future
      mockVM.rateLimitInfo = {
        ...emptyXRateLimitInfo(),
        isRateLimited: true,
        rateLimitReset: futureTime,
      };

      await RateLimit.waitForRateLimit(mockVM as XViewModel);

      // Should sleep for approximately 300 seconds (300,000 ms)
      expect(mockVM.sleep).toHaveBeenCalledWith(expect.any(Number));
      const sleepCall = vi.mocked(mockVM.sleep!).mock.calls[0][0];
      expect(sleepCall).toBeGreaterThan(295000); // Allow some tolerance
      expect(sleepCall).toBeLessThan(305000);
    });

    it("should sleep for 0 if rateLimitReset is in the past", async () => {
      const pastTime = Math.floor(Date.now() / 1000) - 100;
      mockVM.rateLimitInfo = {
        ...emptyXRateLimitInfo(),
        isRateLimited: true,
        rateLimitReset: pastTime,
      };

      await RateLimit.waitForRateLimit(mockVM as XViewModel);

      // Should sleep for negative or 0 time
      const sleepCall = vi.mocked(mockVM.sleep!).mock.calls[0][0];
      expect(sleepCall).toBeLessThanOrEqual(0);
    });

    it("should reset rate limit info after waiting", async () => {
      mockVM.rateLimitInfo = {
        ...emptyXRateLimitInfo(),
        isRateLimited: true,
        rateLimitReset: Math.floor(Date.now() / 1000) + 10,
      };

      await RateLimit.waitForRateLimit(mockVM as XViewModel);

      expect(mockElectronX.resetRateLimitInfo).toHaveBeenCalledWith(1);
      expect(mockVM.rateLimitInfo).toEqual(emptyXRateLimitInfo());
    });

    it("should wait for pause after sleep", async () => {
      mockVM.rateLimitInfo = {
        ...emptyXRateLimitInfo(),
        isRateLimited: true,
        rateLimitReset: Math.floor(Date.now() / 1000) + 10,
      };

      await RateLimit.waitForRateLimit(mockVM as XViewModel);

      expect(mockVM.waitForPause).toHaveBeenCalled();
    });

    it("should log rate limit info", async () => {
      const rateLimitInfo = {
        ...emptyXRateLimitInfo(),
        isRateLimited: true,
        rateLimitReset: Math.floor(Date.now() / 1000) + 10,
      };
      mockVM.rateLimitInfo = rateLimitInfo;

      await RateLimit.waitForRateLimit(mockVM as XViewModel);

      expect(mockVM.log).toHaveBeenCalledWith(
        "waitForRateLimit",
        rateLimitInfo,
      );
      expect(mockVM.log).toHaveBeenCalledWith(
        "waitForRateLimit",
        "finished waiting for rate limit",
      );
      expect(mockVM.log).toHaveBeenCalledWith(
        "waitForRateLimit",
        "finished waiting for pause",
      );
    });
  });

  describe("loadURLWithRateLimit", () => {
    it("should reset rate limit info before loading", async () => {
      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/test",
      );

      expect(mockElectronX.resetRateLimitInfo).toHaveBeenCalledWith(1);
    });

    it("should load URL successfully", async () => {
      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/test",
      );

      expect(mockVM.loadURL).toHaveBeenCalledWith("https://x.com/test");
    });

    it("should check if rate limited after loading", async () => {
      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/test",
      );

      expect(mockElectronX.isRateLimited).toHaveBeenCalledWith(1);
    });

    it("should handle InternetDownError by emitting cancel event", async () => {
      const internetError = new InternetDownError();
      vi.mocked(mockVM.loadURL!).mockRejectedValueOnce(internetError);

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/test",
      );

      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "internet is down",
      );
      expect(mockVM.emitter?.emit).toHaveBeenCalledWith("cancel-automation-1");
    });

    it("should handle other load errors", async () => {
      const genericError = new Error("Load failed");
      vi.mocked(mockVM.loadURL!).mockRejectedValueOnce(genericError);

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/test",
      );

      expect(mockVM.error).toHaveBeenCalledWith(
        AutomationErrorType.x_loadURLError,
        expect.objectContaining({
          url: "https://x.com/test",
          error: expect.stringContaining("Load failed"),
        }),
        expect.objectContaining({
          currentURL: "https://x.com/home",
        }),
      );
    });

    it("should allow URL changes that match expectedURLs (string)", async () => {
      vi.mocked(mockVM.webview!.getURL).mockReturnValue(
        "https://x.com/i/flow/login",
      );

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/login",
        ["https://x.com/i/flow/login"],
      );

      // Should not throw error
      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "expected, URL change to https://x.com/i/flow/login",
      );
    });

    it("should allow URL changes that match expectedURLs (regex)", async () => {
      vi.mocked(mockVM.webview!.getURL).mockReturnValue(
        "https://x.com/i/flow/login?mx=2",
      );

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/login",
        [/^https:\/\/x\.com\/i\/flow/],
      );

      // Should not throw error
      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        expect.stringContaining("expected, URL change"),
      );
    });

    it("should throw URLChangedError for unexpected URL changes", async () => {
      vi.mocked(mockVM.webview!.getURL).mockReturnValue(
        "https://x.com/unexpected",
      );

      await expect(
        RateLimit.loadURLWithRateLimit(
          mockVM as XViewModel,
          "https://x.com/login",
          ["https://x.com/home"],
        ),
      ).rejects.toThrow(URLChangedError);

      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "UNEXPECTED, URL change to https://x.com/unexpected",
      );
    });

    it("should ignore unexpected URL changes if cancelled", async () => {
      mockVM.cancelWaitForURL = true;
      vi.mocked(mockVM.webview!.getURL).mockReturnValue(
        "https://x.com/unexpected",
      );

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/login",
        ["https://x.com/home"],
      );

      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "UNEXPECTED, URL change to https://x.com/unexpected, but ignoring because canceled",
      );
    });

    it("should ignore query string changes in URL", async () => {
      vi.mocked(mockVM.webview!.getURL).mockReturnValue(
        "https://x.com/login?mx=2",
      );

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/login",
      );

      // Should not throw error because only query string changed
      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "finished loading URL",
      );
    });

    it("should allow redirects when redirectOk is true", async () => {
      vi.mocked(mockVM.webview!.getURL).mockReturnValue(
        "https://x.com/different-page",
      );

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/login",
        [],
        true, // redirectOk
      );

      // Should not check for URL changes
      expect(mockVM.log).not.toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "checking if URL changed",
      );
    });

    it("should retry after rate limit", async () => {
      // First attempt: rate limited
      mockElectronX.isRateLimited
        .mockResolvedValueOnce({
          ...emptyXRateLimitInfo(),
          isRateLimited: true,
          rateLimitReset: Math.floor(Date.now() / 1000) + 10,
        })
        // Second attempt: not rate limited
        .mockResolvedValueOnce(emptyXRateLimitInfo());

      // Mock waitForRateLimit to just update the rateLimitInfo
      vi.mocked(mockVM.waitForRateLimit!).mockImplementation(async () => {
        mockVM.rateLimitInfo = emptyXRateLimitInfo();
      });

      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/test",
      );

      // Should call loadURL twice
      expect(mockVM.loadURL).toHaveBeenCalledTimes(2);
      expect(mockVM.waitForRateLimit).toHaveBeenCalledTimes(1);
    });

    it("should log important steps", async () => {
      await RateLimit.loadURLWithRateLimit(
        mockVM as XViewModel,
        "https://x.com/test",
      );

      expect(mockVM.log).toHaveBeenCalledWith("loadURLWithRateLimit", [
        "https://x.com/test",
        [],
        false,
      ]);
      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "URL loaded successfully",
      );
      expect(mockVM.log).toHaveBeenCalledWith(
        "loadURLWithRateLimit",
        "finished loading URL",
      );
    });
  });
});
