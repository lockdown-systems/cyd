import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import UpsellComponent from "./UpsellComponent.vue";
import { ref } from "vue";
import i18n from "../../i18n";

// Mock openURL
vi.mock("../../util", () => ({
  openURL: vi.fn(),
}));

// Mock CydAPIClient
const mockPing = vi.fn();
const mockGetUserPremium = vi.fn();
vi.mock("../../../../cyd-api-client", () => {
  return {
    default: class CydAPIClient {
      ping = mockPing;
      getUserPremium = mockGetUserPremium;
    },
  };
});

// Create mock event emitter
const mockEmit = vi.fn();
const mockOn = vi.fn();
const mockEmitter = {
  emit: mockEmit,
  on: mockOn,
};

// Mock electron API
const mockIpcRendererOn = vi.fn();
const mockIpcRendererRemoveAllListeners = vi.fn();
const mockElectronAPI = {
  ipcRenderer: {
    on: mockIpcRendererOn,
    removeAllListeners: mockIpcRendererRemoveAllListeners,
  },
};

describe("UpsellComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electron = mockElectronAPI;

    // Default mock responses
    mockPing.mockResolvedValue(true);
    mockGetUserPremium.mockResolvedValue({
      premium_access: false,
      has_business_subscription: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should show non-premium content when user is not premium", async () => {
    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".upsell").exists()).toBe(true);
    expect(wrapper.text()).toContain("Support");
    expect(wrapper.text()).toContain("Upgrade to Premium");
    expect(wrapper.text()).toContain("Cyd for Teams");
    expect(wrapper.text()).toContain("Donate");
  });

  it("should show premium thank you message when user has premium", async () => {
    mockGetUserPremium.mockResolvedValue({
      premium_access: true,
      has_business_subscription: false,
    });

    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".upsell").exists()).toBe(true);
    expect(wrapper.text()).toContain("Thanks for supporting");
    expect(wrapper.text()).toContain("Cyd for Teams");
    expect(wrapper.text()).not.toContain("Upgrade to Premium");
  });

  it("should show business subscription message when user has business subscription", async () => {
    mockGetUserPremium.mockResolvedValue({
      premium_access: true,
      has_business_subscription: true,
    });

    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".upsell").exists()).toBe(true);
    expect(wrapper.text()).toContain("Thanks for supporting");
    expect(wrapper.text()).not.toContain("Cyd for Teams");
  });

  it("should emit show-sign-in when premium button clicked while not authenticated", async () => {
    mockPing.mockResolvedValue(false);

    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: false }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const premiumButton = wrapper.find(".premium-card");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    premiumButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockEmit).toHaveBeenCalledWith("show-sign-in");
  });

  it("should emit show-manage-account when premium button clicked while authenticated", async () => {
    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const premiumButton = wrapper.find(".premium-card");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    premiumButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockEmit).toHaveBeenCalledWith("show-manage-account");
  });

  it("should emit show-sign-in when teams button clicked while not authenticated", async () => {
    mockPing.mockResolvedValue(false);

    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: false }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAll(".card");
    const teamsButton = buttons[1]; // Second card
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    teamsButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockEmit).toHaveBeenCalledWith("show-sign-in");
  });

  it("should emit show-manage-account-teams when teams button clicked while authenticated", async () => {
    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAll(".card");
    const teamsButton = buttons[1]; // Second card
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    teamsButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockEmit).toHaveBeenCalledWith("show-manage-account-teams");
  });

  it("should open donate URL when donate button clicked", async () => {
    const { openURL } = await import("../../util");

    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAll(".card");
    const donateButton = buttons[2]; // Third card
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    donateButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(openURL).toHaveBeenCalledWith(
      "https://opencollective.com/lockdown-systems",
    );
  });

  it("should register emitter listeners on mount", async () => {
    mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockOn).toHaveBeenCalledWith("signed-in", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("signed-out", expect.any(Function));
  });

  it("should register IPC listener on mount", async () => {
    mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockIpcRendererOn).toHaveBeenCalledWith(
      "cydOpen",
      expect.any(Function),
    );
  });

  it("should clean up IPC listeners on unmount", async () => {
    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    wrapper.unmount();

    expect(mockIpcRendererRemoveAllListeners).toHaveBeenCalledWith("cydOpen");
  });

  it("should display correct button text when not authenticated", async () => {
    mockPing.mockResolvedValue(false);

    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: false }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Sign in to start");
  });

  it("should display correct button text when authenticated", async () => {
    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Upgrade to Premium");
    expect(wrapper.text()).toContain("Start a Team");
  });

  it("should have correct CSS classes", async () => {
    const wrapper = mount(UpsellComponent, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            getUserPremium: mockGetUserPremium,
          }),
          deviceInfo: ref({ valid: true }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          },
        },
      },
    });

    // Wait for loading to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".upsell").exists()).toBe(true);
    expect(wrapper.find(".premium-card").exists()).toBe(true);
    expect(wrapper.find(".card-header").exists()).toBe(true);
    expect(wrapper.find(".card-body").exists()).toBe(true);
  });
});
