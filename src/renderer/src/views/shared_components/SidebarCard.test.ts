import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SidebarCard from "./SidebarCard.vue";

describe("SidebarCard", () => {
  it("renders header and stat", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Test Header",
        stat: 42,
      },
    });

    expect(wrapper.find(".card-header").text()).toBe("Test Header");
    expect(wrapper.find(".card-body").text()).toBe("42");
  });

  it("formats numbers less than 1000 as-is", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: 999,
      },
    });

    expect(wrapper.find(".card-body").text()).toBe("999");
  });

  it("formats numbers 1000 and above with k suffix", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: 1000,
      },
    });

    expect(wrapper.find(".card-body").text()).toBe("1.0k");
  });

  it("formats large numbers with one decimal place", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: 12345,
      },
    });

    expect(wrapper.find(".card-body").text()).toBe("12.3k");
  });

  it("formats exactly 1500 correctly", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: 1500,
      },
    });

    expect(wrapper.find(".card-body").text()).toBe("1.5k");
  });

  it("handles zero value", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: 0,
      },
    });

    expect(wrapper.find(".card-body").text()).toBe("0");
  });

  it("renders HTML in header", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "<strong>Bold</strong> Header",
        stat: 100,
      },
    });

    const header = wrapper.find(".card-header");
    expect(header.html()).toContain("<strong>Bold</strong> Header");
    expect(header.find("strong").exists()).toBe(true);
  });

  it("applies correct CSS classes", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Test",
        stat: 50,
      },
    });

    expect(wrapper.find(".col-12").exists()).toBe(true);
    expect(wrapper.find(".card").exists()).toBe(true);
    expect(wrapper.find(".text-center").exists()).toBe(true);
    expect(wrapper.find(".card-header").exists()).toBe(true);
    expect(wrapper.find(".card-body").exists()).toBe(true);
  });

  it("formats very large numbers correctly", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: 999999,
      },
    });

    expect(wrapper.find(".card-body").text()).toBe("1000.0k");
  });

  it("handles negative numbers", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: -500,
      },
    });

    expect(wrapper.find(".card-body").text()).toBe("-500");
  });

  it("handles negative numbers with large absolute values (not formatted with k)", () => {
    const wrapper = mount(SidebarCard, {
      props: {
        header: "Count",
        stat: -2000,
      },
    });

    // The function checks >= 1000, so negative numbers are not formatted with 'k'
    expect(wrapper.find(".card-body").text()).toBe("-2000");
  });
});
