import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper, flushPromises } from "@vue/test-utils";
import BlueskyView from "./BlueskyView.vue";
import {
  mockElectronAPI,
  createMockAccount,
  createMockBlueskyLocalAccount,
  createMockApiClient,
  createMockDeviceInfo,
  createMockEmitter,
} from "../../test_util";
import type { Account, BlueskyLocalAccount } from "../../../../shared_types";
import { PlatformStates } from "../../types/PlatformStates";
import i18n from "../../i18n";
import { ref } from "vue";

// Mock util functions that reach into the settings database
vi.mock("../../util", () => ({
  setAccountRunning: vi.fn(),
  getAccountIcon: vi.fn(() => "fa-brands fa-bluesky"),
  openURL: vi.fn(),
  logObj: vi.fn((obj) => obj),
}));

function createBlueskyAccount(
  overrides?: Partial<BlueskyLocalAccount>,
): Account {
  return createMockAccount({
    id: 7,
    type: "Bluesky",
    uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
    xAccount: null,
    blueskyLocalAccount: createMockBlueskyLocalAccount({
      uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
      ...overrides,
    }),
  });
}

function mountBlueskyView(account: Account) {
  const emitter = createMockEmitter();
  return mount(BlueskyView, {
    props: { account },
    global: {
      plugins: [i18n],
      provide: {
        apiClient: ref(createMockApiClient()),
        deviceInfo: ref(createMockDeviceInfo()),
      },
      config: {
        globalProperties: { emitter },
      },
    },
  });
}

describe("BlueskyView", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it("opens the account's private local storage through the Bluesky controller", async () => {
    wrapper = mountBlueskyView(createBlueskyAccount());
    await flushPromises();

    expect(window.electron.Bluesky.openLocalAccount).toHaveBeenCalledWith(7);
    expect(window.electron.Bluesky.clearStagingAreas).toHaveBeenCalledWith(7);
  });

  it("lands on the dashboard without asking for authorization", async () => {
    wrapper = mountBlueskyView(createBlueskyAccount());
    await flushPromises();

    const platformView = wrapper.findComponent({ name: "PlatformView" });
    expect(platformView.props("currentState")).toBe(
      PlatformStates.BlueskyWizardDashboardDisplay,
    );
    expect(wrapper.find(".bluesky-dashboard").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("log in");
  });

  it("presents the profile that local storage captured", async () => {
    vi.mocked(window.electron.Bluesky.openLocalAccount).mockResolvedValue(
      createMockBlueskyLocalAccount({
        uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
        did: "did:plc:examplealice",
        handle: "alice.bsky.social",
        displayName: "Alice",
      }),
    );

    wrapper = mountBlueskyView(createBlueskyAccount());
    await flushPromises();

    expect(wrapper.find(".account-header").text()).toContain(
      "@alice.bsky.social",
    );
  });

  it("names the platform in the header until an identity is connected", async () => {
    wrapper = mountBlueskyView(createBlueskyAccount());
    await flushPromises();

    expect(wrapper.find(".account-header").text()).toContain("Bluesky");
  });

  it("creates no webview, because Bluesky is never automated in a browser", async () => {
    wrapper = mountBlueskyView(createBlueskyAccount());
    await flushPromises();

    expect(wrapper.find("webview").exists()).toBe(false);
  });

  it("offers account removal", async () => {
    wrapper = mountBlueskyView(createBlueskyAccount());
    await flushPromises();

    const removeButton = wrapper.find(".account-header .remove-btn");
    expect(removeButton.exists()).toBe(true);
    (removeButton.element as HTMLElement).click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("onRemoveClicked")).toHaveLength(1);
  });
});
