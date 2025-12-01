import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import AccountView from "./AccountView.vue";
import { mockElectronAPI, createMockAccount } from "../test_util";
import type { Account } from "../../../shared_types";
import i18n from "../i18n";

// Mock child components
vi.mock("./shared_components/CydAvatarComponent.vue", () => ({
  default: {
    name: "CydAvatarComponent",
    template: "<div></div>",
    props: ["height"],
  },
}));

vi.mock("./x/XView.vue", () => ({
  default: {
    name: "XView",
    template: "<div>XView</div>",
    props: ["account"],
    emits: ["onRefreshClicked", "onRemoveClicked"],
  },
}));

// Mock util functions
vi.mock("../util", () => ({
  getAccountIcon: vi.fn((type: string) => {
    if (type === "X") return "fa fa-x";
    if (type === "Bluesky") return "fa fa-bluesky";
    return "fa fa-question";
  }),
  getAccountRunning: vi.fn().mockResolvedValue(false),
  setAccountRunning: vi.fn().mockResolvedValue(undefined),
}));

describe("AccountView", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();

    // Mock feature flags
    window.electron.isFeatureEnabled = vi
      .fn()
      .mockImplementation((feature: string) => {
        if (feature === "bluesky") return Promise.resolve(false);
        return Promise.resolve(false);
      });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("unknown account type", () => {
    it("should render account selection when account type is unknown", async () => {
      const unknownAccount = createMockAccount({ type: "unknown" });

      wrapper = mount(AccountView, {
        props: {
          account: unknownAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Ready to get started?");
      expect(wrapper.text()).toContain("Add a new account");
    });

    it("should render CydAvatar for unknown account", async () => {
      const unknownAccount = createMockAccount({ type: "unknown" });

      wrapper = mount(AccountView, {
        props: {
          account: unknownAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(
        wrapper.findComponent({ name: "CydAvatarComponent" }).exists(),
      ).toBe(true);
    });

    it("should display X account selection", async () => {
      const unknownAccount = createMockAccount({ type: "unknown" });

      wrapper = mount(AccountView, {
        props: {
          account: unknownAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const xCard = wrapper.find(".select-account-x");
      expect(xCard.exists()).toBe(true);
      expect(xCard.text()).toContain("X");
      expect(xCard.text()).toContain("Formerly Twitter");
    });

    it("should emit accountSelected when X card clicked", async () => {
      const unknownAccount = createMockAccount({ type: "unknown" });

      wrapper = mount(AccountView, {
        props: {
          account: unknownAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const xCard = wrapper.find(".select-account-x");
      (xCard.element as HTMLElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("accountSelected")).toBeTruthy();
      expect(wrapper.emitted("accountSelected")?.[0]).toEqual([
        unknownAccount,
        "X",
      ]);
    });

    it("should show Bluesky option when feature flag enabled", async () => {
      window.electron.isFeatureEnabled = vi
        .fn()
        .mockImplementation((feature: string) => {
          if (feature === "bluesky") return Promise.resolve(true);
          return Promise.resolve(false);
        });

      const unknownAccount = createMockAccount({ type: "unknown" });

      wrapper = mount(AccountView, {
        props: {
          account: unknownAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const blueskyCard = wrapper.find(".select-account-bluesky");
      expect(blueskyCard.exists()).toBe(true);
      expect(blueskyCard.text()).toContain("Bluesky");
      expect(blueskyCard.text()).toContain("AT Protocol");
    });

    it("should display coming soon message", async () => {
      const unknownAccount = createMockAccount({ type: "unknown" });

      wrapper = mount(AccountView, {
        props: {
          account: unknownAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("More platforms coming soon");
    });
  });

  describe("X account type", () => {
    it("should render XView when account type is X", async () => {
      const xAccount = createMockAccount({ type: "X" });

      wrapper = mount(AccountView, {
        props: {
          account: xAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.findComponent({ name: "XView" }).exists()).toBe(true);
    });

    it("should pass account prop to XView", async () => {
      const xAccount = createMockAccount({ type: "X" });

      wrapper = mount(AccountView, {
        props: {
          account: xAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const xView = wrapper.findComponent({ name: "XView" });
      expect(xView.props("account")).toEqual(xAccount);
    });

    it("should handle refresh from XView", async () => {
      const xAccount = createMockAccount({ type: "X", id: 1 });

      wrapper = mount(AccountView, {
        props: {
          account: xAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const xView = wrapper.findComponent({ name: "XView" });
      await xView.vm.$emit("onRefreshClicked");

      // Verify setAccountRunning was called
      const { setAccountRunning } = await import("../util");
      expect(setAccountRunning).toHaveBeenCalledWith(1, false);
    });

    it("should forward onRemoveClicked from XView", async () => {
      const xAccount = createMockAccount({ type: "X" });

      wrapper = mount(AccountView, {
        props: {
          account: xAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const xView = wrapper.findComponent({ name: "XView" });
      await xView.vm.$emit("onRemoveClicked");

      expect(wrapper.emitted("onRemoveClicked")).toBeTruthy();
    });
  });

  describe("account running state", () => {
    it("should check for interrupted running account on mount", async () => {
      const { getAccountRunning } = await import("../util");
      vi.mocked(getAccountRunning).mockResolvedValue(true);

      const xAccount = createMockAccount({ type: "X", id: 1 });

      wrapper = mount(AccountView, {
        props: {
          account: xAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(getAccountRunning).toHaveBeenCalledWith(1);
      const { setAccountRunning } = await import("../util");
      expect(setAccountRunning).toHaveBeenCalledWith(1, false);
    });
  });

  describe("error states", () => {
    it("should show error message for unsupported account type", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badAccount = createMockAccount({ type: "InvalidType" as any });

      wrapper = mount(AccountView, {
        props: {
          account: badAccount as Account,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Unknown account type");
      expect(wrapper.text()).toContain("Something is wrong");
    });
  });
});
