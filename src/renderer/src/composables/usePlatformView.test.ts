import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, defineComponent, h, nextTick, type Component } from "vue";
import { mount } from "@vue/test-utils";
import type { WebviewTag } from "electron";
import mitt from "mitt";

import { usePlatformView } from "./usePlatformView";
import CydAPIClient from "../../../cyd-api-client";
import {
  createMockAccount,
  createMockWebview,
  mockElectronAPI,
} from "../test_util";
import type { BasePlatformViewModel } from "../types/PlatformView";
import type { PlatformConfig } from "../types/PlatformConfig";

// Create a mock view model
const createMockViewModel = (): BasePlatformViewModel & {
  run: () => Promise<void>;
  init: (webview: WebviewTag) => Promise<void>;
  cleanup: () => void;
} => ({
  state: "idle",
  runJobsState: "idle",
  instructions: "Test instructions",
  showBrowser: false,
  showAutomationNotice: false,
  progress: null,
  jobs: [],
  isPaused: false,
  run: vi.fn().mockResolvedValue(undefined),
  init: vi.fn().mockResolvedValue(undefined),
  cleanup: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  resume: vi.fn(),
  reloadAccount: vi.fn().mockResolvedValue(undefined),
});

// Create a mock platform config
const createMockConfig = (): PlatformConfig => ({
  name: "TestPlatform",
  features: {
    hasArchiveOnly: true,
    hasPremiumGating: false,
    hasComplexImport: false,
    hasMigration: false,
    hasU2FSupport: false,
  },
  urls: {
    helpDocs: "https://example.com/help",
  },
  components: {
    jobStatus: { name: "MockJobStatus" } as Component,
    wizardSidebar: { name: "MockSidebar" } as Component,
    wizardPages: {},
  },
});

