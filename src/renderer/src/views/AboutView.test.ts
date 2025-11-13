import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import AboutView from "./AboutView.vue";
import { mockElectronAPI } from "../test_util";

describe("AboutView", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI();

    // Mock electron methods
    window.electron.getVersion = vi.fn().mockResolvedValue("1.1.21");
    window.electron.getMode = vi.fn().mockResolvedValue("prod");
    window.electron.openURL = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("basic rendering", () => {
    it("should render when shouldShow is true", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find(".d-flex.flex-column").exists()).toBe(true);
    });

    it("should not render when shouldShow is false", () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: false,
        },
      });

      expect(wrapper.find(".d-flex.flex-column").exists()).toBe(false);
    });

    it("should render TMKF image", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const img = wrapper.find('img[alt="This Machine Kills Fascists"]');
      expect(img.exists()).toBe(true);
      expect(img.attributes("src")).toContain("cyd-tmkf.svg");
    });
  });

  describe("version information", () => {
    it("should load and display app version", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.electron.getVersion).toHaveBeenCalled();
      expect(wrapper.text()).toContain("version 1.1.21");
    });

    it("should load and display mode", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.electron.getMode).toHaveBeenCalled();
      // Mode is "prod" so "Dev" should not be shown
      expect(wrapper.text()).not.toContain("Dev version");
    });

    it("should show Dev prefix when mode is not prod", async () => {
      window.electron.getMode = vi.fn().mockResolvedValue("dev");

      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Dev");
      expect(wrapper.text()).toContain("version 1.1.21");
    });

    it("should display current year in copyright", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const currentYear = new Date().getFullYear();
      expect(wrapper.text()).toContain(
        `Copyright © Lockdown Systems LLC ${currentYear}`,
      );
    });

    it("should display Cyd wordmark", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const wordmark = wrapper.find('img[alt="Cyd"]');
      expect(wordmark.exists()).toBe(true);
      expect(wordmark.attributes("src")).toContain("wordmark.svg");
    });
  });

  describe("link navigation", () => {
    it("should open source code URL when Source Code clicked", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const sourceButton = wrapper
        .findAll(".btn.btn-link")
        .find((btn) => btn.text().includes("Source Code"));

      expect(sourceButton).toBeTruthy();
      (sourceButton!.element as HTMLElement).click();
      await wrapper.vm.$nextTick();

      expect(window.electron.openURL).toHaveBeenCalledWith(
        "https://github.com/lockdown-systems/cyd",
      );
    });

    it("should open privacy policy URL when Privacy Policy clicked", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const privacyButton = wrapper
        .findAll(".btn.btn-link")
        .find((btn) => btn.text().includes("Privacy Policy"));

      expect(privacyButton).toBeTruthy();
      (privacyButton!.element as HTMLElement).click();
      await wrapper.vm.$nextTick();

      expect(window.electron.openURL).toHaveBeenCalledWith(
        "https://cyd.social/privacy/",
      );
    });

    it("should open terms of use URL when Terms of Use clicked", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const termsButton = wrapper
        .findAll(".btn.btn-link")
        .find((btn) => btn.text().includes("Terms of Use"));

      expect(termsButton).toBeTruthy();
      (termsButton!.element as HTMLElement).click();
      await wrapper.vm.$nextTick();

      expect(window.electron.openURL).toHaveBeenCalledWith(
        "https://cyd.social/terms/",
      );
    });

    it("should open credits URL when Credits clicked", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const creditsButton = wrapper
        .findAll(".btn.btn-link")
        .find((btn) => btn.text().includes("Credits"));

      expect(creditsButton).toBeTruthy();
      (creditsButton!.element as HTMLElement).click();
      await wrapper.vm.$nextTick();

      expect(window.electron.openURL).toHaveBeenCalledWith(
        "https://cyd.social/credits/",
      );
    });
  });

  describe("help content", () => {
    it("should display help email", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Find a bug or need help?");
      expect(wrapper.text()).toContain("collective@lockdown.systems");
    });

    it("should display GPL license information", async () => {
      wrapper = mount(AboutView, {
        props: {
          shouldShow: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("licensed under GPLv3");
    });
  });
});
