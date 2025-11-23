import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import XView from "./XView.vue";
import { mockElectronAPI, createMockAccount } from "../../test_util";
import type { Account } from "../../../../shared_types";
import { State } from "../../view_models/XViewModel";
import i18n from "../../i18n";

// Mock child components
vi.mock("../PlatformView.vue", () => ({
  default: {
    name: "PlatformView",
    template: `
      <div class="platform-view">
        <div class="account-header" @click="$emit('onRefreshClicked')"></div>
        <div class="webview-component" ref="webviewComponent"></div>
        <slot name="progress-extra"></slot>
        <slot name="wizard-content-extra"></slot>
      </div>
    `,
    props: [
      "account",
      "config",
      "model",
      "currentState",
      "progress",
      "currentJobs",
      "isPaused",
      "clickingEnabled",
      "userAuthenticated",
      "userPremium",
      "accountHeaderProps",
      "speechBubbleProps",
      "automationNoticeProps",
      "webviewProps",
      "displayContentProps",
      "wizardPageProps",
    ],
    emits: [
      "onRefreshClicked",
      "onRemoveClicked",
      "setState",
      "updateAccount",
      "startJobs",
      "startJobsJustSave",
      "finishedRunAgainClicked",
      "updateUserPremium",
      "archiveOnlyClicked",
      "onPause",
      "onResume",
      "onCancel",
      "onReportBug",
      "onClickingEnabled",
      "onClickingDisabled",
      "setDebugAutopauseEndOfStep",
    ],
  },
}));

vi.mock("./components/XProgressComponent.vue", () => ({
  default: {
    name: "XProgressComponent",
    template: "<div>XProgressComponent</div>",
    props: ["progress", "rateLimitInfo", "accountID"],
  },
}));

// Mock composables
const mockSetupAuthListeners = vi.fn();
const mockSetupPlatformEventHandlers = vi.fn();
const mockCreateAutomationHandlers = vi.fn(() => ({}));
const mockCleanup = vi.fn();
const mockSetupProviders = vi.fn();
const mockInitializePlatformView = vi.fn();
const mockUpdateAccount = vi.fn();
const mockUpdateUserAuthenticated = vi.fn();
const mockUpdateUserPremium = vi.fn();
const mockSetState = vi.fn();
const mockStartStateLoop = vi.fn();

vi.mock("../../composables/usePlatformView", () => ({
  usePlatformView: vi.fn(() => ({
    config: {
      components: { wizardPages: {}, jobStatus: {} },
      features: { hasU2FSupport: true, hasArchiveOnly: true },
      urls: { u2fDocs: "https://docs.example.com/u2f" },
    },
    currentState: { value: State.WizardStart },
    progress: { value: null },
    currentJobs: { value: [] },
    isPaused: { value: false },
    canStateLoopRun: { value: true },
    clickingEnabled: { value: false },
    userAuthenticated: { value: false },
    userPremium: { value: false },
    accountHeaderProps: { value: {} },
    speechBubbleProps: { value: {} },
    automationNoticeProps: { value: {} },
    webviewProps: { value: {} },
    updateAccount: mockUpdateAccount,
    updateUserAuthenticated: mockUpdateUserAuthenticated,
    updateUserPremium: mockUpdateUserPremium,
    setState: mockSetState,
    startStateLoop: mockStartStateLoop,
    setupAuthListeners: mockSetupAuthListeners,
    setupPlatformEventHandlers: mockSetupPlatformEventHandlers,
    createAutomationHandlers: mockCreateAutomationHandlers,
    cleanup: mockCleanup,
    setupProviders: mockSetupProviders,
    initializePlatformView: mockInitializePlatformView,
  })),
}));

// Mock util functions
vi.mock("../../util", () => ({
  setAccountRunning: vi.fn(),
  showQuestionOpenModePremiumFeature: vi.fn().mockResolvedValue(true),
  setPremiumTasks: vi.fn(),
  getJobsType: vi.fn().mockReturnValue("archive"),
  formatError: vi.fn((e) => e.message),
}));

vi.mock("../../util_x", () => ({
  xRequiresPremium: vi.fn().mockResolvedValue(false),
  xPostProgress: vi.fn(),
}));

vi.mock("../../config/platforms", () => ({
  getPlatformConfig: vi.fn(() => ({
    components: {
      wizardPages: {},
      jobStatus: { name: "XJobStatus", template: "<div>Job Status</div>" },
    },
    features: {
      hasU2FSupport: true,
      hasArchiveOnly: true,
    },
    urls: {
      u2fDocs: "https://docs.example.com/u2f",
    },
  })),
}));

// Mock XViewModel
vi.mock("../../view_models/XViewModel", async () => {
  const actual = await vi.importActual("../../view_models/XViewModel");

  class MockXViewModel {
    state = State.WizardStart;
    account: Account | null = null;
    webview = null;
    rateLimitInfo = null;
    debugAutopauseEndOfStep = false;
    cancelWaitForURL = false;
    pause = vi.fn();
    resume = vi.fn();
    error = vi.fn();
    cleanup = vi.fn();
    defineJobs = vi.fn();
    saveState = vi.fn(() => ({
      state: State.WizardStart,
      progress: null,
      jobs: [],
    }));
    restoreState = vi.fn();
    showErrorModal = vi.fn();

    constructor(account: Account, _emitter: unknown) {
      this.account = account;
    }
  }

  return {
    ...(actual as object),
    XViewModel: MockXViewModel,
  };
});

