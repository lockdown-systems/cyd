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
});
