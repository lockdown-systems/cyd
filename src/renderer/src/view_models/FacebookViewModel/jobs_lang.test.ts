import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FacebookViewModel } from "./view_model";
import { AutomationErrorType } from "../../automation_errors";
import {
  State,
  RunJobsState,
  FacebookJob,
  emptyFacebookProgress,
} from "./types";
import type { Account } from "../../../../shared_types";
import {
  createMockAccount,
  createMockWebview,
  createMockEmitter,
  createMockFacebookAccount,
  mockElectronAPI,
} from "../../test_util";
import * as LangJobs from "./jobs_lang";

/**
 * Creates a mock FacebookJob for testing
 */
function createMockJob(
  jobType: string,
  overrides?: Partial<FacebookJob>,
): FacebookJob {
  return {
    id: 1,
    jobType: jobType as FacebookJob["jobType"],
    status: "pending",
    startedAt: null,
    finishedAt: null,
    progressJSON: JSON.stringify(emptyFacebookProgress()),
    error: null,
    ...overrides,
  };
}

/**
 * Creates a mock FacebookViewModel with mocked dependencies for testing
 */
function createMockFacebookViewModel(
  accountOverrides?: Partial<Account>,
): FacebookViewModel {
  const mockFacebookAccount = createMockFacebookAccount(
    accountOverrides?.facebookAccount || {},
  );
  const mockAccount = createMockAccount({
    type: "Facebook",
    xAccount: null,
    facebookAccount: mockFacebookAccount,
    ...accountOverrides,
  });
  const mockEmitter = createMockEmitter();
  const mockWebview = createMockWebview();

  // Create the FacebookViewModel instance
  const vm = new FacebookViewModel(mockAccount, mockEmitter);

  // Mock the webview
  vm.webview = mockWebview;
  vm.webContentsID = 1;
  vm.isWebviewDestroyed = false;

  // Set some sensible defaults for testing
  vm.state = State.Login;
  vm.runJobsState = RunJobsState.Default;
  vm.isPaused = false;
  vm.showBrowser = false;
  vm.showAutomationNotice = false;
  vm.domReady = true;

  // Set up mock jobs array with placeholder jobs for testing
  vm.jobs = [
    createMockJob("saveUserLang"),
    createMockJob("setLangToEnglish"),
    createMockJob("deleteWallPosts"),
    createMockJob("restoreUserLang"),
  ];

  // Mock common methods that are called frequently
  vi.spyOn(vm, "log").mockImplementation(() => {});
  vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
  vi.spyOn(vm, "waitForPause").mockResolvedValue(undefined);
  vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
  vi.spyOn(vm, "pause").mockResolvedValue(undefined);
  vi.spyOn(vm, "loadURL").mockResolvedValue(undefined);
  vi.spyOn(vm, "error").mockResolvedValue(undefined);

  return vm;
}

