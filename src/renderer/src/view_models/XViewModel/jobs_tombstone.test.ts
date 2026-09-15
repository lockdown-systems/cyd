import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as TombstoneJobs from "./jobs_tombstone";
import type { XViewModel } from "./view_model";
import { PlausibleEvents } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import {
  mockElectronAPI,
  resetElectronAPIMocks,
  createMockXAccount,
} from "../../test_util";
import { createMockXViewModel } from "./test_util";

describe("jobs_tombstone.ts", () => {
  let vm: XViewModel;

  beforeEach(() => {
    mockElectronAPI();
    vm = createMockXViewModel({
      xAccount: createMockXAccount({
        username: "testuser",
        tombstoneBannerDataURL: "data:image/png;base64,YmFubmVy",
      }),
    });

    vi.spyOn(vm, "loadURLWithRateLimit").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForSelector").mockResolvedValue(undefined);
    vi.spyOn(vm, "waitForLoadingToFinish").mockResolvedValue(undefined);
    vi.spyOn(vm, "sleep").mockResolvedValue(undefined);
    vi.spyOn(vm, "scriptClickElement").mockResolvedValue(true);
    vi.spyOn(vm, "finishJob").mockResolvedValue(undefined);
    vi.spyOn(vm, "error").mockResolvedValue(undefined);
    vi.spyOn(vm, "log").mockReturnValue(undefined);
    vi.spyOn(vm.getWebview()!, "executeJavaScript").mockResolvedValue(true);
  });

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("runJobTombstoneUpdateBanner", () => {
    it("should set the banner, apply the crop, and save", async () => {
      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(result).toBe(true);
      expect(window.electron.trackEvent).toHaveBeenCalledWith(
        PlausibleEvents.X_JOB_STARTED_TOMBSTONE_UPDATE_BANNER,
        navigator.userAgent,
      );
      expect(vm.loadURLWithRateLimit).toHaveBeenCalledWith(
        "https://x.com/settings/profile",
      );

      // The file input holds the banner, the crop step confirms it, and the
      // form saves it
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'input[data-testid="fileInput"]',
        "https://x.com/settings/profile",
      );
      expect(vm.getWebview()?.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining("data:image/png;base64,YmFubmVy"),
      );
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        '[data-testid="applyButton"]',
        "https://x.com/settings/profile",
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        '[data-testid="applyButton"]',
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="Profile_Save_Button"]',
      );
      expect(vm.finishJob).toHaveBeenCalledWith(0);
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should build the file without fetch, which X's CSP blocks for data: URLs", async () => {
      const scripts: string[] = [];
      vi.spyOn(vm.getWebview()!, "executeJavaScript").mockImplementation(
        async (code: string) => {
          scripts.push(code);
          return true;
        },
      );

      await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      // The job runs other scripts too, so pick out the one that builds the file
      const script = scripts.find((code) => code.includes("atob")) ?? "";
      expect(script).not.toBe("");

      // Stand in for the page: jsdom has no DataTransfer, and its input only
      // accepts a real FileList. fetch throws the way X's CSP makes it throw,
      // so going back to fetching the data URL fails this test.
      const selectors: string[] = [];
      const events: Event[] = [];
      const input = {
        files: null as File[] | null,
        dispatchEvent: (event: Event) => events.push(event),
      };
      const added: File[] = [];
      class FakeDataTransfer {
        items = { add: (file: File) => added.push(file) };
        get files() {
          return added;
        }
      }
      const blockedFetch = () => {
        throw new TypeError("Failed to fetch");
      };

      const result = await new Function(
        "document",
        "DataTransfer",
        "fetch",
        `return ${script.trim()}`,
      )(
        {
          querySelectorAll: (selector: string) => {
            selectors.push(selector);
            return [input];
          },
        },
        FakeDataTransfer,
        blockedFetch,
      );

      expect(result).toBe(true);
      expect(selectors).toEqual(['input[data-testid="fileInput"]']);
      expect(added).toHaveLength(1);
      expect(added[0].name).toBe("banner.png");
      expect(added[0].type).toBe("image/png");
      // "YmFubmVy" is "banner" in base64
      expect(await added[0].text()).toBe("banner");
      expect(input.files).toBe(added);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("change");
    });

    it("should report a banner it could not set rather than claiming success", async () => {
      vi.spyOn(vm.getWebview()!, "executeJavaScript").mockResolvedValue(false);

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSetBanner,
        {},
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should do nothing when there is no banner to set", async () => {
      vm.account.xAccount!.tombstoneBannerDataURL = "";

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(result).toBe(true);
      expect(vm.getWebview()?.executeJavaScript).not.toHaveBeenCalled();
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should report a save that never went through rather than finishing", async () => {
      // The save button stays disabled, so clicking it would do nothing
      vi.spyOn(vm.getWebview()!, "executeJavaScript").mockImplementation(
        async (code: string) => !code.includes("aria-disabled"),
      );
      vi.spyOn(vm, "sleep").mockResolvedValue(undefined);

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSave,
        { reason: "save button never became enabled" },
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });
  });

  describe("runJobTombstoneLockAccount", () => {
    it("should wait for the checkbox before reading it", async () => {
      // Reading the checkbox before X renders it threw "Script failed to
      // execute" and took the whole job down
      vi.spyOn(vm.getWebview()!, "executeJavaScript").mockResolvedValue(true);

      const result = await TombstoneJobs.runJobTombstoneLockAccount(vm, 0);

      expect(result).toBe(true);
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'input[type="checkbox"]',
        "https://x.com/settings/audience_and_tagging",
      );
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should do nothing more when the account is already locked", async () => {
      vi.spyOn(vm.getWebview()!, "executeJavaScript").mockResolvedValue(true);

      const result = await TombstoneJobs.runJobTombstoneLockAccount(vm, 0);

      expect(result).toBe(true);
      expect(vm.scriptClickElement).not.toHaveBeenCalled();
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should check the box and confirm when the account is unlocked", async () => {
      vi.spyOn(vm.getWebview()!, "executeJavaScript").mockImplementation(
        async (code: string) => code.includes("box.click()"),
      );

      const result = await TombstoneJobs.runJobTombstoneLockAccount(vm, 0);

      expect(result).toBe(true);
      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
        "https://x.com/settings/audience_and_tagging",
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="confirmationSheetConfirm"]',
      );
      expect(vm.finishJob).toHaveBeenCalledWith(0);
    });

    it("should report a checkbox it could not click", async () => {
      vi.spyOn(vm.getWebview()!, "executeJavaScript").mockResolvedValue(false);

      const result = await TombstoneJobs.runJobTombstoneLockAccount(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_tombstoneLockAccount_FailedToLock,
        { reason: "failed to click the protect your posts checkbox" },
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });
  });
});
