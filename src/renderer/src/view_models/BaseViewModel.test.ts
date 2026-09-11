import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseViewModel } from "./BaseViewModel";
import { AutomationErrorType } from "../automation_errors";
import {
  browserAutomationAPI,
  createMockAccount,
  createMockEmitter,
  mockElectronAPI,
} from "../test_util";

/**
 * A platform built on the core alone, standing in for one that talks to an API
 * directly instead of driving a browser.
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
  const vm = new TestViewModel(
    createMockAccount({ type: "X" }),
    createMockEmitter(),
  );

  // Mock the log method to track calls
  vi.spyOn(vm, "log");

  return vm;
}

describe("BaseViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  describe("webview-free core", () => {
    it.each(browserAutomationAPI)(
      "does not expose %s, because the core drives no browser",
      (method) => {
        const vm = createMockBaseViewModel();

        expect(method in vm).toBe(false);
      },
    );

    it("exposes no webview to reach a page through", () => {
      const vm = createMockBaseViewModel();

      expect("webview" in vm).toBe(false);
      expect("domReady" in vm).toBe(false);
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

  describe("error reporting", () => {
    /**
     * A platform that can name the account an error report is about. The core
     * knows nothing about any platform's account shape, so each platform
     * derives its own label.
     */
    class LabeledViewModel extends BaseViewModel {
      protected get errorReportAccountLabel(): string {
        return "labeled-account";
      }
    }

    it("reports the account label the platform derives", async () => {
      const vm = new LabeledViewModel(
        createMockAccount({ type: "X" }),
        createMockEmitter(),
      );

      await vm.error(
        AutomationErrorType.x_unknownError,
        { note: "boom" },
        null,
        true,
      );

      const [, , , , username] = vi.mocked(
        window.electron.database.createErrorReport,
      ).mock.calls[0];
      expect(username).toBe("labeled-account");
    });

    it("reports no account label when the platform derives none", async () => {
      const vm = new TestViewModel(
        createMockAccount({ type: "X" }),
        createMockEmitter(),
      );

      await vm.error(AutomationErrorType.x_unknownError, null, null, true);

      const [, , , , username] = vi.mocked(
        window.electron.database.createErrorReport,
      ).mock.calls[0];
      expect(username).toBe("");
    });

    it("produces a complete report for a platform with no page to look at", async () => {
      const vm = new TestViewModel(
        createMockAccount({ type: "X" }),
        createMockEmitter(),
      );
      vm.log("beforeTheFailure", "a log line");

      await vm.error(
        AutomationErrorType.x_unknownError,
        { note: "boom" },
        null,
        true,
      );

      const [
        accountID,
        accountType,
        errorType,
        errorReportData,
        ,
        screenshot,
        sensitiveContext,
      ] = vi.mocked(window.electron.database.createErrorReport).mock.calls[0];
      expect(accountID).toBe(1);
      expect(accountType).toBe("X");
      expect(errorType).toBe(AutomationErrorType.x_unknownError);
      expect(JSON.parse(errorReportData as string)).toEqual({ note: "boom" });
      expect(screenshot).toBe("");

      const parsedContext = JSON.parse(sensitiveContext as string);
      expect(parsedContext.logs).toHaveLength(1);
      expect(parsedContext.logs[0].func).toBe("beforeTheFailure");
      expect(parsedContext).not.toHaveProperty("currentURL");
    });
  });
});
