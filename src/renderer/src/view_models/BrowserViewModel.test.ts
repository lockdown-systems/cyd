import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserViewModel } from "./BrowserViewModel";
import { TimeoutError, URLChangedError } from "./automation_failures";
import { AutomationErrorType } from "../automation_errors";
import {
  createMockAccount,
  createMockWebview,
  createMockEmitter,
  mockElectronAPI,
} from "../test_util";

/**
 * Helper to create a mock BrowserViewModel instance with a webview already
 * handed to it, the way a platform view does at mount. It stands in for X or
 * Facebook.
 */
function createMockBrowserViewModel() {
  const vm = new BrowserViewModel(
    createMockAccount({ type: "X" }),
    createMockEmitter(),
  );

  // Set up the webview after construction (mimicking actual usage)
  vm.webview = createMockWebview();
  vm.webContentsID = 1;
  vm.isWebviewDestroyed = false;

  // Mock the log method to track calls
  vi.spyOn(vm, "log");

  return vm;
}

describe("BrowserViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  describe("clickElementByXPath", () => {
    it("returns true when element is clicked successfully", async () => {
      const vm = createMockBrowserViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      const result = await vm.clickElementByXPath("//button[@id='test']");

      expect(result).toBe(true);
      expect(mockWebview.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining("//button[@id='test']"),
      );
    });

    it("returns false when element is not found", async () => {
      const vm = createMockBrowserViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      const result = await vm.clickElementByXPath("//nonexistent/xpath");

      expect(result).toBe(false);
    });

    it("returns false when webview is not available", async () => {
      const vm = createMockBrowserViewModel();
      vm.webview = null;

      const result = await vm.clickElementByXPath("//button[@id='test']");

      expect(result).toBe(false);
    });

    it("handles errors gracefully", async () => {
      const vm = createMockBrowserViewModel();
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
      const vm = createMockBrowserViewModel();
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
      const vm = createMockBrowserViewModel();
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
      const vm = createMockBrowserViewModel();
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
      const vm = createMockBrowserViewModel();
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
      const vm = createMockBrowserViewModel();
      vm.webview = null;

      await vm.safeExecuteJavaScript<boolean>("(() => true)()");

      // Should not have logged anything since no context was provided
      expect(vm.log).not.toHaveBeenCalled();
    });

    it("returns success false when webview is destroyed", async () => {
      const vm = createMockBrowserViewModel();
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
      const vm = createMockBrowserViewModel();
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
      const vm = createMockBrowserViewModel();
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

  describe("getWebview", () => {
    it("returns webview when not destroyed", () => {
      const vm = createMockBrowserViewModel();
      vm.isWebviewDestroyed = false;

      const webview = vm.getWebview();

      expect(webview).not.toBeNull();
    });

    it("returns null when webview is destroyed", () => {
      const vm = createMockBrowserViewModel();
      vm.isWebviewDestroyed = true;

      const webview = vm.getWebview();

      expect(webview).toBeNull();
    });

    it("returns null when webview is null", () => {
      const vm = createMockBrowserViewModel();
      vm.webview = null;

      const webview = vm.getWebview();

      expect(webview).toBeNull();
    });
  });

  describe("destroy", () => {
    it("marks webview as destroyed", () => {
      const vm = createMockBrowserViewModel();
      expect(vm.isWebviewDestroyed).toBe(false);

      vm.destroy();

      expect(vm.isWebviewDestroyed).toBe(true);
    });
  });

  describe("doesSelectorExist", () => {
    it("returns true when selector exists", async () => {
      const vm = createMockBrowserViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      const result = await vm.doesSelectorExist(".my-class");

      expect(result).toBe(true);
      expect(mockWebview.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining(".my-class"),
      );
    });

    it("returns false when selector does not exist", async () => {
      const vm = createMockBrowserViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      const result = await vm.doesSelectorExist(".nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("countSelectorsFound", () => {
    it("returns count of matching selectors", async () => {
      const vm = createMockBrowserViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(5);

      const result = await vm.countSelectorsFound(".item");

      expect(result).toBe(5);
    });
  });

  describe("error reporting", () => {
    it("attaches the page URL and a screenshot when the person can see the browser", async () => {
      const vm = createMockBrowserViewModel();
      vm.showBrowser = true;
      vi.mocked(vm.getWebview()!.getURL).mockReturnValue(
        "https://x.com/settings",
      );

      await vm.error(AutomationErrorType.x_unknownError, null, null, true);

      const [, , , , , screenshot, sensitiveContext] = vi.mocked(
        window.electron.database.createErrorReport,
      ).mock.calls[0];
      expect(screenshot).toBe("data:image/png;base64,test");
      expect(JSON.parse(sensitiveContext as string).currentURL).toBe(
        "https://x.com/settings",
      );
    });

    it("attaches the page URL but no screenshot while the browser is hidden", async () => {
      const vm = createMockBrowserViewModel();
      vm.showBrowser = false;
      vi.mocked(vm.getWebview()!.getURL).mockReturnValue(
        "https://x.com/settings",
      );

      await vm.error(AutomationErrorType.x_unknownError, null, null, true);

      const [, , , , , screenshot, sensitiveContext] = vi.mocked(
        window.electron.database.createErrorReport,
      ).mock.calls[0];
      expect(screenshot).toBe("");
      expect(JSON.parse(sensitiveContext as string).currentURL).toBe(
        "https://x.com/settings",
      );
    });

    it("attaches no page once the webview is gone", async () => {
      const vm = createMockBrowserViewModel();
      vm.showBrowser = true;
      vm.destroy();

      await vm.error(AutomationErrorType.x_unknownError, null, null, true);

      const [, , , , , screenshot, sensitiveContext] = vi.mocked(
        window.electron.database.createErrorReport,
      ).mock.calls[0];
      expect(screenshot).toBe("");
      expect(JSON.parse(sensitiveContext as string)).not.toHaveProperty(
        "currentURL",
      );
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
