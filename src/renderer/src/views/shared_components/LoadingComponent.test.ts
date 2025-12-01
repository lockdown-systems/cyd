import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LoadingComponent from "./LoadingComponent.vue";
import i18n from "../../i18n";

describe("LoadingComponent", () => {
  it("should render loading image", () => {
    const wrapper = mount(LoadingComponent, {
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find("img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toContain("cyd-loading.gif");
    expect(img.attributes("alt")).toBe("Loading");
  });

  it("should render loading text", () => {
    const wrapper = mount(LoadingComponent, {
      global: {
        plugins: [i18n],
      },
    });

    const text = wrapper.find("p.text-muted");
    expect(text.exists()).toBe(true);
    expect(text.text()).toBe("Loading...");
  });

  it("should have centered layout", () => {
    const wrapper = mount(LoadingComponent, {
      global: {
        plugins: [i18n],
      },
    });

    const container = wrapper.find("div.loading");
    expect(container.exists()).toBe(true);
    expect(container.classes()).toContain("text-center");
  });
});