describe("FacebookViewModel Language Jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("findCurrentLanguage", () => {
    it('finds "English (US)" as the current language', async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Mock executeJavaScript to return English (US) as the selected language
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(
        "English (US)",
      );

      const language = await LangJobs.findCurrentLanguage(vm);

      expect(language).toBe("English (US)");
    });

    it('finds "Español" as the current language', async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Mock executeJavaScript to return Español as the selected language
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue("Español");

      const language = await LangJobs.findCurrentLanguage(vm);

      expect(language).toBe("Español");
    });

    it("returns default language when webview is not available", async () => {
      const vm = createMockFacebookViewModel();
      vm.webview = null;

      const language = await LangJobs.findCurrentLanguage(vm);

      expect(language).toBe(LangJobs.DEFAULT_LANGUAGE);
    });

    it("returns default language when executeJavaScript returns null", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(null);

      const language = await LangJobs.findCurrentLanguage(vm);

      expect(language).toBe(LangJobs.DEFAULT_LANGUAGE);
    });

    it("returns default language on error", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockRejectedValue(
        new Error("JavaScript execution failed"),
      );

      const language = await LangJobs.findCurrentLanguage(vm);

      expect(language).toBe(LangJobs.DEFAULT_LANGUAGE);
    });
  });

  describe("selectLanguage", () => {
    it('selects "English (US)" from the language list', async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Mock that the language was found and clicked
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      const result = await LangJobs.selectLanguage(vm, "English (US)");

      expect(result).toBe(true);
    });

    it('selects "Español" from the language list', async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      const result = await LangJobs.selectLanguage(vm, "Español");

      expect(result).toBe(true);
    });

    it("returns false when language is not found", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      const result = await LangJobs.selectLanguage(vm, "NonexistentLanguage");

      expect(result).toBe(false);
      expect(vm.log).toHaveBeenCalledWith(
        "selectLanguage",
        "Language not found in list: NonexistentLanguage",
      );
    });

    it("returns false when webview is not available", async () => {
      const vm = createMockFacebookViewModel();
      vm.webview = null;

      const result = await LangJobs.selectLanguage(vm, "English (US)");

      expect(result).toBe(false);
    });

    it("handles errors gracefully", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockRejectedValue(
        new Error("JavaScript execution failed"),
      );

      const result = await LangJobs.selectLanguage(vm, "English (US)");

      expect(result).toBe(false);
      // safeExecuteJavaScript logs the error with format "Error: {errorMsg}"
      expect(vm.log).toHaveBeenCalledWith(
        "selectLanguage",
        expect.stringContaining("Error:"),
      );
    });
  });

  describe("runJobSaveUserLang", () => {
    it('saves "English (US)" when user language is English', async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ userLang: "" }),
      });
      const mockWebview = vm.getWebview()!;

      // Create a sequence of mock responses for the different executeJavaScript calls
      const mockExecute = vi.mocked(mockWebview.executeJavaScript);

      // First call: click language button - success
      // Second call: check dialog exists - success
      // Third call: find current language - English (US)
      mockExecute
        .mockResolvedValueOnce(true) // click language button
        .mockResolvedValueOnce(true) // dialog exists check
        .mockResolvedValueOnce("English (US)"); // find current language

      await LangJobs.runJobSaveUserLang(vm, 0);

      expect(vm.account.facebookAccount?.userLang).toBe("English (US)");
      expect(window.electron.database.saveAccount).toHaveBeenCalled();
    });

    it('saves "Español" when user language is Spanish', async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ userLang: "" }),
      });
      const mockWebview = vm.getWebview()!;

      const mockExecute = vi.mocked(mockWebview.executeJavaScript);
      mockExecute
        .mockResolvedValueOnce(true) // click language button
        .mockResolvedValueOnce(true) // dialog exists check
        .mockResolvedValueOnce("Español"); // find current language

      await LangJobs.runJobSaveUserLang(vm, 0);

      expect(vm.account.facebookAccount?.userLang).toBe("Español");
      expect(window.electron.database.saveAccount).toHaveBeenCalled();
    });

    it("sets state to SaveUserLang", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce("English (US)");

      await LangJobs.runJobSaveUserLang(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.SaveUserLang);
    });

    it("reports error when dialog fails to open", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ userLang: "" }),
      });
      const mockWebview = vm.getWebview()!;

      // Dialog button click fails
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValueOnce(false);

      await LangJobs.runJobSaveUserLang(vm, 0);

      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.facebook_runJob_language_OpenDialogFailed,
        expect.objectContaining({ job: "saveUserLang" }),
        expect.anything(),
      );
      expect(vm.jobs[0].status).toBe("error");
      expect(vm.account.facebookAccount?.userLang).toBe("");
    });
  });

  describe("runJobSetLangToEnglish", () => {
    it("skips when language is already English (US)", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({
          userLang: "English (US)",
        }),
      });

      await LangJobs.runJobSetLangToEnglish(vm, 0);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobSetLangToEnglish",
        "Already using English (US), skipping",
      );
      // executeJavaScript should not have been called for language change
      expect(vm.getWebview()?.executeJavaScript).not.toHaveBeenCalled();
    });

    it("changes language to English when currently Spanish", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ userLang: "Español" }),
      });
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // click language button
        .mockResolvedValueOnce(true) // dialog exists check
        .mockResolvedValueOnce(true); // select English (US)

      await LangJobs.runJobSetLangToEnglish(vm, 0);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobSetLangToEnglish",
        "Setting language to English (US)",
      );
      expect(vm.log).toHaveBeenCalledWith(
        "runJobSetLangToEnglish",
        "Successfully selected English (US)",
      );
    });

    it("sets state to SetLangToEnglish", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ userLang: "Español" }),
      });
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await LangJobs.runJobSetLangToEnglish(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.SetLangToEnglish);
    });

    it("logs failure when English selection fails", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({
          userLang: "Português (Brasil)",
        }),
      });
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // click language button
        .mockResolvedValueOnce(true) // dialog exists check
        .mockResolvedValueOnce(false); // select English fails

      await LangJobs.runJobSetLangToEnglish(vm, 0);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobSetLangToEnglish",
        "Failed to select English (US)",
      );
    });
  });

  describe("runJobRestoreUserLang", () => {
    it("skips when user language is English (US)", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({
          userLang: "English (US)",
        }),
      });

      await LangJobs.runJobRestoreUserLang(vm, 0);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobRestoreUserLang",
        "User language is English (US), skipping restore",
      );
      // executeJavaScript should not have been called for language change
      expect(vm.getWebview()?.executeJavaScript).not.toHaveBeenCalled();
    });

    it("restores language to Spanish", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ userLang: "Español" }),
      });
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // click language button
        .mockResolvedValueOnce(true) // dialog exists check
        .mockResolvedValueOnce(true); // select Español

      await LangJobs.runJobRestoreUserLang(vm, 0);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobRestoreUserLang",
        "Restoring language to Español",
      );
      expect(vm.log).toHaveBeenCalledWith(
        "runJobRestoreUserLang",
        "Successfully restored to Español",
      );
    });

    it("restores language to Portuguese (Brazil)", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({
          userLang: "Português (Brasil)",
        }),
      });
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // click language button
        .mockResolvedValueOnce(true) // dialog exists check
        .mockResolvedValueOnce(true); // select Portuguese

      await LangJobs.runJobRestoreUserLang(vm, 0);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobRestoreUserLang",
        "Restoring language to Português (Brasil)",
      );
      expect(vm.log).toHaveBeenCalledWith(
        "runJobRestoreUserLang",
        "Successfully restored to Português (Brasil)",
      );
    });

    it("sets state to RestoreUserLang", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({ userLang: "Español" }),
      });
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await LangJobs.runJobRestoreUserLang(vm, 0);

      expect(vm.runJobsState).toBe(RunJobsState.RestoreUserLang);
    });

    it("logs failure when language restoration fails", async () => {
      const vm = createMockFacebookViewModel({
        facebookAccount: createMockFacebookAccount({
          userLang: "Français (France)",
        }),
      });
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript)
        .mockResolvedValueOnce(true) // click language button
        .mockResolvedValueOnce(true) // dialog exists check
        .mockResolvedValueOnce(false); // select French fails

      await LangJobs.runJobRestoreUserLang(vm, 0);

      expect(vm.log).toHaveBeenCalledWith(
        "runJobRestoreUserLang",
        "Failed to select Français (France)",
      );
    });
  });

  describe("waitForLanguageDialog", () => {
    it("returns true when dialog appears", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(true);

      const result = await LangJobs.waitForLanguageDialog(vm);

      expect(result).toBe(true);
    });

    it("returns false when dialog never appears", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Dialog never appears
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      const result = await LangJobs.waitForLanguageDialog(vm);

      expect(result).toBe(false);
    });

    it("returns false when webview is not available", async () => {
      const vm = createMockFacebookViewModel();
      vm.webview = null;

      const result = await LangJobs.waitForLanguageDialog(vm);

      expect(result).toBe(false);
    });

    it("retries up to 20 times when dialog does not appear", async () => {
      const vm = createMockFacebookViewModel();
      const mockWebview = vm.getWebview()!;

      // Dialog never appears
      vi.mocked(mockWebview.executeJavaScript).mockResolvedValue(false);

      await LangJobs.waitForLanguageDialog(vm);

      // Should have called executeJavaScript 20 times
      expect(mockWebview.executeJavaScript).toHaveBeenCalledTimes(20);
    });
  });

  describe("Integration scenarios", () => {
    describe("User with English language", () => {
      it("saveUserLang -> setLangToEnglish (skips) -> restoreUserLang (skips)", async () => {
        const vm = createMockFacebookViewModel({
          facebookAccount: createMockFacebookAccount({ userLang: "" }),
        });
        const mockWebview = vm.getWebview()!;

        // Step 1: Save user lang - finds English
        vi.mocked(mockWebview.executeJavaScript)
          .mockResolvedValueOnce(true) // click button
          .mockResolvedValueOnce(true) // dialog check
          .mockResolvedValueOnce("English (US)"); // find language

        await LangJobs.runJobSaveUserLang(vm, 0);
        expect(vm.account.facebookAccount?.userLang).toBe("English (US)");

        // Step 2: Set to English - should skip
        vi.mocked(mockWebview.executeJavaScript).mockClear();
        await LangJobs.runJobSetLangToEnglish(vm, 1);
        expect(mockWebview.executeJavaScript).not.toHaveBeenCalled();

        // Step 3: Restore - should skip
        vi.mocked(mockWebview.executeJavaScript).mockClear();
        await LangJobs.runJobRestoreUserLang(vm, 2);
        expect(mockWebview.executeJavaScript).not.toHaveBeenCalled();
      });
    });

    describe("User with Spanish language", () => {
      it("saveUserLang -> setLangToEnglish -> restoreUserLang restores Spanish", async () => {
        const vm = createMockFacebookViewModel({
          facebookAccount: createMockFacebookAccount({ userLang: "" }),
        });
        const mockWebview = vm.getWebview()!;

        // Step 1: Save user lang - finds Español
        vi.mocked(mockWebview.executeJavaScript)
          .mockResolvedValueOnce(true) // click button
          .mockResolvedValueOnce(true) // dialog check
          .mockResolvedValueOnce("Español"); // find language

        await LangJobs.runJobSaveUserLang(vm, 0);
        expect(vm.account.facebookAccount?.userLang).toBe("Español");

        // Step 2: Set to English
        vi.mocked(mockWebview.executeJavaScript)
          .mockResolvedValueOnce(true) // click button
          .mockResolvedValueOnce(true) // dialog check
          .mockResolvedValueOnce(true); // select English

        await LangJobs.runJobSetLangToEnglish(vm, 1);
        expect(vm.log).toHaveBeenCalledWith(
          "runJobSetLangToEnglish",
          "Successfully selected English (US)",
        );

        // Step 3: Restore to Spanish
        vi.mocked(mockWebview.executeJavaScript)
          .mockResolvedValueOnce(true) // click button
          .mockResolvedValueOnce(true) // dialog check
          .mockResolvedValueOnce(true); // select Español

        await LangJobs.runJobRestoreUserLang(vm, 2);
        expect(vm.log).toHaveBeenCalledWith(
          "runJobRestoreUserLang",
          "Successfully restored to Español",
        );
      });
    });
  });
});
