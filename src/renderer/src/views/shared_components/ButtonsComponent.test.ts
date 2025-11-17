import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ButtonsComponent from "./ButtonsComponent.vue";
import type { ButtonInfo } from "../../types";

describe("ButtonsComponent", () => {
  it("renders no buttons when both arrays are empty", () => {
    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons: [],
        nextButtons: [],
      },
    });

    expect(wrapper.findAll("button")).toHaveLength(0);
  });

  it("renders back buttons with correct styling and icon", () => {
    const backButtons: ButtonInfo[] = [
      { label: "Go Back", action: vi.fn() },
      { label: "Cancel", action: vi.fn() },
    ];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons,
        nextButtons: [],
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);

    expect(buttons[0].text()).toContain("Go Back");
    expect(buttons[0].classes()).toContain("btn-secondary");
    expect(buttons[0].find(".fa-backward").exists()).toBe(true);

    expect(buttons[1].text()).toContain("Cancel");
    expect(buttons[1].classes()).toContain("btn-secondary");
    expect(buttons[1].find(".fa-backward").exists()).toBe(true);
  });

  it("renders next buttons with correct styling and icon", () => {
    const nextButtons: ButtonInfo[] = [
      { label: "Continue", action: vi.fn() },
      { label: "Finish", action: vi.fn() },
    ];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons: [],
        nextButtons,
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);

    expect(buttons[0].text()).toContain("Continue");
    expect(buttons[0].classes()).toContain("btn-primary");
    expect(buttons[0].find(".fa-forward").exists()).toBe(true);

    expect(buttons[1].text()).toContain("Finish");
    expect(buttons[1].classes()).toContain("btn-primary");
    expect(buttons[1].find(".fa-forward").exists()).toBe(true);
  });

  it("renders both back and next buttons together", () => {
    const backButtons: ButtonInfo[] = [{ label: "Back", action: vi.fn() }];
    const nextButtons: ButtonInfo[] = [{ label: "Next", action: vi.fn() }];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons,
        nextButtons,
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(2);

    expect(buttons[0].text()).toContain("Back");
    expect(buttons[0].classes()).toContain("btn-secondary");

    expect(buttons[1].text()).toContain("Next");
    expect(buttons[1].classes()).toContain("btn-primary");
  });

  it("applies danger style to next button when dangerStyle is true", () => {
    const nextButtons: ButtonInfo[] = [
      { label: "Delete", action: vi.fn(), dangerStyle: true },
    ];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons: [],
        nextButtons,
      },
    });

    const button = wrapper.find("button");
    expect(button.classes()).toContain("btn-danger");
    expect(button.classes()).not.toContain("btn-primary");
  });

  it("disables buttons when disabled property is true", () => {
    const backButtons: ButtonInfo[] = [
      { label: "Back", action: vi.fn(), disabled: true },
    ];
    const nextButtons: ButtonInfo[] = [
      { label: "Next", action: vi.fn(), disabled: true },
    ];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons,
        nextButtons,
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons[0].attributes("disabled")).toBeDefined();
    expect(buttons[1].attributes("disabled")).toBeDefined();
  });

  it("hides buttons when hide property is true", () => {
    const nextButtons: ButtonInfo[] = [
      { label: "Hidden", action: vi.fn(), hide: true },
    ];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons: [],
        nextButtons,
      },
    });

    const button = wrapper.find("button");
    expect(button.classes()).toContain("hidden");
  });

  it("calls action callback when back button is clicked", async () => {
    const action = vi.fn();
    const backButtons: ButtonInfo[] = [{ label: "Back", action }];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons,
        nextButtons: [],
      },
    });

    const button = wrapper.find("button");

    // Use createEvent for jsdom compatibility
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    button.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(action).toHaveBeenCalledOnce();
  });

  it("calls action callback when next button is clicked", async () => {
    const action = vi.fn();
    const nextButtons: ButtonInfo[] = [{ label: "Next", action }];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons: [],
        nextButtons,
      },
    });

    const button = wrapper.find("button");

    // Use createEvent for jsdom compatibility
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    button.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(action).toHaveBeenCalledOnce();
  });

  it("does not call action when disabled button is clicked", async () => {
    const action = vi.fn();
    const nextButtons: ButtonInfo[] = [
      { label: "Next", action, disabled: true },
    ];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons: [],
        nextButtons,
      },
    });

    const button = wrapper.find("button");
    await button.trigger("click");

    // Disabled buttons don't trigger click events in the DOM
    expect(action).not.toHaveBeenCalled();
  });

  it("applies text-nowrap class to all buttons", () => {
    const backButtons: ButtonInfo[] = [{ label: "Back", action: vi.fn() }];
    const nextButtons: ButtonInfo[] = [{ label: "Next", action: vi.fn() }];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons,
        nextButtons,
      },
    });

    const buttons = wrapper.findAll("button");
    buttons.forEach((button) => {
      expect(button.classes()).toContain("text-nowrap");
    });
  });

  it("renders multiple buttons of each type", () => {
    const backButtons: ButtonInfo[] = [
      { label: "Back 1", action: vi.fn() },
      { label: "Back 2", action: vi.fn() },
      { label: "Back 3", action: vi.fn() },
    ];
    const nextButtons: ButtonInfo[] = [
      { label: "Next 1", action: vi.fn() },
      { label: "Next 2", action: vi.fn() },
    ];

    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons,
        nextButtons,
      },
    });

    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(5);

    expect(buttons[0].text()).toContain("Back 1");
    expect(buttons[1].text()).toContain("Back 2");
    expect(buttons[2].text()).toContain("Back 3");
    expect(buttons[3].text()).toContain("Next 1");
    expect(buttons[4].text()).toContain("Next 2");
  });

  it("applies navigation container classes correctly", () => {
    const wrapper = mount(ButtonsComponent, {
      props: {
        backButtons: [],
        nextButtons: [],
      },
    });

    const nav = wrapper.find("nav");
    expect(nav.classes()).toContain("buttons");
    expect(nav.classes()).toContain("d-flex");
    expect(nav.classes()).toContain("align-items-center");
    expect(nav.classes()).toContain("mt-2");
    expect(nav.classes()).toContain("justify-content-end");
  });
});
