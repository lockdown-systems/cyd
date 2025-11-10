import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardArchiveOptionsPage from "./XWizardArchiveOptionsPage.vue";
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

// Mock child component
vi.mock("../../../components/x/XLastImportOrBuildComponent.vue", () => ({
  default: {
    name: "XLastImportOrBuildComponent",
    template: "<div></div>",
  },
}));

describe("XWizardArchiveOptionsPage", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        archiveTweetsHTML: false,
        archiveBookmarks: false,
        archiveDMs: false,
        saveMyData: false,
        deleteMyData: false,
        archiveMyData: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();

    // Mock X-specific methods
    (
      global.window.electron as {
        X: {
          getDatabaseStats: unknown;
          deleteTweetsCountNotArchived: unknown;
        };
      }
    ).X = {
      getDatabaseStats: vi.fn().mockResolvedValue({
        tweetsSaved: 100,
        likesSaved: 50,
        bookmarksSaved: 25,
        dmsSaved: 10,
      }),
      deleteTweetsCountNotArchived: vi.fn().mockResolvedValue(5),
    };
  });

  describe("basic rendering", () => {
    it("should render archive options form", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardArchiveOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.text()).toContain("Archive options");
      expect(wrapper.text()).toContain("Save an HTML version of each tweet");
      expect(wrapper.text()).toContain("Save my bookmarks");
      expect(wrapper.text()).toContain("Save my direct messages");
    });

    it("should render breadcrumbs with Dashboard and Local Database", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardArchiveOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const text = wrapper.text();
      expect(text).toContain("Dashboard");
      expect(text).toContain("Local Database");
      expect(text).toContain("Archive Options");
    });

    it("should have Continue button disabled when no options selected", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardArchiveOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const continueButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Continue to Review"));

      expect(continueButton).toBeTruthy();
      expect((continueButton!.element as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardDatabase when Back clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardArchiveOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Local Database"));

      (backButton!.element as HTMLButtonElement).click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDatabase]);
    });

    it("should emit setState with WizardDashboard when Dashboard breadcrumb clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardArchiveOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const dashboardBreadcrumb = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Dashboard"));

      (dashboardBreadcrumb!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDashboard]);
    });
  });

  describe("data loading", () => {
    it("should call getDatabaseStats on mount", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardArchiveOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.electron.X.getDatabaseStats).toHaveBeenCalledWith(1);
    });

    it("should call deleteTweetsCountNotArchived on mount", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardArchiveOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(
        window.electron.X.deleteTweetsCountNotArchived,
      ).toHaveBeenCalledWith(1, true);
    });
  });
});
