import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import XTombstoneBannerComponent from "./XTombstoneBannerComponent.vue";
import {
  TombstoneBannerBackground,
  TombstoneBannerSocialIcons,
} from "../../../types_x";
import i18n from "../../../i18n";

describe("XTombstoneBannerComponent", () => {
  describe("conditional rendering", () => {
    it("should not render when updateBanner is false", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: false,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-preview-wrapper").exists()).toBe(false);
    });

    it("should render when updateBanner is true", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-preview-wrapper").exists()).toBe(true);
    });

    it("should display banner preview text", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain("Banner Preview");
    });
  });

  describe("background rendering", () => {
    it("should render night background when selected", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-bg-night").exists()).toBe(true);
      expect(wrapper.find(".banner-bg-morning").exists()).toBe(false);
    });

    it("should render morning background when selected", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "morning" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-bg-morning").exists()).toBe(true);
      expect(wrapper.find(".banner-bg-night").exists()).toBe(false);
    });
  });

  describe("foreground rendering", () => {
    it("should always render foreground layer when banner is shown", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-foreground").exists()).toBe(true);
    });
  });

  describe("text layer", () => {
    it("should render text layer when updateBannerShowText is true", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-text").exists()).toBe(true);
    });

    it("should not render text layer when updateBannerShowText is false", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-text").exists()).toBe(false);
    });
  });

  describe("social icons", () => {
    it("should not render social icons when set to none", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-social-bluesky").exists()).toBe(false);
      expect(wrapper.find(".banner-social-mastodon").exists()).toBe(false);
      expect(wrapper.find(".banner-social-bluesky-mastodon").exists()).toBe(
        false,
      );
      expect(wrapper.find(".banner-social-mastodon-bluesky").exists()).toBe(
        false,
      );
    });

    it("should render bluesky icon when selected", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "bluesky" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-social-bluesky").exists()).toBe(true);
      expect(wrapper.find(".banner-social-mastodon").exists()).toBe(false);
    });

    it("should render mastodon icon when selected", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "mastodon" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-social-mastodon").exists()).toBe(true);
      expect(wrapper.find(".banner-social-bluesky").exists()).toBe(false);
    });

    it("should render bluesky-mastodon icons when selected", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons:
            "bluesky-mastodon" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-social-bluesky-mastodon").exists()).toBe(
        true,
      );
      expect(wrapper.find(".banner-social-mastodon-bluesky").exists()).toBe(
        false,
      );
    });

    it("should render mastodon-bluesky icons when selected", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons:
            "mastodon-bluesky" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-social-mastodon-bluesky").exists()).toBe(
        true,
      );
      expect(wrapper.find(".banner-social-bluesky-mastodon").exists()).toBe(
        false,
      );
    });
  });

  describe("combined scenarios", () => {
    it("should render all layers when all options enabled", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "morning" as TombstoneBannerBackground,
          updateBannerSocialIcons:
            "bluesky-mastodon" as TombstoneBannerSocialIcons,
          updateBannerShowText: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-preview-wrapper").exists()).toBe(true);
      expect(wrapper.find(".banner-bg-morning").exists()).toBe(true);
      expect(wrapper.find(".banner-foreground").exists()).toBe(true);
      expect(wrapper.find(".banner-text").exists()).toBe(true);
      expect(wrapper.find(".banner-social-bluesky-mastodon").exists()).toBe(
        true,
      );
    });

    it("should render minimal banner with just background and foreground", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".banner-bg-night").exists()).toBe(true);
      expect(wrapper.find(".banner-foreground").exists()).toBe(true);
      expect(wrapper.find(".banner-text").exists()).toBe(false);
      expect(wrapper.findAll(".banner-social-bluesky").length).toBe(0);
    });
  });

  describe("CSS classes", () => {
    it("should have correct wrapper classes", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "night" as TombstoneBannerBackground,
          updateBannerSocialIcons: "none" as TombstoneBannerSocialIcons,
          updateBannerShowText: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      const wrapperEl = wrapper.find(".banner-preview-wrapper");
      expect(wrapperEl.classes()).toContain("banner-preview-wrapper");
      expect(wrapperEl.classes()).toContain("mb-3");
    });

    it("should have banner-layer class on all layers", () => {
      const wrapper = mount(XTombstoneBannerComponent, {
        props: {
          updateBanner: true,
          updateBannerBackground: "morning" as TombstoneBannerBackground,
          updateBannerSocialIcons: "bluesky" as TombstoneBannerSocialIcons,
          updateBannerShowText: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      const layers = wrapper.findAll(".banner-layer");
      expect(layers.length).toBeGreaterThan(0);
      layers.forEach((layer) => {
        expect(layer.classes()).toContain("banner-layer");
      });
    });
  });
});
