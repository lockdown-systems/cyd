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
  });
});