describe("XView", () => {
  let wrapper: VueWrapper;
  let mockAccount: Account;
  let mockApiClient: { value: { postProgress: ReturnType<typeof vi.fn> } };
  let mockDeviceInfo: {
    value: { deviceId: string; platform: string } | null;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();

    // Mock X-specific electron APIs
    window.electron.X = {
      getConfig: vi.fn().mockResolvedValue("false"),
      getMediaPath: vi.fn().mockResolvedValue("/mock/media/path"),
    } as unknown as typeof window.electron.X;

    mockAccount = createMockAccount({ type: "X" }) as Account;

    mockApiClient = {
      value: {
        postProgress: vi.fn(),
      },
    };

    mockDeviceInfo = {
      value: {
        deviceId: "test-device",
        platform: "darwin",
      },
    };
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("component initialization", () => {
    it("should render PlatformView", () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
          stubs: {
            PlatformView: false,
          },
        },
      });

      expect(wrapper.findComponent({ name: "PlatformView" }).exists()).toBe(
        true,
      );
    });

    it("should load media path on mount", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      await nextTick();

      expect(window.electron.X.getMediaPath).toHaveBeenCalledWith(
        mockAccount.id,
      );
    });

    it("should setup auth listeners on mount", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      await nextTick();

      expect(mockSetupAuthListeners).toHaveBeenCalled();
    });
  });

  describe("event forwarding", () => {
    it("should forward onRefreshClicked event", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      await platformView.vm.$emit("onRefreshClicked");

      expect(wrapper.emitted("onRefreshClicked")).toBeTruthy();
    });

    it("should forward onRemoveClicked event", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      await platformView.vm.$emit("onRemoveClicked");

      expect(wrapper.emitted("onRemoveClicked")).toBeTruthy();
    });

    it("should call setState when setState event emitted", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      await platformView.vm.$emit("setState", State.WizardDashboard);

      expect(mockSetState).toHaveBeenCalledWith(State.WizardDashboard);
    });

    it("should call updateAccount when updateAccount event emitted", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      await platformView.vm.$emit("updateAccount");

      expect(mockUpdateAccount).toHaveBeenCalled();
    });
  });

  describe("X-specific props passing", () => {
    it("should pass X-specific config to PlatformView", () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      expect(platformView.props("config")).toBeDefined();
      expect(platformView.props("config").features.hasU2FSupport).toBe(true);
      expect(platformView.props("config").features.hasArchiveOnly).toBe(true);
    });

    it("should pass model to PlatformView", () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      expect(platformView.props("model")).toBeDefined();
      expect(platformView.props("model").state).toBe(State.WizardStart);
    });

    it("should pass displayContentProps with mediaPath", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      await nextTick();
      await nextTick(); // Wait for media path to load

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      expect(platformView.props("displayContentProps")).toBeDefined();
      expect(platformView.props("displayContentProps").mediaPath).toBe(
        "/mock/media/path",
      );
    });

    it("should pass wizardPageProps with failure states", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      expect(platformView.props("wizardPageProps")).toBeDefined();
      expect(
        platformView.props("wizardPageProps")
          .failureStateIndexTweets_FailedToRetryAfterRateLimit,
      ).toBe(false);
      expect(
        platformView.props("wizardPageProps")
          .failureStateIndexLikes_FailedToRetryAfterRateLimit,
      ).toBe(false);
    });
  });

  describe("X-specific template slots", () => {
    it("should not render XProgressComponent when no progress", () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      expect(
        wrapper.findComponent({ name: "XProgressComponent" }).exists(),
      ).toBe(false);
    });
  });

  describe("pause and resume", () => {
    it("should call model.pause when onPause event emitted", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      const modelInstance = (
        wrapper.vm as unknown as { model: { pause: ReturnType<typeof vi.fn> } }
      ).model;

      await platformView.vm.$emit("onPause");

      expect(modelInstance.pause).toHaveBeenCalled();
    });

    it("should call model.resume when onResume event emitted", async () => {
      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      const platformView = wrapper.findComponent({ name: "PlatformView" });
      const modelInstance = (
        wrapper.vm as unknown as {
          model: { resume: ReturnType<typeof vi.fn> };
        }
      ).model;

      await platformView.vm.$emit("onResume");

      expect(modelInstance.resume).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should cleanup on unmount", async () => {
      const setAccountRunningModule = await import("../../util");

      wrapper = mount(XView, {
        props: { account: mockAccount },
        global: {
          plugins: [i18n],
          provide: {
            apiClient: mockApiClient,
            deviceInfo: mockDeviceInfo,
          },
        },
      });

      wrapper.unmount();
      await nextTick();

      expect(mockCleanup).toHaveBeenCalled();
      expect(setAccountRunningModule.setAccountRunning).toHaveBeenCalledWith(
        mockAccount.id,
        false,
      );
    });
  });
});
