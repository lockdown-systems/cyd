import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseViewModel, TimeoutError, URLChangedError } from "./BaseViewModel";
import {
  createMockAccount,
  createMockWebview,
  createMockEmitter,
  mockElectronAPI,
} from "../test_util";

/**
 * Mock implementation of BaseViewModel for testing
 * since BaseViewModel is abstract and cannot be instantiated directly
 */
class TestViewModel extends BaseViewModel {
  constructor(
    account: ReturnType<typeof createMockAccount>,
    emitter: ReturnType<typeof createMockEmitter>,
    translator?: (key: string, params?: Record<string, unknown>) => string,
  ) {
    super(account, emitter, translator);
  }
}

/**
 * Helper to create a mock BaseViewModel instance for testing
 */
function createMockBaseViewModel() {
  const mockAccount = createMockAccount({ type: "X" });
  const mockEmitter = createMockEmitter();
  const mockWebview = createMockWebview();

  const vm = new TestViewModel(mockAccount, mockEmitter);

  // Set up the webview after construction (mimicking actual usage)
  vm.webview = mockWebview;
  vm.webContentsID = 1;
  vm.isWebviewDestroyed = false;

  // Mock the log method to track calls
  vi.spyOn(vm, "log");

  return vm;
}

describe("BaseViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  describe("clickElementByXPath", () => {
    it("returns true when element is clicked successfully", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      const result = await vm.clickElementByXPath("//button[@id='test']");

      expect(result).toBe(true);
      expect(mockWebview.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining("//button[@id='test']"),
      );
    });

    it("returns false when element is not found", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      const result = await vm.clickElementByXPath("//nonexistent/xpath");

      expect(result).toBe(false);
    });

    it("returns false when webview is not available", async () => {
      const vm = createMockBaseViewModel();
      vm.webview = null;

      const result = await vm.clickElementByXPath("//button[@id='test']");

      expect(result).toBe(false);
    });

    it("handles errors gracefully", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockRejectedValue(
        new Error("XPath error"),
      );

      const result = await vm.clickElementByXPath("//button[@id='test']");

      expect(result).toBe(false);
      expect(vm.log).toHaveBeenCalledWith(
        "clickElementByXPath",
        expect.stringContaining("Error clicking element"),
      );
    });

    it("executes correct XPath evaluation code", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      await vm.clickElementByXPath("//button[@class='submit']");

      const executeCall = vi.mocked(mockWebview.executeJavaScript).mock
        .calls[0][0];

      // Verify the code contains document.evaluate
      expect(executeCall).toContain("document.evaluate");
      // Verify it uses XPathResult.FIRST_ORDERED_NODE_TYPE
      expect(executeCall).toContain("XPathResult.FIRST_ORDERED_NODE_TYPE");
      // Verify it calls click on the element
      expect(executeCall).toContain(".click()");
      // Verify it includes the XPath
      expect(executeCall).toContain("//button[@class='submit']");
    });
  });

  describe("safeExecuteJavaScript", () => {
    it("returns success with value when JavaScript executes successfully", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue({
        foo: "bar",
      });

      const result = await vm.safeExecuteJavaScript<{ foo: string }>(
        "(() => ({ foo: 'bar' }))()",
        "testContext",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual({ foo: "bar" });
      }
    });

    it("returns success false when webview is not available", async () => {
      const vm = createMockBaseViewModel();
      vm.webview = null;

      const result = await vm.safeExecuteJavaScript<boolean>(
        "(() => true)()",
        "testContext",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Webview is not available");
      }
      expect(vm.log).toHaveBeenCalledWith(
        "testContext",
        "Webview is not available",
      );
    });

    it("returns success false when JavaScript execution throws", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockRejectedValue(
        new Error("JS execution failed"),
      );

      const result = await vm.safeExecuteJavaScript<boolean>(
        "(() => { throw new Error('test'); })()",
        "testContext",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("JS execution failed");
      }
      expect(vm.log).toHaveBeenCalledWith(
        "testContext",
        expect.stringContaining("Error:"),
      );
    });

    it("does not log when no logContext is provided", async () => {
      const vm = createMockBaseViewModel();
      vm.webview = null;

      await vm.safeExecuteJavaScript<boolean>("(() => true)()");

      // Should not have logged anything since no context was provided
      expect(vm.log).not.toHaveBeenCalled();
    });

    it("returns success false when webview is destroyed", async () => {
      const vm = createMockBaseViewModel();
      vm.isWebviewDestroyed = true;

      const result = await vm.safeExecuteJavaScript<boolean>(
        "(() => true)()",
        "testContext",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Webview is not available");
      }
    });

    it("handles primitive return values correctly", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(42);

      const result = await vm.safeExecuteJavaScript<number>(
        "(() => 42)()",
        "testContext",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });

    it("handles array return values correctly", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue([1, 2, 3]);

      const result = await vm.safeExecuteJavaScript<number[]>(
        "(() => [1, 2, 3])()",
        "testContext",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });
  });

  describe("log", () => {
    it("adds log entries with timestamp", () => {
      const vm = createMockBaseViewModel();
      vi.mocked(vm.log).mockRestore(); // Restore original implementation

      vm.log("testFunc", "test message");

      expect(vm.logs).toHaveLength(1);
      expect(vm.logs[0].func).toBe("testFunc");
      expect(vm.logs[0].message).toBe("test message");
      expect(vm.logs[0].timestamp).toBeDefined();
    });

    it("caps logs to 20 entries", () => {
      const vm = createMockBaseViewModel();
      vi.mocked(vm.log).mockRestore();

      // Add 25 logs
      for (let i = 0; i < 25; i++) {
        vm.log(`func${i}`, `message${i}`);
      }

      expect(vm.logs).toHaveLength(20);
      // First 5 should have been removed
      expect(vm.logs[0].func).toBe("func5");
    });

    it("logs without message", () => {
      const vm = createMockBaseViewModel();
      vi.mocked(vm.log).mockRestore();

      vm.log("testFunc");

      expect(vm.logs).toHaveLength(1);
      expect(vm.logs[0].func).toBe("testFunc");
      expect(vm.logs[0].message).toBeUndefined();
    });
  });

  describe("resetLogs", () => {
    it("clears all log entries", () => {
      const vm = createMockBaseViewModel();
      vi.mocked(vm.log).mockRestore();

      vm.log("func1", "msg1");
      vm.log("func2", "msg2");
      expect(vm.logs.length).toBeGreaterThan(0);

      vm.resetLogs();

      expect(vm.logs).toHaveLength(0);
    });
  });

  describe("getWebview", () => {
    it("returns webview when not destroyed", () => {
      const vm = createMockBaseViewModel();
      vm.isWebviewDestroyed = false;

      const webview = vm.getWebview();

      expect(webview).not.toBeNull();
    });

    it("returns null when webview is destroyed", () => {
      const vm = createMockBaseViewModel();
      vm.isWebviewDestroyed = true;

      const webview = vm.getWebview();

      expect(webview).toBeNull();
    });

    it("returns null when webview is null", () => {
      const vm = createMockBaseViewModel();
      vm.webview = null;

      const webview = vm.getWebview();

      expect(webview).toBeNull();
    });
  });

  describe("destroy", () => {
    it("marks webview as destroyed", () => {
      const vm = createMockBaseViewModel();
      expect(vm.isWebviewDestroyed).toBe(false);

      vm.destroy();

      expect(vm.isWebviewDestroyed).toBe(true);
    });
  });

  describe("sleep", () => {
    it("resolves after specified time", async () => {
      const vm = createMockBaseViewModel();
      const start = Date.now();

      await vm.sleep(50);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some tolerance
    });
  });

  describe("pause and resume", () => {
    it("pause sets isPaused to true", () => {
      const vm = createMockBaseViewModel();
      vm.isPaused = false;

      vm.pause();

      expect(vm.isPaused).toBe(true);
    });

    it("resume sets isPaused to false", () => {
      const vm = createMockBaseViewModel();
      vm.isPaused = true;

      vm.resume();

      expect(vm.isPaused).toBe(false);
    });
  });

  describe("waitForPause", () => {
    it("resolves immediately when not paused", async () => {
      const vm = createMockBaseViewModel();
      vm.isPaused = false;

      const start = Date.now();
      await vm.waitForPause();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("t (translation)", () => {
    it("uses translator function", () => {
      const mockAccount = createMockAccount({ type: "X" });
      const mockEmitter = createMockEmitter();
      const mockTranslator = vi.fn().mockReturnValue("Translated text");

      const vm = new TestViewModel(mockAccount, mockEmitter, mockTranslator);

      const result = vm.t("test.key", { param: "value" });

      expect(mockTranslator).toHaveBeenCalledWith("test.key", {
        param: "value",
      });
      expect(result).toBe("Translated text");
    });
  });

  describe("doesSelectorExist", () => {
    it("returns true when selector exists", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      const result = await vm.doesSelectorExist(".my-class");

      expect(result).toBe(true);
      expect(mockWebview.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining(".my-class"),
      );
    });

    it("returns false when selector does not exist", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      const result = await vm.doesSelectorExist(".nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("countSelectorsFound", () => {
    it("returns count of matching selectors", async () => {
      const vm = createMockBaseViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(5);

      const result = await vm.countSelectorsFound(".item");

      expect(result).toBe(5);
    });
  });

  describe("powerMonitorSuspend", () => {
    it("pauses automation when not already paused", () => {
      const vm = createMockBaseViewModel();
      vm.isPaused = false;
      vm.suspendLock = false;

      vm.powerMonitorSuspend();

      expect(vm.isPaused).toBe(true);
      expect(vm.shouldResumeOnResume).toBe(true);
      expect(vm.suspendLock).toBe(true);
    });

    it("does not pause when already paused", () => {
      const vm = createMockBaseViewModel();
      vm.isPaused = true;
      vm.suspendLock = false;

      vm.powerMonitorSuspend();

      expect(vm.shouldResumeOnResume).toBe(false);
      expect(vm.suspendLock).toBe(true);
    });

    it("skips when suspend lock is active", () => {
      const vm = createMockBaseViewModel();
      vm.suspendLock = true;
      vi.mocked(vm.log).mockClear();

      vm.powerMonitorSuspend();

      expect(vm.log).toHaveBeenCalledWith(
        "powerMonitorSuspend",
        expect.stringContaining("skipping"),
      );
    });
  });

  describe("powerMonitorResume", () => {
    it("resumes when shouldResumeOnResume is true", () => {
      const vm = createMockBaseViewModel();
      vm.suspendLock = true;
      vm.shouldResumeOnResume = true;
      vm.isPaused = true;

      vm.powerMonitorResume();

      expect(vm.suspendLock).toBe(false);
      expect(vm.isPaused).toBe(false);
    });

    it("does not resume when shouldResumeOnResume is false", () => {
      const vm = createMockBaseViewModel();
      vm.suspendLock = true;
      vm.shouldResumeOnResume = false;
      vm.isPaused = true;

      vm.powerMonitorResume();

      expect(vm.suspendLock).toBe(false);
      expect(vm.isPaused).toBe(true);
    });
  });

  describe("TimeoutError", () => {
    it("creates error with selector in message", () => {
      const error = new TimeoutError(".my-selector");

      expect(error.message).toContain(".my-selector");
      expect(error.name).toBe("TimeoutError");
    });
  });

  describe("URLChangedError", () => {
    it("creates error with URL info", () => {
      const error = new URLChangedError(
        "https://old.com",
        "https://new.com",
        [],
      );

      expect(error.message).toContain("https://old.com");
      expect(error.message).toContain("https://new.com");
      expect(error.name).toBe("URLChangedError");
    });

    it("includes valid URLs when provided", () => {
      const error = new URLChangedError("https://old.com", "https://new.com", [
        "https://valid1.com",
        "https://valid2.com",
      ]);

      expect(error.message).toContain("https://valid1.com");
      expect(error.message).toContain("https://valid2.com");
    });
  });
});
