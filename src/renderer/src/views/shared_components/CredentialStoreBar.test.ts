import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

import i18n from "../../i18n";
import CredentialStoreBar from "./CredentialStoreBar.vue";
import type { CredentialProtection } from "../../../../shared_types";

const protection = (
  overrides: Partial<CredentialProtection> = {},
): CredentialProtection => ({
  backend: "basic_text",
  rawBackend: "basic_text",
  platform: "linux",
  osProtected: false,
  disclosureRequired: true,
  ...overrides,
});

const mountBar = (value: CredentialProtection | null) =>
  mount(CredentialStoreBar, {
    props: { protection: value },
    global: { plugins: [i18n] },
  });

describe("CredentialStoreBar", () => {
  it("says nothing when the OS protects credentials", () => {
    const wrapper = mountBar(
      protection({
        backend: "macos_keychain",
        platform: "darwin",
        rawBackend: null,
        osProtected: true,
        disclosureRequired: false,
      }),
    );

    expect(wrapper.find(".credential-store-bar").exists()).toBe(false);
  });

  it("says nothing before the protection is known", () => {
    const wrapper = mountBar(null);

    expect(wrapper.find(".credential-store-bar").exists()).toBe(false);
  });

  it("discloses the Linux basic_text fallback", () => {
    const wrapper = mountBar(protection());

    const bar = wrapper.find(".credential-store-bar");
    expect(bar.exists()).toBe(true);
    expect(bar.text()).toContain("not protected on this computer");
    expect(bar.text()).toContain("KWallet");
    // The exact backend is named, so the warning is checkable rather than vague.
    expect(bar.text()).toContain("basic_text");
  });

  it("discloses an unrecognized Linux backend without guessing why", () => {
    const wrapper = mountBar(
      protection({
        backend: "unknown",
        rawBackend: "something_new",
      }),
    );

    const bar = wrapper.find(".credential-store-bar");
    expect(bar.exists()).toBe(true);
    expect(bar.text()).toContain("something_new");
    expect(bar.text()).toContain("does not recognize the password store");
    // It must not claim the desktop has no keyring; Cyd does not know that.
    expect(bar.text()).not.toContain("could not find a system keyring");
  });

  it("explains when no facility could protect the credentials", () => {
    const wrapper = mountBar(
      protection({
        backend: "unavailable",
        rawBackend: null,
      }),
    );

    const bar = wrapper.find(".credential-store-bar");
    expect(bar.text()).toContain("without operating-system protection");
    // Cyd still saves the connection, so the warning must say what the risk
    // is rather than imply that nothing is stored.
    expect(bar.text()).toContain("login cookies");
    expect(bar.text()).not.toContain("will not save");
  });

  it("can be dismissed", async () => {
    const wrapper = mountBar(protection());

    // The test environment stubs MouseEvent, so dispatch the click natively
    // rather than through test-utils' synthetic event.
    (
      wrapper.find(".credential-store-bar-close").element as HTMLElement
    ).click();
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".credential-store-bar").exists()).toBe(false);
  });
});
