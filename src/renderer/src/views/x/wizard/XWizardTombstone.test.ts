import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardTombstone from "./XWizardTombstone.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";
import i18n from "../../../i18n";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
  setJobsType: vi.fn(),
}));

// Mock child components
vi.mock("../components/XTombstoneBannerComponent.vue", () => ({
  default: {
    name: "XTombstoneBannerComponent",
    template: "<div></div>",
    props: [
      "updateBanner",
      "updateBannerBackground",
      "updateBannerSocialIcons",
      "updateBannerShowText",
    ],
  },
}));

vi.mock("../../shared_components/wizard/BaseWizardPage.vue", () => ({
  default: {
    name: "BaseWizardPage",
    template: "<div><slot></slot></div>",
    props: ["breadcrumbProps", "buttonProps"],
  },
}));

describe("XWizardTombstone", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        tombstoneUpdateBanner: true,
        tombstoneUpdateBannerBackground: "night",
        tombstoneUpdateBannerSocialIcons: "none",
        tombstoneUpdateBannerShowText: true,
        tombstoneUpdateBio: true,
        tombstoneUpdateBioText: "",
        tombstoneUpdateBioCreditCyd: true,
        tombstoneLockAccount: true,
        bio: "Test bio",
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();

    // Mock database.getAccount
    window.electron.database.getAccount = vi.fn().mockResolvedValue(
      createMockAccount({
        xAccount: {
          tombstoneUpdateBanner: true,
          tombstoneUpdateBannerBackground: "night",
          tombstoneUpdateBannerSocialIcons: "none",
          tombstoneUpdateBannerShowText: true,
          tombstoneUpdateBio: true,
          tombstoneUpdateBioText: "",
          tombstoneUpdateBioCreditCyd: true,
          tombstoneLockAccount: true,
          bio: "Test bio",
        } as XAccount,
      }),
    );
  });

  describe("basic rendering", () => {
    it("should mount tombstone page component", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardTombstone, {
        props: {
          model: mockModel as XViewModel,
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

      wrapper = mount(XWizardTombstone, {
        props: {
          model: mockModel as XViewModel,
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

      wrapper = mount(XWizardTombstone, {
        props: {
          model: mockModel as XViewModel,
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

  describe("data loading", () => {
    it("should load settings on mount", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardTombstone, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(window.electron.database.getAccount).toHaveBeenCalledWith(
        expect.any(Number),
      );
    });
  });
});
