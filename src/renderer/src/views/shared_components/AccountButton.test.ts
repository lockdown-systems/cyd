import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import AccountButton from "./AccountButton.vue";
import { createMockAccount, createMockXAccount } from "../../test_util";
import i18n from "../../i18n";

describe("AccountButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("should render account button", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".account-btn").exists()).toBe(true);
  });

  it("should show active state when active prop is true", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".btn-container.active").exists()).toBe(true);
  });

  it("should not show active state when active prop is false", () => {
    const account = createMockAccount();
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".btn-container.active").exists()).toBe(false);
  });

  it("should render X account with profile image", () => {
    const account = createMockAccount({
      type: "X",
      xAccount: createMockXAccount({
        profileImageDataURI: "data:image/png;base64,test",
      }),
    });
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    const img = wrapper.find(".account-btn img");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("data:image/png;base64,test");
  });

  it("should render X account with icon when no profile image", () => {
    const account = createMockAccount({
      type: "X",
      xAccount: createMockXAccount({
        profileImageDataURI: "",
      }),
    });
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".account-btn i").exists()).toBe(true);
    expect(wrapper.find(".account-btn img").exists()).toBe(false);
  });

  it("should show info popup on mouseover", async () => {
    const account = createMockAccount({
      xAccount: createMockXAccount({ username: "testuser" }),
    });
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".info-popup").exists()).toBe(false);

    // Use DOM's createEvent for mouseover
    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();

    expect(wrapper.find(".info-popup").exists()).toBe(true);
    expect(wrapper.find(".info-popup").text()).toContain("@testuser");
  });

  it("should hide info popup on mouseleave", async () => {
    const account = createMockAccount({
      xAccount: createMockXAccount({ username: "testuser" }),
    });
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    // Show popup first
    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();
    expect(wrapper.find(".info-popup").exists()).toBe(true);

    // Then hide it
    const mouseleaveEvent = document.createEvent("MouseEvents");
    mouseleaveEvent.initEvent("mouseleave", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(mouseleaveEvent);
    await nextTick();
    expect(wrapper.find(".info-popup").exists()).toBe(false);
  });

  it("should show 'Add a new account' for unknown account type", async () => {
    const account = createMockAccount({
      type: "unknown",
      xAccount: null,
    });
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();

    expect(wrapper.find(".info-popup").text()).toBe("Add a new account");
  });

  it("should show 'Login to your X account' when xAccount is null", async () => {
    const account = createMockAccount({
      xAccount: null,
    });
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    const mouseoverEvent = document.createEvent("MouseEvents");
    mouseoverEvent.initEvent("mouseover", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(mouseoverEvent);
    await nextTick();

    expect(wrapper.find(".info-popup").text()).toBe("Login to your X account");
  });

  it("should toggle menu on auxclick", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.find(".menu-popup").exists()).toBe(false);

    // Create and dispatch auxclick event to open
    const auxClickEvent1 = document.createEvent("MouseEvents");
    auxClickEvent1.initEvent("auxclick", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(auxClickEvent1);
    await nextTick();

    expect(wrapper.find(".menu-popup").exists()).toBe(true);

    // Click again to close - need a new event object
    const auxClickEvent2 = document.createEvent("MouseEvents");
    auxClickEvent2.initEvent("auxclick", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(auxClickEvent2);
    await nextTick();

    expect(wrapper.find(".menu-popup").exists()).toBe(false);
  });

  it("should emit onRemoveClicked when remove button is clicked", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    // Open menu first
    const auxClickEvent = document.createEvent("MouseEvents");
    auxClickEvent.initEvent("auxclick", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(auxClickEvent);
    await nextTick();

    const removeButton = wrapper.find(".remove-button");
    (removeButton.element as HTMLLIElement).click();
    await nextTick();

    expect(wrapper.emitted("onRemoveClicked")).toBeTruthy();
    expect(wrapper.emitted("onRemoveClicked")?.length).toBe(1);
  });

  it("should close menu after remove is clicked", async () => {
    const account = createMockAccount();
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    // Open menu
    const auxClickEvent = document.createEvent("MouseEvents");
    auxClickEvent.initEvent("auxclick", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(auxClickEvent);
    await nextTick();
    expect(wrapper.find(".menu-popup").exists()).toBe(true);

    // Click remove
    const removeButton = wrapper.find(".remove-button");
    (removeButton.element as HTMLLIElement).click();
    await nextTick();

    expect(wrapper.find(".menu-popup").exists()).toBe(false);
  });

  it("should close menu when clicking outside", async () => {
    vi.useFakeTimers();
    const account = createMockAccount();
    const wrapper = mount(AccountButton, {
      props: {
        account,
        active: false,
      },
      attachTo: document.body,
      global: {
        plugins: [i18n],
      },
    });

    // Open menu
    const auxClickEvent = document.createEvent("MouseEvents");
    auxClickEvent.initEvent("auxclick", true, true);
    wrapper.find(".account-btn").element.dispatchEvent(auxClickEvent);
    await nextTick();
    expect(wrapper.find(".menu-popup").exists()).toBe(true);

    // Click outside
    const outsideClick = document.createEvent("MouseEvents");
    outsideClick.initEvent("click", true, true);
    document.body.dispatchEvent(outsideClick);

    // Advance timer past the 100ms timeout
    vi.advanceTimersByTime(150);
    await nextTick();

    expect(wrapper.find(".menu-popup").exists()).toBe(false);

    wrapper.unmount();
    vi.useRealTimers();
  });
});
