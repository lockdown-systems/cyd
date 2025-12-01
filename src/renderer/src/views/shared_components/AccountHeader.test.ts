import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import AccountHeader from "./AccountHeader.vue";
import { createMockAccount, createMockXAccount } from "../../test_util";
import i18n from "../../i18n";

describe("AccountHeader", () => {
  beforeEach(() => {
    // No special setup needed
  });

  it("should render account header", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".account-header").exists()).toBe(true);
  });

  it("should display X account username", () => {
    const account = createMockAccount({
      xAccount: createMockXAccount({ username: "testuser" }),
    });
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".label-text").text()).toBe("@testuser");
  });

  it("should display profile image when available", () => {
    const account = createMockAccount({
      xAccount: createMockXAccount({
        profileImageDataURI: "data:image/png;base64,test",
      }),
    });
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find(".profile-image img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("data:image/png;base64,test");
    expect(img.attributes("alt")).toBe("Profile Image");
  });

  it("should display account icon", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".logo i").exists()).toBe(true);
  });

  it("should show refresh button when showRefreshButton is true", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".refresh-btn").exists()).toBe(true);
  });

  it("should not show refresh button when showRefreshButton is false", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".refresh-btn").exists()).toBe(false);
  });

  it("should always show remove button", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".remove-btn").exists()).toBe(true);
  });

  it("should emit onRefreshClicked when refresh button is clicked", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const refreshBtn = wrapper.find(".refresh-btn");
    (refreshBtn.element as HTMLDivElement).click();
    await nextTick();

    expect(wrapper.emitted("onRefreshClicked")).toBeTruthy();
    expect(wrapper.emitted("onRefreshClicked")?.length).toBe(1);
  });

  it("should emit onRemoveClicked when remove button is clicked", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    const removeBtn = wrapper.find(".remove-btn");
    (removeBtn.element as HTMLDivElement).click();
    await nextTick();

    expect(wrapper.emitted("onRemoveClicked")).toBeTruthy();
    expect(wrapper.emitted("onRemoveClicked")?.length).toBe(1);
  });

  it("should show refresh button info popup on mouseover", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".info-popup-refresh").exists()).toBe(false);

    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".refresh-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();

    expect(wrapper.find(".info-popup-refresh").exists()).toBe(true);
    expect(wrapper.find(".info-popup-refresh").text()).toBe("Back to start");
  });

  it("should hide refresh button info popup on mouseleave", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    // Show popup
    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".refresh-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();
    expect(wrapper.find(".info-popup-refresh").exists()).toBe(true);

    // Hide popup
    const mouseleaveEvent = document.createEvent("MouseEvents");
    mouseleaveEvent.initEvent("mouseleave", true, true);
    wrapper.find(".refresh-btn").element.dispatchEvent(mouseleaveEvent);
    await nextTick();
    expect(wrapper.find(".info-popup-refresh").exists()).toBe(false);
  });

  it("should show remove button info popup on mouseover", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".info-popup-remove").exists()).toBe(false);

    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".remove-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();

    expect(wrapper.find(".info-popup-remove").exists()).toBe(true);
    expect(wrapper.find(".info-popup-remove").text()).toBe("Remove account");
  });

  it("should hide remove button info popup on mouseleave", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountHeader, {
      props: {
        account,
        showRefreshButton: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    // Show popup
    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".remove-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();
    expect(wrapper.find(".info-popup-remove").exists()).toBe(true);

    // Hide popup
    const mouseleaveEvent = document.createEvent("MouseEvents");
    mouseleaveEvent.initEvent("mouseleave", true, true);
    wrapper.find(".remove-btn").element.dispatchEvent(mouseleaveEvent);
    await nextTick();
    expect(wrapper.find(".info-popup-remove").exists()).toBe(false);
  });
});
