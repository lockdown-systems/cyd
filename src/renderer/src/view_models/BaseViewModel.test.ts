import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseViewModel } from "./BaseViewModel";
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
  ) {
    super(account, emitter);
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
});
