import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import PlatformView from "./PlatformView.vue";
import { mockElectronAPI, createMockAccount } from "../test_util";
import { PlatformStates } from "../types/PlatformStates";
import type { Account } from "../../../shared_types";
import type { PlatformConfig } from "../types/PlatformConfig";
import type { BasePlatformViewModel } from "../types/PlatformView";
import i18n from "../i18n";

// Mock child components
vi.mock("./shared_components/AccountHeader.vue", () => ({
  default: {
    name: "AccountHeader",
    template: "<div>AccountHeader</div>",
    props: ["account", "showRefreshButton"],
    emits: ["onRefreshClicked", "onRemoveClicked"],
  },
}));

vi.mock("./shared_components/SpeechBubble.vue", () => ({
  default: {
    name: "SpeechBubble",
    template: "<div>SpeechBubble</div>",
    props: ["message"],
  },
}));

vi.mock("./shared_components/AutomationNotice.vue", () => ({
  default: {
    name: "AutomationNotice",
    template: "<div>AutomationNotice</div>",
    props: ["showBrowser", "showAutomationNotice"],
  },
}));

vi.mock("./shared_components/LoadingComponent.vue", () => ({
  default: {
    name: "LoadingComponent",
    template: "<div>Loading...</div>",
  },
}));

// Mock util
vi.mock("../util", () => ({
  openURL: vi.fn(),
}));

describe("PlatformView", () => {
  let wrapper: VueWrapper;
  let mockAccount: Account;
  let mockModel: BasePlatformViewModel;
  let mockConfig: PlatformConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();

    mockAccount = createMockAccount({ type: "X" }) as Account;

    mockModel = {
      state: PlatformStates.WizardStart,
      showBrowser: false,
    } as BasePlatformViewModel;

    mockConfig = {
      components: {
        jobStatus: {
          name: "MockJobStatus",
          template: "<div>JobStatus</div>",
        },
        wizardPages: {
          WizardStart: {
            name: "MockWizardStart",
            template: "<div>WizardStart</div>",
          },
          WizardDashboard: {
            name: "MockWizardDashboard",
            template: "<div>WizardDashboard</div>",
          },
        },
      },
      features: {
        hasU2FSupport: false,
        hasArchiveOnly: false,
      },
      urls: {
        u2fDocs: "",
      },
    } as unknown as PlatformConfig;
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("initial loading state", () => {
    it("should render LoadingComponent when state is WizardStart", () => {
      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: mockModel,
          currentState: PlatformStates.WizardStart,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: false,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Loading...",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.findComponent({ name: "LoadingComponent" }).exists()).toBe(
        true,
      );
    });

    it("should render AccountHeader", () => {
      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: mockModel,
          currentState: PlatformStates.WizardStart,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: false,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Loading...",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.findComponent({ name: "AccountHeader" }).exists()).toBe(
        true,
      );
    });
  });

  describe("active state", () => {
    it("should render SpeechBubble when not in WizardStart", () => {
      const activeModel = {
        ...mockModel,
        state: PlatformStates.WizardDashboard,
      };

      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: activeModel,
          currentState: PlatformStates.WizardDashboard,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: true,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Welcome!",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.findComponent({ name: "SpeechBubble" }).exists()).toBe(
        true,
      );
    });

    it("should not render LoadingComponent when not in WizardStart", () => {
      const activeModel = {
        ...mockModel,
        state: PlatformStates.WizardDashboard,
      };

      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: activeModel,
          currentState: PlatformStates.WizardDashboard,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: true,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Welcome!",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.findComponent({ name: "LoadingComponent" }).exists()).toBe(
        false,
      );
    });
  });

  describe("event emissions", () => {
    it("should emit onRefreshClicked from AccountHeader", async () => {
      const activeModel = {
        ...mockModel,
        state: PlatformStates.WizardDashboard,
      };

      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: activeModel,
          currentState: PlatformStates.WizardDashboard,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: true,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Welcome!",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      const accountHeader = wrapper.findComponent({ name: "AccountHeader" });
      await accountHeader.vm.$emit("onRefreshClicked");

      expect(wrapper.emitted("onRefreshClicked")).toBeTruthy();
    });

    it("should emit onRemoveClicked from AccountHeader", async () => {
      const activeModel = {
        ...mockModel,
        state: PlatformStates.WizardDashboard,
      };

      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: activeModel,
          currentState: PlatformStates.WizardDashboard,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: true,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Welcome!",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      const accountHeader = wrapper.findComponent({ name: "AccountHeader" });
      await accountHeader.vm.$emit("onRemoveClicked");

      expect(wrapper.emitted("onRemoveClicked")).toBeTruthy();
    });
  });

  describe("webview", () => {
    it("should render webview element", () => {
      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: mockModel,
          currentState: PlatformStates.WizardStart,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: false,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Loading...",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find("webview").exists()).toBe(true);
    });
  });

  describe("platform wrapper styling", () => {
    it("should apply account-specific class", () => {
      wrapper = mount(PlatformView, {
        props: {
          account: mockAccount,
          config: mockConfig,
          model: mockModel,
          currentState: PlatformStates.WizardStart,
          progress: null,
          currentJobs: [],
          isPaused: false,
          clickingEnabled: false,
          userAuthenticated: false,
          userPremium: false,
          accountHeaderProps: {
            account: mockAccount,
            showRefreshButton: true,
          },
          speechBubbleProps: {
            message: "Loading...",
          },
          automationNoticeProps: {
            showBrowser: false,
            showAutomationNotice: false,
          },
          webviewProps: {},
        },
        global: {
          plugins: [i18n],
        },
      });

      const wrapper_div = wrapper.find(".wrapper");
      expect(wrapper_div.classes()).toContain(`account-${mockAccount.id}`);
      expect(wrapper_div.classes()).toContain("d-flex");
      expect(wrapper_div.classes()).toContain("flex-column");
    });
  });
});
