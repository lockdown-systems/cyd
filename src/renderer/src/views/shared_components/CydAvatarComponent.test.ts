import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import CydAvatarComponent from "./CydAvatarComponent.vue";
import i18n from "../../i18n";

describe("CydAvatarComponent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render an image element", () => {
    const wrapper = mount(CydAvatarComponent, {
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("alt")).toBe("Cyd");
  });

  it("should use default height of 200", () => {
    const wrapper = mount(CydAvatarComponent, {
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find("img");
    expect(img.attributes("height")).toBe("200");
  });

  it("should accept custom height prop", () => {
    const wrapper = mount(CydAvatarComponent, {
      props: {
        height: 150,
      },
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find("img");
    expect(img.attributes("height")).toBe("150");
  });

  it("should have valid image src", () => {
    const wrapper = mount(CydAvatarComponent, {
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find("img");
    const src = img.attributes("src");

    // Should contain "cyd" and ".svg" in the filename
    expect(src).toBeDefined();
    expect(src).toContain("cyd");
    expect(src).toContain(".svg");
  });

  it("should start with plain stance image", () => {
    const wrapper = mount(CydAvatarComponent, {
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find("img");
    const src = img.attributes("src");

    expect(src).toContain("cyd-plain");
  });
});
