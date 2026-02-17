import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardCheckPremium from "./XWizardCheckPremium.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";
import i18n from "../../../i18n";

vi.mock("../../../util", () => ({
  getJobsType: vi.fn(() => "delete"),
  getPremiumTasks: vi.fn(() => null),
  clearPremiumTasks: vi.fn(),
}));

describe("XWizardCheckPremium", () => {
  let wrapper: VueWrapper;
  let mockEmitter: {
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        deleteTweets: true,
        deleteTweetsDaysOldEnabled: true,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();

    // Mock emitter
    mockEmitter = {
      on: vi.fn(),
      emit: vi.fn(),
    };
  });

  describe("rendering when not premium", () => {
    it("should show premium required message", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain(
        "The following features require a Premium account",
      );
    });

    it("should show delete tweets by days feature when enabled", async () => {
      const mockModel = createMockModel({
        xAccount: {
          deleteTweets: true,
          deleteTweetsDaysOldEnabled: true,
        },
      });

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain(
        "Delete tweets older than a set number of days",
      );
    });

    it("should show Sign In button when not authenticated", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const signInButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Sign In"));

      expect(signInButton).toBeTruthy();
    });
  });

  describe("rendering when premium", () => {
    it("should show thank you message when premium", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: true,
          userPremium: true,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Thanks for upgrading to Premium");
    });
  });

  describe("button actions", () => {
    it("should emit show-sign-in when Sign In clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const signInButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Sign In"));

      (signInButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(mockEmitter.emit).toHaveBeenCalledWith("show-sign-in");
    });

    it("should emit updateUserPremium when I've Upgraded clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: true,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const upgradeButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("I've Upgraded"));

      if (upgradeButton) {
        (upgradeButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("updateUserPremium")).toBeTruthy();
      }
    });

    it("should emit setState with WizardReview when Back clicked in delete mode", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("delete");

      const mockModel = createMockModel();

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
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
        expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardReview]);
      }
    });
  });

  describe("premium tasks display", () => {
    it("should load and display premium tasks from localStorage", async () => {
      const { getPremiumTasks, clearPremiumTasks } =
        await import("../../../util");
      vi.mocked(getPremiumTasks).mockReturnValue([
        "Delete old tweets",
        "Filter by likes",
      ]);

      const mockModel = createMockModel();

      wrapper = mount(XWizardCheckPremium, {
        props: {
          model: mockModel as XViewModel,
          userAuthenticated: false,
          userPremium: false,
        },
        global: {
          plugins: [i18n],
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(getPremiumTasks).toHaveBeenCalledWith(1);
      expect(clearPremiumTasks).toHaveBeenCalledWith(1);
    });
  });
});
