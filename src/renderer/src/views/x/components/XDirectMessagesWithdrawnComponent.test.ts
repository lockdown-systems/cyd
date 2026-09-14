import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import XDirectMessagesWithdrawnComponent from "./XDirectMessagesWithdrawnComponent.vue";
import { createI18n } from "vue-i18n";
import en from "../../../i18n/locales/en.json";

const i18n = createI18n({
  legacy: false,
  locale: "en",
  messages: { en },
});

describe("XDirectMessagesWithdrawnComponent", () => {
  it("explains that X Chat replaced direct messages", () => {
    const wrapper = mount(XDirectMessagesWithdrawnComponent, {
      global: { plugins: [i18n] },
    });

    expect(wrapper.text()).toContain("X replaced direct messages with X Chat");
  });

  it("says saved direct messages are kept and still browsable", () => {
    const wrapper = mount(XDirectMessagesWithdrawnComponent, {
      global: { plugins: [i18n] },
    });

    expect(wrapper.text()).toContain("still in your Cyd X archive");
    expect(wrapper.text()).toContain("still browse them");
  });

  it("renders as plain muted text with no form control", () => {
    const wrapper = mount(XDirectMessagesWithdrawnComponent, {
      global: { plugins: [i18n] },
    });

    expect(wrapper.find("small.text-muted").exists()).toBe(true);
    expect(wrapper.find("input").exists()).toBe(false);
  });
});
