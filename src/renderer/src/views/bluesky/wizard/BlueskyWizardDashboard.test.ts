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

  it("offers connecting, saving, and browsing", () => {
    wrapper = mountDashboard();

    const titles = wrapper
      .findAll(".dashboard .card")
      .map((card) => card.find("h2").text());
    expect(titles).toEqual([
      "Connect to Bluesky",
      "Save My Data",
      "Browse My Data",
    ]);
  });

  it("saving waits for a connection, because it reads from Bluesky", () => {
    wrapper = mountDashboard();

    const saveCard = wrapper.findAll(".dashboard .card")[1];
    expect(saveCard.classes()).toContain("disabled-card");
    expect(saveCard.attributes("aria-disabled")).toBe("true");
    expect(saveCard.text()).toContain("Connect your Bluesky account first");
  });

  it("saving opens once the account holds an authorization", async () => {
    wrapper = mountDashboard({
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
      connectedAt: new Date(),
    });

    const saveCard = wrapper.findAll(".dashboard .card")[1];
    expect(saveCard.classes()).not.toContain("disabled-card");

    (saveCard.element as HTMLElement).click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("setState")).toEqual([["BlueskyWizardSave"]]);
  });

  it("browsing waits for something saved, not for a connection", async () => {
    const model = createModel();
    model.savedData = {
      categories: [
        {
          category: "posts",
          recordCount: 4,
          assetsExpected: 3,
          assetsAvailable: 2,
        },
      ],
      complete: false,
    };
    wrapper = mount(BlueskyWizardDashboard, {
      props: { model },
      global: { plugins: [i18n] },
    });

    const browseCard = wrapper.findAll(".dashboard .card")[2];
    expect(browseCard.classes()).not.toContain("disabled-card");
    expect(wrapper.find(".saved-records").text()).toContain("4 records saved");
    expect(wrapper.find(".saved-records .incomplete").text()).toContain(
      "Some media is still missing",
    );

    (browseCard.element as HTMLElement).click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("setState")).toEqual([["BlueskyWizardBrowse"]]);
  });

  it("browsing stays closed while there is nothing saved to read", () => {
    wrapper = mountDashboard();

    const browseCard = wrapper.findAll(".dashboard .card")[2];
    expect(browseCard.classes()).toContain("disabled-card");
    expect(wrapper.find(".saved-records").exists()).toBe(false);
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
