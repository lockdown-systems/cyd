import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { mount, VueWrapper } from "@vue/test-utils";
import BlueskyWizardConnect from "./BlueskyWizardConnect.vue";
import { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import {
  mockElectronAPI,
  createMockAccount,
  createMockBlueskyLocalAccount,
  createMockEmitter,
} from "../../../test_util";
import type { BlueskyLocalAccount } from "../../../../../shared_types";
import i18n from "../../../i18n";

const ACCOUNT_UUID = "018d5f7a-9b3c-7d10-8a2e-1f4c6b8d0e12";

function createModel(
  overrides?: Partial<BlueskyLocalAccount>,
): BlueskyViewModel {
  const account = createMockAccount({
    id: 7,
    type: "Bluesky",
    uuid: ACCOUNT_UUID,
    xAccount: null,
    blueskyLocalAccount: createMockBlueskyLocalAccount({
      uuid: ACCOUNT_UUID,
      ...overrides,
    }),
  });
  // The platform view hands the page a reactive view model, so the page can
  // re-render when connecting changes it. Tests do the same.
  return ref(new BlueskyViewModel(account, createMockEmitter()))
    .value as BlueskyViewModel;
}

const mountConnect = (model: BlueskyViewModel) =>
  mount(BlueskyWizardConnect, {
    props: { model },
    global: { plugins: [i18n] },
  });

const connectedAccount = (): Partial<BlueskyLocalAccount> => ({
  did: "did:plc:examplealice",
  handle: "alice.bsky.social",
  connectedAt: new Date(),
});

describe("BlueskyWizardConnect", () => {
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

  it("asks for a handle when nothing is connected", async () => {
    wrapper = mountConnect(createModel());
    await wrapper.vm.$nextTick();

    expect(wrapper.find("#bluesky-handle").exists()).toBe(true);
    expect(wrapper.text()).toContain("never asks for your password");
  });

  it("listens for its own account's callback only", () => {
    const model = createModel();
    wrapper = mountConnect(model);

    expect(window.electron.ipcRenderer.on).toHaveBeenCalledWith(
      "blueskyOAuthCallback-Bluesky:7",
      expect.any(Function),
    );
  });

  it("stops listening when the page goes away", () => {
    wrapper = mountConnect(createModel());

    wrapper.unmount();

    expect(window.electron.ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
      "blueskyOAuthCallback-Bluesky:7",
    );
  });

  it("sends the person to their browser to finish", async () => {
    const model = createModel();
    vi.spyOn(model, "connect").mockResolvedValue({ status: "browser" });
    wrapper = mountConnect(model);
    await wrapper.vm.$nextTick();

    await wrapper.find("#bluesky-handle").setValue("alice.bsky.social");
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(model.connect).toHaveBeenCalledWith("alice.bsky.social");
    expect(wrapper.text()).toContain("Finish connecting in your browser");
  });

  it("skips the browser when Cyd already holds the session", async () => {
    const model = createModel();
    vi.spyOn(model, "connect").mockImplementation(async () => {
      model.account.blueskyLocalAccount = createMockBlueskyLocalAccount({
        uuid: ACCOUNT_UUID,
        ...connectedAccount(),
      });
      model.profile = {
        did: "did:plc:examplealice",
        handle: "alice.bsky.social",
      };
      return { status: "reused", did: "did:plc:examplealice" };
    });
    wrapper = mountConnect(model);
    await wrapper.vm.$nextTick();

    await wrapper.find("#bluesky-handle").setValue("alice.bsky.social");
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Cyd is connected to:");
    expect(wrapper.text()).toContain("@alice.bsky.social");
  });

  it("shows a connection failure rather than a blank form", async () => {
    const model = createModel();
    vi.spyOn(model, "connect").mockImplementation(async () => {
      model.connectError = "Could not resolve handle";
      return { status: "error", error: "Could not resolve handle" };
    });
    wrapper = mountConnect(model);
    await wrapper.vm.$nextTick();

    await wrapper.find("#bluesky-handle").setValue("nobody.bsky.social");
    await wrapper.find("form").trigger("submit");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".connect-error").text()).toBe(
      "Could not resolve handle",
    );
    expect(wrapper.find("#bluesky-handle").exists()).toBe(true);
  });

  it("shows the connected identity and offers only its own disconnect", async () => {
    const model = createModel(connectedAccount());
    model.profile = {
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
    };
    vi.spyOn(model, "refreshProfile").mockResolvedValue(undefined);
    wrapper = mountConnect(model);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("@alice.bsky.social");
    // Nothing here offers to sign out an identity another account is using.
    expect(wrapper.text()).not.toMatch(/force|revoke/i);
    expect(wrapper.text()).toContain(
      "Your Bluesky account in Cyd and everything Cyd has saved for it stay exactly as they are",
    );
  });

  it("returns to the handle form after disconnecting", async () => {
    const model = createModel(connectedAccount());
    model.profile = {
      did: "did:plc:examplealice",
      handle: "alice.bsky.social",
    };
    vi.spyOn(model, "refreshProfile").mockResolvedValue(undefined);
    vi.spyOn(model, "disconnect").mockResolvedValue(undefined);
    wrapper = mountConnect(model);
    await wrapper.vm.$nextTick();

    await wrapper.find("button.btn-secondary").trigger("click");
    await wrapper.vm.$nextTick();

    expect(model.disconnect).toHaveBeenCalled();
    expect(wrapper.find("#bluesky-handle").exists()).toBe(true);
  });

  it("finishes the connection when the callback arrives", async () => {
    const model = createModel();
    vi.spyOn(model, "completeConnection").mockImplementation(async () => {
      model.account.blueskyLocalAccount = createMockBlueskyLocalAccount({
        uuid: ACCOUNT_UUID,
        ...connectedAccount(),
      });
      model.profile = {
        did: "did:plc:examplealice",
        handle: "alice.bsky.social",
      };
      return true;
    });
    wrapper = mountConnect(model);
    await wrapper.vm.$nextTick();

    const [, handler] = vi
      .mocked(window.electron.ipcRenderer.on)
      .mock.calls.find(
        ([eventName]) => eventName === "blueskyOAuthCallback-Bluesky:7",
      )!;
    await (handler as (e: unknown, q: string) => Promise<void>)(
      {},
      "code=abc&state=s",
    );
    await wrapper.vm.$nextTick();

    expect(model.completeConnection).toHaveBeenCalledWith("code=abc&state=s");
    expect(wrapper.text()).toContain("Cyd is connected to:");
  });
});
