import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import BlueskyWizardDashboard from "./BlueskyWizardDashboard.vue";
import { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import {
  mockElectronAPI,
  createMockAccount,
  createMockBlueskyLocalAccount,
  createMockEmitter,
} from "../../../test_util";
import type { BlueskyLocalAccount } from "../../../../../shared_types";
import i18n from "../../../i18n";

function createModel(
  overrides?: Partial<BlueskyLocalAccount>,
): BlueskyViewModel {
  const account = createMockAccount({
    id: 7,
    type: "Bluesky",
    uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
    xAccount: null,
    blueskyLocalAccount: createMockBlueskyLocalAccount({
      uuid: "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12",
      ...overrides,
    }),
  });
  return new BlueskyViewModel(account, createMockEmitter());
}

function mountDashboard(overrides?: Partial<BlueskyLocalAccount>) {
  return mount(BlueskyWizardDashboard, {
    props: { model: createModel(overrides) },
    global: { plugins: [i18n] },
  });
}

describe("BlueskyWizardDashboard", () => {
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

  it("renders for a local account with no connection and no saved data", () => {
    wrapper = mountDashboard();

    expect(wrapper.find(".bluesky-dashboard").exists()).toBe(true);
    expect(wrapper.findAll(".dashboard .card")).toHaveLength(3);
    expect(wrapper.find(".no-identity").text()).toContain(
      "No Bluesky identity is linked to this account yet",
    );
  });

  it("does not need the network or an authorized connection to render", () => {
    wrapper = mountDashboard();

    expect(window.electron.Bluesky.openLocalAccount).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("stops saying the account has no identity once one is linked", () => {
    wrapper = mountDashboard({
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
    });

    expect(wrapper.find(".no-identity").exists()).toBe(false);
  });

  it("shows capabilities that later issues deliver as unavailable, not missing", () => {
    wrapper = mountDashboard();

    const cards = wrapper.findAll(".dashboard .card");
    const titles = cards.map((card) => card.find("h2").text());
    expect(titles).toEqual([
      "Connect to Bluesky",
      "Save My Data",
      "Browse My Data",
    ]);

    // Connecting is built; saving and browsing arrive in #676 and #677.
    expect(cards[0].classes()).not.toContain("disabled-card");
    expect(cards[0].find(".coming-soon-badge").exists()).toBe(false);
    for (const card of cards.slice(1)) {
      expect(card.classes()).toContain("disabled-card");
      expect(card.attributes("aria-disabled")).toBe("true");
      expect(card.find(".coming-soon-badge").text()).toBe("Coming soon");
    }
  });

  it("opens the connect page and nothing else", async () => {
    wrapper = mountDashboard();

    for (const card of wrapper.findAll(".dashboard .card")) {
      (card.element as HTMLElement).click();
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("setState")).toEqual([["BlueskyWizardConnect"]]);
  });

  it("says an account is linked but not connected", () => {
    wrapper = mountDashboard({
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
      connectedAt: null,
    });

    expect(wrapper.find(".not-connected").text()).toContain(
      "isn't authorized to act on this Bluesky identity",
    );
  });

  it("says nothing about connecting once the account holds an authorization", () => {
    wrapper = mountDashboard({
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
      connectedAt: new Date(),
    });

    expect(wrapper.find(".not-connected").exists()).toBe(false);
    expect(wrapper.findAll(".dashboard .card")[0].find("h2").text()).toBe(
      "Bluesky Connection",
    );
  });
});
