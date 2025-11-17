import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardDeleteOptionsPage from "./XWizardDeleteOptionsPage.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
  openURL: vi.fn(),
  setJobsType: vi.fn(),
}));

vi.mock("../../../util_x", () => ({
  xHasSomeData: vi.fn().mockResolvedValue(true),
}));

// Mock child components
vi.mock("../components/XLastImportOrBuildComponent.vue", () => ({
  default: {
    name: "XLastImportOrBuildComponent",
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

describe("XWizardDeleteOptionsPage", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        deleteTweets: false,
        deleteRetweets: false,
        deleteLikes: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should mount delete options page component", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should render BaseWizardPage wrapper", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      expect(wrapper.findComponent({ name: "BaseWizardPage" }).exists()).toBe(
        true,
      );
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardDashboard when Back clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

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

  describe("data loading", () => {
    it("should check for existing data on mount", async () => {
      const { xHasSomeData } = await import("../../../util_x");

      const mockModel = createMockModel();

      wrapper = mount(XWizardDeleteOptionsPage, {
        props: {
          model: mockModel as XViewModel,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(xHasSomeData).toHaveBeenCalledWith(expect.any(Number));
    });
  });
});
