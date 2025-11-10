import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardBuildOptionsPage from "./XWizardBuildOptionsPage.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";

vi.mock("../../../util", () => ({
  setJobsType: vi.fn(),
  getBreadcrumbIcon: vi.fn(() => "icon"),
}));

vi.mock("../../../util_x", () => ({
  xGetLastImportArchive: vi.fn().mockResolvedValue(null),
  xGetLastBuildDatabase: vi.fn().mockResolvedValue(null),
}));

// Mock child component that's complex
vi.mock("../../../components/x/XLastImportOrBuildComponent.vue", () => ({
  default: {
    name: "XLastImportOrBuildComponent",
    template: "<div></div>",
  },
}));

describe("XWizardBuildOptionsPage", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        archiveTweets: false,
        archiveTweetsHTML: false,
        archiveLikes: false,
        archiveBookmarks: false,
        archiveDMs: false,
        saveMyData: false,
        deleteMyData: false,
        archiveMyData: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock util_x functions
    mockElectronAPI();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should render build options form", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardBuildOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.text()).toContain("Build options");
      expect(wrapper.text()).toContain("Save my tweets");
      expect(wrapper.text()).toContain("Save my likes");
      expect(wrapper.text()).toContain("Save my bookmarks");
      expect(wrapper.text()).toContain("Save my direct messages");
    });

    it("should render nested HTML option under tweets", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardBuildOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.text()).toContain("Save an HTML version of each tweet");
    });

    it("should render breadcrumbs with Dashboard and Local Database", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardBuildOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const text = wrapper.text();
      expect(text).toContain("Dashboard");
      expect(text).toContain("Local Database");
      expect(text).toContain("Build Options");
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardDatabase when Back clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardBuildOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Local Database"));

      // Use native DOM click
      (backButton!.element as HTMLButtonElement).click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDatabase]);
    });

    it("should emit setState with WizardDashboard when Dashboard breadcrumb clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardBuildOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const dashboardBreadcrumb = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Dashboard"));

      // Use native DOM click
      (dashboardBreadcrumb!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDashboard]);
    });
  });
});
