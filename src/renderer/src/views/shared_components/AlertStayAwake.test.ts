import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AlertStayAwake from "./AlertStayAwake.vue";
import * as util from "../../util";
import { mockElectronAPI } from "../../test_util";

describe("AlertStayAwake", () => {
  it("renders the stay awake alert", () => {
    const wrapper = mount(AlertStayAwake);

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.text()).toContain(
      "Your computer needs to be awake to use Cyd",
    );
    expect(wrapper.text()).toContain(
      "Don't close the lid, keep it plugged in, and disable sleep while plugged in",
    );
  });

  it("displays learn more link", () => {
    const wrapper = mount(AlertStayAwake);

    const link = wrapper.find("a");
    expect(link.exists()).toBe(true);
    expect(link.text()).toBe("Learn more.");
  });

  it("calls openPreventSleepURL when learn more link is clicked", async () => {
    mockElectronAPI();
    const openPreventSleepURLSpy = vi.spyOn(util, "openPreventSleepURL");

    const wrapper = mount(AlertStayAwake);
    const link = wrapper.find("a");

    // Use createEvent for jsdom compatibility
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    link.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(openPreventSleepURLSpy).toHaveBeenCalledOnce();
  });

  it("applies correct CSS classes for bootstrap alert", () => {
    const wrapper = mount(AlertStayAwake);

    const alert = wrapper.find(".alert");
    expect(alert.exists()).toBe(true);
    expect(alert.classes()).toContain("alert-info");
    expect(alert.classes()).toContain("mt-4");
  });

  it("has bold title text", () => {
    const wrapper = mount(AlertStayAwake);

    const title = wrapper.find(".fw-bold");
    expect(title.exists()).toBe(true);
    expect(title.text()).toBe("Your computer needs to be awake to use Cyd.");
  });

  it("has alert details paragraph", () => {
    const wrapper = mount(AlertStayAwake);

    const details = wrapper.find(".alert-details");
    expect(details.exists()).toBe(true);
    expect(details.classes()).toContain("mb-0");
  });
});
