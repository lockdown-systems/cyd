import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardImportPage from "./XWizardImportPage.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
  openURL: vi.fn(),
}));

// Mock child component
vi.mock("../components/XLastImportOrBuildComponent.vue", () => ({
  default: {
    name: "XLastImportOrBuildComponent",
    template: "<div></div>",
  },
}));

describe("XWizardImportPage", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        archiveTweets: true,
        archiveLikes: false,
        archiveDMs: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should render import page", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.text()).toContain("Import your X archive");
    });

    it("should show archive download instructions", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.text()).toContain("Request archive");
      expect(wrapper.text()).toContain("Be patient");
      expect(wrapper.text()).toContain("download the ZIP file");
    });

    it("should show link to X download page", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.text()).toContain(
        "https://x.com/settings/download_your_data",
      );
    });

    it("should show breadcrumbs", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.text()).toContain("Dashboard");
      expect(wrapper.text()).toContain("Local Database");
      expect(wrapper.text()).toContain("Import X Archive");
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardImporting when import button clicked", async () => {
      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const importButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("I've Downloaded My Archive"));

      (importButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardImporting]);
    });

    it("should emit setState with WizardDatabase when Back clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Local Database"));

      (backButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDatabase]);
    });

    it("should emit setState with WizardDashboard when Dashboard breadcrumb clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const dashboardButton = wrapper
        .findAll("button")
        .find((btn) => btn.text() === "Dashboard");

      (dashboardButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDashboard]);
    });

    it("should emit setState with WizardDatabase when Local Database breadcrumb clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const databaseButton = wrapper
        .findAll("button")
        .find((btn) => btn.text() === "Local Database");

      (databaseButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDatabase]);
    });
  });

  describe("button enabled/disabled state", () => {
    it("should disable import button when no archive options selected", async () => {
      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: false,
          archiveLikes: false,
          archiveDMs: false,
        },
      });

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const importButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("I've Downloaded My Archive"));

      expect((importButton!.element as HTMLButtonElement).disabled).toBe(true);
    });

    it("should enable import button when archiveTweets is selected", async () => {
      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
          archiveLikes: false,
          archiveDMs: false,
        },
      });

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const importButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("I've Downloaded My Archive"));

      expect((importButton!.element as HTMLButtonElement).disabled).toBe(false);
    });

    it("should enable import button when archiveLikes is selected", async () => {
      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: false,
          archiveLikes: true,
          archiveDMs: false,
        },
      });

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const importButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("I've Downloaded My Archive"));

      expect((importButton!.element as HTMLButtonElement).disabled).toBe(false);
    });

    it("should enable import button when archiveDMs is selected", async () => {
      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: false,
          archiveLikes: false,
          archiveDMs: true,
        },
      });

      wrapper = mount(XWizardImportPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      const importButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("I've Downloaded My Archive"));

      expect((importButton!.element as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
