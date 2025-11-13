import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardDatabasePage from "./XWizardDatabasePage.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
  openURL: vi.fn(),
}));

vi.mock("../../../util_x", () => ({
  xHasSomeData: vi.fn().mockResolvedValue(false),
  xGetLastImportArchive: vi.fn().mockResolvedValue(null),
  xGetLastBuildDatabase: vi.fn().mockResolvedValue(null),
}));

// Mock child component
vi.mock("../components/XLastImportOrBuildComponent.vue", () => ({
  default: {
    name: "XLastImportOrBuildComponent",
    template: "<div></div>",
  },
}));

describe("XWizardDatabasePage", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        tweetsCount: -1,
        likesCount: -1,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should render database page", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Build your local database");
    });

    it("should show import and build options", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Import X archive");
      expect(wrapper.text()).toContain("Build database from scratch");
    });

    it("should show breadcrumbs", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Dashboard");
      expect(wrapper.text()).toContain("Local Database");
    });
  });

  describe("recommendation logic", () => {
    it("should recommend import archive when tweetsCount >= 2000", async () => {
      const mockModel = createMockModel({
        xAccount: {
          tweetsCount: 3000,
          likesCount: 100,
        },
      });

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("(recommended)");
    });

    it("should recommend import archive when likesCount >= 2000", async () => {
      const mockModel = createMockModel({
        xAccount: {
          tweetsCount: 100,
          likesCount: 3000,
        },
      });

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("(recommended)");
    });

    it("should recommend build from scratch when counts < 2000", async () => {
      const mockModel = createMockModel({
        xAccount: {
          tweetsCount: 500,
          likesCount: 500,
        },
      });

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Build from scratch is recommended, so it should be selected by default
      const continueButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Continue"));

      expect(continueButton?.text()).toContain("Build Options");
    });

    it("should default to import archive when counts are unknown (-1)", async () => {
      const mockModel = createMockModel({
        xAccount: {
          tweetsCount: -1,
          likesCount: -1,
        },
      });

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Import archive option should exist
      expect(wrapper.text()).toContain("Import X archive");
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardImportStart when Continue clicked with import selected", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const continueButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Continue to Import Archive"));

      (continueButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardImportStart,
      ]);
    });

    it("should emit setState with WizardBuildOptions when Continue clicked with build selected", async () => {
      const mockModel = createMockModel({
        xAccount: {
          tweetsCount: 100,
          likesCount: 100,
        },
      });

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const continueButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Continue to Build Options"));

      (continueButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardBuildOptions,
      ]);
    });

    it("should emit setState with WizardDashboard when Back clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Dashboard"));

      (backButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDashboard]);
    });

    it("should emit setState with WizardDashboard when Dashboard breadcrumb clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const dashboardButton = wrapper
        .findAll("button")
        .find((btn) => btn.text() === "Dashboard");

      (dashboardButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDashboard]);
    });
  });

  describe("option selection", () => {
    it("should have import archive selected by default when unknown counts", async () => {
      const mockModel = createMockModel({
        xAccount: {
          tweetsCount: -1,
          likesCount: -1,
        },
      });

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const continueButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Continue"));

      expect(continueButton?.text()).toContain("Import Archive");
    });

    it("should have build from scratch selected when recommended", async () => {
      const mockModel = createMockModel({
        xAccount: {
          tweetsCount: 100,
          likesCount: 100,
        },
      });

      wrapper = mount(XWizardDatabasePage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const continueButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Continue"));

      expect(continueButton?.text()).toContain("Build Options");
    });
  });
});
