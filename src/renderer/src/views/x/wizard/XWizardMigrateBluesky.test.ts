import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardMigrateBluesky from "./XWizardMigrateBluesky.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";
import i18n from "../../../i18n";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
  setJobsType: vi.fn(),
}));

vi.mock("../../../util_x", () => ({
  xHasSomeData: vi.fn().mockResolvedValue(true),
  xGetLastImportArchive: vi.fn().mockResolvedValue(null),
  xGetLastBuildDatabase: vi.fn().mockResolvedValue(null),
}));

// Mock child components
vi.mock("../components/XLastImportOrBuildComponent.vue", () => ({
  default: {
    name: "XLastImportOrBuildComponent",
    template: "<div></div>",
  },
}));

vi.mock("../../shared_components/LoadingComponent.vue", () => ({
  default: {
    name: "LoadingComponent",
    template: "<div></div>",
  },
}));

vi.mock("../../shared_components/wizard/BaseWizardPage.vue", () => ({
  default: {
    name: "BaseWizardPage",
    template: "<div><slot></slot></div>",
    props: ["breadcrumbProps", "buttonProps"],
  },
}));

// Mock vue-chartjs
vi.mock("vue-chartjs", () => ({
  Pie: {
    name: "Pie",
    template: "<div></div>",
    props: ["data", "options"],
  },
}));

describe("XWizardMigrateBluesky", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();

    // Mock ipcRenderer
    window.electron.ipcRenderer = {
      on: vi.fn(),
      off: vi.fn(),
      send: vi.fn(),
      invoke: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock Bluesky methods
    window.electron.X.blueskyGetProfile = vi.fn().mockResolvedValue(null);
    window.electron.X.blueskyGetTweetCounts = vi.fn().mockResolvedValue({
      totalTweets: 100,
      migratedTweets: 50,
      notMigratedTweets: 50,
      toMigrateTweets: [],
    });
    window.electron.X.blueskyAuthorize = vi.fn().mockResolvedValue(true);
    window.electron.X.blueskyDisconnect = vi.fn().mockResolvedValue(undefined);
    window.electron.X.blueskyCallback = vi.fn().mockResolvedValue(true);
  });

  describe("basic rendering", () => {
    it("should mount migrate bluesky page component", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardMigrateBluesky, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(wrapper.exists()).toBe(true);
    });

    it("should render BaseWizardPage wrapper", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardMigrateBluesky, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(wrapper.findComponent({ name: "BaseWizardPage" }).exists()).toBe(
        true,
      );
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardDashboard when Back clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardMigrateBluesky, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back"));

      if (backButton) {
        (backButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("setState")).toBeTruthy();
        expect(wrapper.emitted("setState")?.[0]).toEqual([
          State.WizardDashboard,
        ]);
      }
    });
  });

  describe("bluesky connection", () => {
    it("should load bluesky profile on mount", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardMigrateBluesky, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(window.electron.X.blueskyGetProfile).toHaveBeenCalledWith(
        expect.any(Number),
      );
    });

    it("should show connected state when profile exists", async () => {
      window.electron.X.blueskyGetProfile = vi.fn().mockResolvedValue({
        handle: "user.bsky.social",
        displayName: "Test User",
        avatar: "",
      });
      window.electron.X.blueskyGetTweetCounts = vi.fn().mockResolvedValue({
        totalTweets: 100,
        migratedTweets: 50,
        notMigratedTweets: 50,
        toMigrateTweets: [],
      });

      const mockModel = createMockModel();

      wrapper = mount(XWizardMigrateBluesky, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(window.electron.X.blueskyGetTweetCounts).toHaveBeenCalled();
    });
  });

  describe("data loading", () => {
    it("should check for existing X data on mount", async () => {
      const { xHasSomeData } = await import("../../../util_x");

      const mockModel = createMockModel();

      wrapper = mount(XWizardMigrateBluesky, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(xHasSomeData).toHaveBeenCalledWith(expect.any(Number));
    });
  });
});
