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

  /**
   * The jobs read the profile back to find out whether a save landed, so a
   * test has to say what X hands back. Everything else the page is asked
   * answers true, the way a script that found its element does.
   */
  const answerWith = (banners: string[], bios: string[]) => {
    let bannerRead = 0;
    let bioRead = 0;
    vi.spyOn(vm.getWebview()!, "executeJavaScript").mockImplementation(
      async (code: string) => {
        if (code.includes("header_photo")) {
          return banners[Math.min(bannerRead++, banners.length - 1)];
        }
        if (code.includes("textarea.value")) {
          return bios[Math.min(bioRead++, bios.length - 1)];
        }
        return true;
      },
    );
  };

  afterEach(() => {
    resetElectronAPIMocks();
    vi.clearAllMocks();
  });

  describe("runJobTombstoneUpdateBanner", () => {
    it("should set the banner, apply the crop, and save", async () => {
      answerWith(
        ["https://pbs.twimg.com/old", "https://pbs.twimg.com/new"],
        [],
      );

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
        8000,
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

    it("should wait for the profile to render its banner before reading it", async () => {
      // X renders the header photo after the load finishes. Reading straight
      // away got "" from both the before and the after read, which match, so a
      // banner that had been saved was reported as one that never changed.
      answerWith(
        ["https://pbs.twimg.com/old", "https://pbs.twimg.com/new"],
        [],
      );

      await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(vm.waitForSelector).toHaveBeenCalledWith(
        'a[href$="/header_photo"] img',
        "https://x.com/testuser",
        10000,
      );
    });

    it("should read a profile that renders no banner as having none", async () => {
      // An account with no banner never grows that element, so the wait
      // running out is an answer rather than something to throw over.
      const { TimeoutError } = await import("../automation_failures");
      vi.spyOn(vm, "waitForSelector").mockImplementation(
        async (selector: string) => {
          if (selector === 'a[href$="/header_photo"] img') {
            throw new TimeoutError(selector);
          }
        },
      );

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      // Nothing was there before and nothing after, which is a real failure —
      // but reported as one, rather than thrown out of the job.
      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ reason: "the banner did not change" }),
      );
    });

    it("should wait out the old banner the profile shows before the new one", async () => {
      // Recorded on a real run: the save returns 200, then the profile page
      // fetches the banner it already had and replaces it 200ms later. Reading
      // once catches the old URL and calls a save that worked unchanged, which
      // is why this failed four times and then passed with nothing altered.
      answerWith(
        [
          "https://pbs.twimg.com/profile_banners/1/1789501624/1080x360",
          "https://pbs.twimg.com/profile_banners/1/1789501624/1080x360",
          "https://pbs.twimg.com/profile_banners/1/1789502153/1080x360",
        ],
        [],
      );

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(result).toBe(true);
      expect(vm.finishJob).toHaveBeenCalledWith(0);
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should put the banner on again when X offers no crop step", async () => {
      // Recorded from Cyd's own session: with no crop step the image still
      // uploads, INIT through FINALIZE, and update_profile_banner.json is
      // never called at all. Apply is what stages the upload as the banner,
      // so a run that never sees one saves nothing.
      const { TimeoutError } = await import("../automation_failures");
      let cropWaits = 0;
      vi.spyOn(vm, "waitForSelector").mockImplementation(
        async (selector: string) => {
          if (selector === '[data-testid="applyButton"]') {
            cropWaits += 1;
            if (cropWaits === 1) {
              throw new TimeoutError(selector);
            }
          }
        },
      );
      answerWith(
        ["https://pbs.twimg.com/old", "https://pbs.twimg.com/new"],
        [],
      );

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(cropWaits).toBeGreaterThan(1);
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        '[data-testid="applyButton"]',
      );
      expect(result).toBe(true);
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should say the banner was never staged rather than save without it", async () => {
      const { TimeoutError } = await import("../automation_failures");
      vi.spyOn(vm, "waitForSelector").mockImplementation(
        async (selector: string) => {
          if (selector === '[data-testid="applyButton"]') {
            throw new TimeoutError(selector);
          }
        },
      );
      answerWith(["https://pbs.twimg.com/old"], []);

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(result).toBe(false);
      // Clicking Save without the crop uploads the image and attaches nothing,
      // then reports a banner that did not change, which explains none of it.
      expect(vm.scriptClickElement).not.toHaveBeenCalledWith(
        'button[data-testid="Profile_Save_Button"]',
      );
      expect(vm.error).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reason: "X never offered its crop step, so the banner was not staged",
        }),
      );
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

    it("should report a banner that did not change rather than finishing", async () => {
      // The save clicked cleanly and X kept the banner it already had, which
      // is the failure this job used to report as success.
      answerWith(
        ["https://pbs.twimg.com/same", "https://pbs.twimg.com/same"],
        [],
      );

      const result = await TombstoneJobs.runJobTombstoneUpdateBanner(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_tombstoneUpdateBanner_FailedToSave,
        {
          reason: "the banner did not change",
          bannerBefore: "https://pbs.twimg.com/same",
          bannerAfter: "https://pbs.twimg.com/same",
        },
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });
  });

  describe("runJobTombstoneUpdateBio", () => {
    beforeEach(() => {
      vm.account.xAccount!.tombstoneUpdateBioText = "Gone to Bluesky";
      vm.account.xAccount!.tombstoneUpdateBioCreditCyd = false;
    });

    it("should set the bio through React's value setter, not by typing", async () => {
      answerWith([], ["Gone to Bluesky"]);

      const result = await TombstoneJobs.runJobTombstoneUpdateBio(vm, 0);

      expect(result).toBe(true);
      // Electron's keyDown and keyUp insert no text without a char event, so
      // the old typing left the textarea holding whatever X had put there
      expect(vm.getWebview()?.sendInputEvent).not.toHaveBeenCalled();
      expect(vm.getWebview()?.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining("HTMLTextAreaElement.prototype"),
      );
      expect(vm.getWebview()?.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('"Gone to Bluesky"'),
      );
      expect(vm.scriptClickElement).toHaveBeenCalledWith(
        'button[data-testid="Profile_Save_Button"]',
      );
      expect(vm.finishJob).toHaveBeenCalledWith(0);
      expect(vm.error).not.toHaveBeenCalled();
    });

    it("should save the new bio, so the wizard stops offering the old one", async () => {
      // The tombstone page pre-fills from the bio Cyd has saved, which is
      // written at login and nowhere else. Leaving it stale meant coming back
      // to the page and being offered the bio the tombstone had replaced.
      vm.account.xAccount!.bio = "Seeded test account.";
      answerWith([], ["Gone to Bluesky"]);

      const result = await TombstoneJobs.runJobTombstoneUpdateBio(vm, 0);

      expect(result).toBe(true);
      expect(vm.account.xAccount!.bio).toBe("Gone to Bluesky");
      expect(window.electron.database.saveAccount).toHaveBeenCalled();
    });

    it("should leave the saved bio alone when the change did not land", async () => {
      vm.account.xAccount!.bio = "Seeded test account.";
      answerWith([], ["Seeded test account."]);

      const result = await TombstoneJobs.runJobTombstoneUpdateBio(vm, 0);

      expect(result).toBe(false);
      expect(vm.account.xAccount!.bio).toBe("Seeded test account.");
    });

    it("should report a bio that did not change rather than finishing", async () => {
      answerWith([], ["Seeded test account."]);

      const result = await TombstoneJobs.runJobTombstoneUpdateBio(vm, 0);

      expect(result).toBe(false);
      expect(vm.error).toHaveBeenCalledWith(
        AutomationErrorType.x_runJob_tombstoneUpdateBio_FailedToSave,
        {
          reason: "the bio did not change",
          wanted: "Gone to Bluesky",
          got: "Seeded test account.",
        },
      );
      expect(vm.finishJob).not.toHaveBeenCalled();
    });

    it("should quote the bio text into the script rather than splicing it", async () => {
      // A bio can hold a quote, which the old typing never had to care about
      vm.account.xAccount!.tombstoneUpdateBioText = `I'm "gone"`;
      answerWith([], [`I'm "gone"`]);

      const result = await TombstoneJobs.runJobTombstoneUpdateBio(vm, 0);

      expect(result).toBe(true);
      expect(vm.getWebview()?.executeJavaScript).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(`I'm "gone"`)),
      );
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
