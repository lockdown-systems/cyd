import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import DebugModeComponent from "./DebugModeComponent.vue";
import { mockElectronAPI } from "../../test_util";

describe("DebugModeComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();
  });

  it("should not render when debug tools are disabled", async () => {
    window.electron.shouldOpenDevtools = vi.fn().mockResolvedValue(false);

    const emit = vi.fn();
    const wrapper = mount(DebugModeComponent, {
      props: {
        emit,
        debugState: "debug",
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const debugSection = wrapper.find(".p-3.small");
    expect(debugSection.exists()).toBe(false);
  });

  it("should render when debug tools are enabled", async () => {
    window.electron.shouldOpenDevtools = vi.fn().mockResolvedValue(true);

    const emit = vi.fn();
    const wrapper = mount(DebugModeComponent, {
      props: {
        emit,
        debugState: "debug",
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const debugSection = wrapper.find(".p-3.small");
    expect(debugSection.exists()).toBe(true);
  });

  it("should render debug mode button", async () => {
    window.electron.shouldOpenDevtools = vi.fn().mockResolvedValue(true);

    const emit = vi.fn();
    const wrapper = mount(DebugModeComponent, {
      props: {
        emit,
        debugState: "testDebugState",
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const button = wrapper.find("button.btn-danger");
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe("Debug Mode");
  });

  it("should emit setState when debug button clicked", async () => {
    window.electron.shouldOpenDevtools = vi.fn().mockResolvedValue(true);

    const emit = vi.fn();
    const wrapper = mount(DebugModeComponent, {
      props: {
        emit,
        debugState: "debugModeState",
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const button = wrapper.find("button.btn-danger");
    // Directly call the click handler instead of triggering event
    (button.element as HTMLButtonElement).click();
    await nextTick();

    expect(emit).toHaveBeenCalledWith("setState", "debugModeState");
  });

  it("should render autopause checkbox", async () => {
    window.electron.shouldOpenDevtools = vi.fn().mockResolvedValue(true);

    const emit = vi.fn();
    const wrapper = mount(DebugModeComponent, {
      props: {
        emit,
        debugState: "debug",
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const checkbox = wrapper.find("#debugAutopauseEndOfStep");
    expect(checkbox.exists()).toBe(true);
    expect(checkbox.attributes("type")).toBe("checkbox");

    const label = wrapper.find("label[for='debugAutopauseEndOfStep']");
    expect(label.exists()).toBe(true);
    expect(label.text()).toContain(
      "Automatically pause before finishing each step",
    );
  });

  it("should emit setDebugAutopauseEndOfStep when checkbox changed", async () => {
    window.electron.shouldOpenDevtools = vi.fn().mockResolvedValue(true);

    const emit = vi.fn();
    const wrapper = mount(DebugModeComponent, {
      props: {
        emit,
        debugState: "debug",
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const checkbox = wrapper.find("#debugAutopauseEndOfStep");
    // Set value directly
    (checkbox.element as HTMLInputElement).checked = true;
    // Trigger change event using DOM's createEvent
    const changeEvent = document.createEvent("HTMLEvents");
    changeEvent.initEvent("change", true, true);
    checkbox.element.dispatchEvent(changeEvent);
    await nextTick();

    expect(emit).toHaveBeenCalledWith("setDebugAutopauseEndOfStep", true);
  });

  it("should toggle autopause checkbox", async () => {
    window.electron.shouldOpenDevtools = vi.fn().mockResolvedValue(true);

    const emit = vi.fn();
    const wrapper = mount(DebugModeComponent, {
      props: {
        emit,
        debugState: "debug",
      },
    });

    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const checkbox = wrapper.find("#debugAutopauseEndOfStep");

    // Check it
    (checkbox.element as HTMLInputElement).checked = true;
    // Trigger change event using DOM's createEvent
    let changeEvent = document.createEvent("HTMLEvents");
    changeEvent.initEvent("change", true, true);
    checkbox.element.dispatchEvent(changeEvent);
    await nextTick();
    expect(emit).toHaveBeenCalledWith("setDebugAutopauseEndOfStep", true);

    // Uncheck it
    (checkbox.element as HTMLInputElement).checked = false;
    changeEvent = document.createEvent("HTMLEvents");
    changeEvent.initEvent("change", true, true);
    checkbox.element.dispatchEvent(changeEvent);
    await nextTick();
    expect(emit).toHaveBeenCalledWith("setDebugAutopauseEndOfStep", false);
  });
});
