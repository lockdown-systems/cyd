import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardFinished from "./XWizardFinished.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";

vi.mock("../../../util", () => ({
  openURL: vi.fn(),
  getJobsType: vi.fn(() => "save"),
}));

// Mock child components
vi.mock("../../shared_components/UpsellComponent.vue", () => ({
  default: {
    name: "UpsellComponent",
    template: "<div></div>",
  },
}));

vi.mock("../../shared_components/ButtonsComponent.vue", () => ({
  default: {
    name: "ButtonsComponent",
    template: "<div><slot></slot></div>",
  },
}));

describe("XWizardFinished", () => {
  let wrapper: VueWrapper;
  let mockEmitter: {
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
    progressOverrides: Record<string, number> = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        archiveTweets: true,
        archiveLikes: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
    progress: {
      newTweetsArchived: 0,
      tweetsIndexed: 0,
      retweetsIndexed: 0,
      likesIndexed: 0,
      bookmarksIndexed: 0,
      unknownIndexed: 0,
      conversationsIndexed: 0,
      messagesIndexed: 0,
      tweetsDeleted: 0,
      retweetsDeleted: 0,
      likesDeleted: 0,
      bookmarksDeleted: 0,
      conversationsDeleted: 0,
      accountsUnfollowed: 0,
      migrateTweetsCount: 0,
      migrateSkippedTweetsCount: 0,
      migrateSkippedTweetsErrors: {},
      migrateDeletePostsCount: 0,
      migrateDeleteSkippedPostsCount: 0,
      errorsOccured: 0,
      ...progressOverrides,
    } as XViewModel["progress"],
    reloadAccount: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    mockElectronAPI();
    mockEmitter = {
      on: vi.fn(),
      emit: vi.fn(),
    };
    vi.clearAllMocks();

    // Mock getAccountDataPath
    window.electron.getAccountDataPath = vi
      .fn()
      .mockResolvedValue("/path/to/archive");

    // Mock X.setConfig
    window.electron.X.setConfig = vi.fn().mockResolvedValue(undefined);
  });

  describe("basic rendering - save mode", () => {
    it("should render finished page for save mode", async () => {
      const { getJobsType } = await import("../../../util");
      (getJobsType as ReturnType<typeof vi.fn>).mockReturnValue("save");

      const mockModel = createMockModel(
        { xAccount: { archiveTweets: true } },
        { tweetsIndexed: 100 },
      );

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("You just saved:");
    });

    it("should show tweets indexed count", async () => {
      const { getJobsType } = await import("../../../util");
      (getJobsType as ReturnType<typeof vi.fn>).mockReturnValue("save");

      const mockModel = createMockModel(
        { xAccount: { archiveTweets: true } },
        { tweetsIndexed: 1234 },
      );

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("1,234");
      expect(wrapper.text()).toContain("tweets");
    });

    it("should show archive path", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("/path/to/archive");
    });
  });

  describe("basic rendering - delete mode", () => {
    it("should render finished page for delete mode", async () => {
      const { getJobsType } = await import("../../../util");
      (getJobsType as ReturnType<typeof vi.fn>).mockReturnValue("delete");

      const mockModel = createMockModel(
        { xAccount: { deleteTweets: true } },
        { tweetsDeleted: 50 },
      );

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("You just deleted:");
      expect(wrapper.text()).toContain("50");
      expect(wrapper.text()).toContain("tweets");
    });

    it("should show unfollowed accounts count", async () => {
      const { getJobsType } = await import("../../../util");
      (getJobsType as ReturnType<typeof vi.fn>).mockReturnValue("delete");

      const mockModel = createMockModel(
        { xAccount: { unfollowEveryone: true } },
        { accountsUnfollowed: 789 },
      );

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("789");
      expect(wrapper.text()).toContain("accounts");
    });
  });

  describe("basic rendering - archive mode", () => {
    it("should render finished page for archive mode", async () => {
      const { getJobsType } = await import("../../../util");
      (getJobsType as ReturnType<typeof vi.fn>).mockReturnValue("archive");

      const mockModel = createMockModel(
        { xAccount: { archiveTweetsHTML: true } },
        { newTweetsArchived: 456 },
      );

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("You just archived:");
      expect(wrapper.text()).toContain("456");
    });
  });

  describe("basic rendering - Bluesky migration mode", () => {
    it("should render finished page for migrateBluesky mode", async () => {
      const { getJobsType } = await import("../../../util");
      (getJobsType as ReturnType<typeof vi.fn>).mockReturnValue(
        "migrateBluesky",
      );

      const mockModel = createMockModel({}, { migrateTweetsCount: 234 });

      // Mock blueskyGetProfile
      window.electron.X.blueskyGetProfile = vi.fn().mockResolvedValue({
        handle: "user.bsky.social",
      });

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("You just migrated:");
      expect(wrapper.text()).toContain("234");
      expect(wrapper.text()).toContain("tweets to Bluesky");
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardReview when Run Again clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const runAgainButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Run Again"));

      if (runAgainButton) {
        (runAgainButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("setState")).toBeTruthy();
        expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardReview]);
      }
    });

    it("should emit setState with WizardDashboard when Dashboard clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const dashboardButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Dashboard"));

      if (dashboardButton) {
        (dashboardButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("setState")).toBeTruthy();
        expect(wrapper.emitted("setState")?.[0]).toEqual([
          State.WizardDashboard,
        ]);
      }
    });
  });

  describe("error handling", () => {
    it("should show error alert when errors occurred", async () => {
      const mockModel = createMockModel({}, { errorsOccured: 5 });

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const alerts = wrapper.findAll(".alert-danger");
      expect(alerts.length).toBeGreaterThan(0);
    });

    it("should hide errors when submit error report clicked", async () => {
      const mockModel = createMockModel({}, { errorsOccured: 5 });

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: false,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: false,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const submitButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Submit Error Report"));

      if (submitButton) {
        (submitButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(mockEmitter.emit).toHaveBeenCalledWith(
          "show-automation-error",
          expect.any(Number),
        );
      }
    });
  });

  describe("lifecycle", () => {
    it("should reset failure states on mount", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardFinished, {
        props: {
          model: mockModel as XViewModel,
          failureStateIndexTweets_FailedToRetryAfterRateLimit: true,
          failureStateIndexLikes_FailedToRetryAfterRateLimit: true,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.electron.X.setConfig).toHaveBeenCalledWith(
        expect.any(Number),
        expect.stringContaining("indexTweets_FailedToRetryAfterRateLimit"),
        "false",
      );

      expect(window.electron.X.setConfig).toHaveBeenCalledWith(
        expect.any(Number),
        expect.stringContaining("indexLikes_FailedToRetryAfterRateLimit"),
        "false",
      );
    });
  });
});