describe("usePlatformView", () => {
  let emitter: ReturnType<typeof mitt>;
  let apiClient: CydAPIClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();

    emitter = mitt();
    apiClient = new CydAPIClient();

    // Mock API client methods
    apiClient.ping = vi.fn().mockResolvedValue(true);
    apiClient.getUserPremium = vi
      .fn()
      .mockResolvedValue({ premium_access: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createTestComponent = (
    account = createMockAccount(),
    model = ref(createMockViewModel()),
    config = createMockConfig(),
  ) => {
    return defineComponent({
      setup() {
        const platformView = usePlatformView(account, model, config);
        return { platformView, model };
      },
      render() {
        return h("div");
      },
    });
  };

  it("should initialize with default state", () => {
    const TestComponent = createTestComponent();
    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          apiClient: ref(apiClient),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter,
          },
        },
      },
    });

    const { platformView } = wrapper.vm as {
      platformView: ReturnType<typeof usePlatformView>;
    };

    expect(platformView.currentState.value).toBe("");
    expect(platformView.progress.value).toBeNull();
    expect(platformView.currentJobs.value).toEqual([]);
    expect(platformView.isPaused.value).toBe(false);
    expect(platformView.canStateLoopRun.value).toBe(true);
    expect(platformView.clickingEnabled.value).toBe(false);
    expect(platformView.userAuthenticated.value).toBe(false);
    expect(platformView.userPremium.value).toBe(false);

    wrapper.unmount();
  });

  it("should update state when model state changes", async () => {
    const model = ref(createMockViewModel());
    const TestComponent = createTestComponent(createMockAccount(), model);

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          apiClient: ref(apiClient),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter,
          },
        },
      },
    });

    const { platformView } = wrapper.vm as {
      platformView: ReturnType<typeof usePlatformView>;
    };

    model.value.state = "running";
    await nextTick();

    expect(platformView.currentState.value).toBe("running");

    wrapper.unmount();
  });

  it("should update progress when model progress changes", async () => {
    const model = ref(createMockViewModel());
    const TestComponent = createTestComponent(createMockAccount(), model);

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          apiClient: ref(apiClient),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter,
          },
        },
      },
    });

    const { platformView } = wrapper.vm as {
      platformView: ReturnType<typeof usePlatformView>;
    };

    const progressData = { current: 50, total: 100 };
    model.value.progress = progressData;
    await nextTick();

    expect(platformView.progress.value).toEqual(progressData);

    wrapper.unmount();
  });

  it("should update jobs when model jobs change", async () => {
    const model = ref(createMockViewModel());
    const TestComponent = createTestComponent(createMockAccount(), model);

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          apiClient: ref(apiClient),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter,
          },
        },
      },
    });

    const { platformView } = wrapper.vm as {
      platformView: ReturnType<typeof usePlatformView>;
    };

    const jobs = [
      { id: 1, name: "job1" },
      { id: 2, name: "job2" },
    ];
    model.value.jobs = jobs;
    await nextTick();

    expect(platformView.currentJobs.value).toEqual(jobs);

    wrapper.unmount();
  });

  it("should update isPaused when model isPaused changes", async () => {
    const model = ref(createMockViewModel());
    const TestComponent = createTestComponent(createMockAccount(), model);

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          apiClient: ref(apiClient),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter,
          },
        },
      },
    });

    const { platformView } = wrapper.vm as {
      platformView: ReturnType<typeof usePlatformView>;
    };

    model.value.isPaused = true;
    await nextTick();

    expect(platformView.isPaused.value).toBe(true);

    wrapper.unmount();
  });

  describe("feature flags", () => {
    it("should check if platform has a specific feature", () => {
      const config = createMockConfig();
      config.features.hasArchiveOnly = true;
      config.features.hasPremiumGating = false;

      const TestComponent = createTestComponent(
        createMockAccount(),
        ref(createMockViewModel()),
        config,
      );
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      expect(platformView.hasFeature("hasArchiveOnly")).toBe(true);
      expect(platformView.hasFeature("hasPremiumGating")).toBe(false);

      wrapper.unmount();
    });

    it("should check if platform requires premium", () => {
      const config = createMockConfig();
      config.features.hasPremiumGating = true;

      const TestComponent = createTestComponent(
        createMockAccount(),
        ref(createMockViewModel()),
        config,
      );
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      expect(platformView.requiresPremium()).toBe(true);

      wrapper.unmount();
    });
  });

  describe("authentication", () => {
    it("should update user authenticated status", async () => {
      const TestComponent = createTestComponent();
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      await platformView.updateUserAuthenticated();

      expect(platformView.userAuthenticated.value).toBe(true);
      expect(apiClient.ping).toHaveBeenCalled();

      wrapper.unmount();
    });

    it("should handle unauthenticated state", async () => {
      apiClient.ping = vi.fn().mockResolvedValue(false);

      const TestComponent = createTestComponent();
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: false }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      await platformView.updateUserAuthenticated();

      expect(platformView.userAuthenticated.value).toBe(false);

      wrapper.unmount();
    });

    it("should update user premium status", async () => {
      const config = createMockConfig();
      config.features.hasPremiumGating = true;

      const TestComponent = createTestComponent(
        createMockAccount(),
        ref(createMockViewModel()),
        config,
      );
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      // First authenticate
      await platformView.updateUserAuthenticated();
      await platformView.updateUserPremium();

      expect(platformView.userPremium.value).toBe(true);
      expect(apiClient.getUserPremium).toHaveBeenCalled();

      wrapper.unmount();
    });

    it("should not check premium if not authenticated", async () => {
      apiClient.ping = vi.fn().mockResolvedValue(false);

      const TestComponent = createTestComponent();
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: false }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      await platformView.updateUserAuthenticated();
      await platformView.updateUserPremium();

      expect(apiClient.getUserPremium).not.toHaveBeenCalled();

      wrapper.unmount();
    });

    it("should handle signed-in event", async () => {
      const TestComponent = createTestComponent();
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      platformView.setupAuthListeners();

      emitter.emit("signed-in");
      await nextTick();
      // Give time for async handlers
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(platformView.userAuthenticated.value).toBe(true);

      wrapper.unmount();
    });

    it("should handle signed-out event", async () => {
      const TestComponent = createTestComponent();
      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      // First authenticate
      await platformView.updateUserAuthenticated();
      expect(platformView.userAuthenticated.value).toBe(true);

      platformView.setupAuthListeners();

      emitter.emit("signed-out");
      await nextTick();

      expect(platformView.userAuthenticated.value).toBe(false);
      expect(platformView.userPremium.value).toBe(false);

      wrapper.unmount();
    });
  });

  describe("automation control", () => {
    it("should call model pause method", () => {
      const model = ref(createMockViewModel());
      const TestComponent = createTestComponent(createMockAccount(), model);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      platformView.pause();

      expect(model.value.pause).toHaveBeenCalled();

      wrapper.unmount();
    });

    it("should call model resume method", () => {
      const model = ref(createMockViewModel());
      const TestComponent = createTestComponent(createMockAccount(), model);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      platformView.resume();

      expect(model.value.resume).toHaveBeenCalled();

      wrapper.unmount();
    });
  });

  describe("lifecycle", () => {
    it("should initialize platform view with webview", async () => {
      const model = ref(createMockViewModel());
      const TestComponent = createTestComponent(createMockAccount(), model);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      const mockWebview = createMockWebview();
      await platformView.initializePlatformView(mockWebview);

      expect(model.value.init).toHaveBeenCalledWith(mockWebview);

      wrapper.unmount();
    });

    it("should cleanup properly", async () => {
      const model = ref(createMockViewModel());
      const account = createMockAccount();
      const TestComponent = createTestComponent(account, model);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      await platformView.cleanup();

      expect(platformView.canStateLoopRun.value).toBe(false);

      wrapper.unmount();
    });

    it("should cleanup platform view", async () => {
      const model = ref(createMockViewModel());
      const account = createMockAccount();
      const TestComponent = createTestComponent(account, model);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      await platformView.platformCleanup();

      expect(platformView.canStateLoopRun.value).toBe(false);
      expect(model.value.cleanup).toHaveBeenCalled();

      wrapper.unmount();
    });
  });

  describe("computed properties", () => {
    it("should provide correct account header props", () => {
      const account = createMockAccount();
      const TestComponent = createTestComponent(account);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      expect(platformView.accountHeaderProps.value).toEqual({
        account,
        showRefreshButton: true,
      });

      wrapper.unmount();
    });

    it("should provide correct speech bubble props", () => {
      const model = ref(createMockViewModel());
      model.value.instructions = "Test message";

      const TestComponent = createTestComponent(createMockAccount(), model);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      expect(platformView.speechBubbleProps.value).toEqual({
        message: "Test message",
      });

      wrapper.unmount();
    });

    it("should provide correct automation notice props", () => {
      const model = ref(createMockViewModel());
      model.value.showBrowser = true;
      model.value.showAutomationNotice = true;

      const TestComponent = createTestComponent(createMockAccount(), model);

      const wrapper = mount(TestComponent, {
        global: {
          provide: {
            apiClient: ref(apiClient),
            deviceInfo: ref({ valid: true }),
          },
          config: {
            globalProperties: {
              emitter,
            },
          },
        },
      });

      const { platformView } = wrapper.vm as {
        platformView: ReturnType<typeof usePlatformView>;
      };

      expect(platformView.automationNoticeProps.value).toEqual({
        showBrowser: true,
        showAutomationNotice: true,
      });

      wrapper.unmount();
    });
  });
});
