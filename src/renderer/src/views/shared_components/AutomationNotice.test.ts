import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AutomationNotice from "./AutomationNotice.vue";

describe("AutomationNotice", () => {
  it("renders automation notice when showBrowser and showAutomationNotice are true", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: true,
        showAutomationNotice: true,
      },
    });

    const automationNotice = wrapper.find(".automation-notice");
    expect(automationNotice.exists()).toBe(true);
    expect(automationNotice.text()).toContain(
      "I'm following your instructions",
    );
    expect(automationNotice.text()).toContain(
      "Feel free to switch windows and use your computer for other things",
    );

    const readyForInput = wrapper.find(".ready-for-input");
    expect(readyForInput.exists()).toBe(false);
  });

  it("renders ready for input when showBrowser is true but showAutomationNotice is false", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: true,
        showAutomationNotice: false,
      },
    });

    const readyForInput = wrapper.find(".ready-for-input");
    expect(readyForInput.exists()).toBe(true);
    expect(readyForInput.text()).toContain("Ready for input");

    const automationNotice = wrapper.find(".automation-notice");
    expect(automationNotice.exists()).toBe(false);
  });

  it("renders nothing when showBrowser is false", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: false,
        showAutomationNotice: true,
      },
    });

    const automationNotice = wrapper.find(".automation-notice");
    expect(automationNotice.exists()).toBe(false);

    const readyForInput = wrapper.find(".ready-for-input");
    expect(readyForInput.exists()).toBe(false);
  });

  it("renders nothing when showBrowser is false and showAutomationNotice is false", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: false,
        showAutomationNotice: false,
      },
    });

    const automationNotice = wrapper.find(".automation-notice");
    expect(automationNotice.exists()).toBe(false);

    const readyForInput = wrapper.find(".ready-for-input");
    expect(readyForInput.exists()).toBe(false);
  });

  it("displays robot icon in automation notice", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: true,
        showAutomationNotice: true,
      },
    });

    const icon = wrapper.find(".fa-robot");
    expect(icon.exists()).toBe(true);
  });

  it("displays mouse icon in ready for input notice", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: true,
        showAutomationNotice: false,
      },
    });

    const icon = wrapper.find(".fa-computer-mouse");
    expect(icon.exists()).toBe(true);
  });

  it("applies correct CSS classes to automation notice", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: true,
        showAutomationNotice: true,
      },
    });

    const notice = wrapper.find(".automation-notice");
    expect(notice.classes()).toContain("text-muted");
    expect(notice.classes()).toContain("text-center");
  });

  it("applies correct CSS classes to ready for input notice", () => {
    const wrapper = mount(AutomationNotice, {
      props: {
        showBrowser: true,
        showAutomationNotice: false,
      },
    });

    const notice = wrapper.find(".ready-for-input");
    expect(notice.classes()).toContain("text-muted");
    expect(notice.classes()).toContain("text-center");
  });
});
