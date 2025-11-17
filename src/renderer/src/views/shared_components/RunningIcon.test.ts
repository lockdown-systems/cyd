import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import RunningIcon from "./RunningIcon.vue";

describe("RunningIcon", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render an icon element", () => {
    const wrapper = mount(RunningIcon);

    const icon = wrapper.find("i");
    expect(icon.exists()).toBe(true);
  });

  it("should start with hourglass-start icon", () => {
    const wrapper = mount(RunningIcon);

    const icon = wrapper.find("i");
    expect(icon.classes()).toContain("fa-solid");
    expect(icon.classes()).toContain("fa-hourglass-start");
  });

  it("should cycle through hourglass icons", async () => {
    const wrapper = mount(RunningIcon);

    let icon = wrapper.find("i");
    expect(icon.classes()).toContain("fa-hourglass-start");

    // Advance time by 500ms
    vi.advanceTimersByTime(500);
    await wrapper.vm.$nextTick();

    icon = wrapper.find("i");
    expect(icon.classes()).toContain("fa-hourglass-half");

    // Advance time by another 500ms
    vi.advanceTimersByTime(500);
    await wrapper.vm.$nextTick();

    icon = wrapper.find("i");
    expect(icon.classes()).toContain("fa-hourglass-end");

    // Advance time by another 500ms to cycle back
    vi.advanceTimersByTime(500);
    await wrapper.vm.$nextTick();

    icon = wrapper.find("i");
    expect(icon.classes()).toContain("fa-hourglass-start");
  });

  it("should clear interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    const wrapper = mount(RunningIcon);
    wrapper.unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
