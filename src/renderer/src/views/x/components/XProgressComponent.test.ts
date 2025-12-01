import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import XProgressComponent from "./XProgressComponent.vue";
import type { XProgress } from "../../../../../shared_types";
import i18n from "../../../i18n";

interface MockProgress extends Partial<XProgress> {
  currentJob: string;
}

describe("XProgressComponent", () => {
  describe("formatSeconds helper", () => {
    it("should return empty string for null input", () => {
      const wrapper = mount(XProgressComponent, {
        props: {
          progress: null,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      expect(vm.formatSeconds(null)).toBe("");
    });

    it("should format 0 seconds", () => {
      const wrapper = mount(XProgressComponent, {
        props: {
          progress: null,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      expect(vm.formatSeconds(0)).toBe("0 seconds");
    });

    it("should format seconds less than 60", () => {
      const wrapper = mount(XProgressComponent, {
        props: {
          progress: null,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      expect(vm.formatSeconds(30)).toBe("30 seconds");
    });

    it("should format exactly 60 seconds as 1 minute", () => {
      const wrapper = mount(XProgressComponent, {
        props: {
          progress: null,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      expect(vm.formatSeconds(60)).toBe("1 minutes, 0 seconds");
    });

    it("should format minutes and seconds correctly", () => {
      const wrapper = mount(XProgressComponent, {
        props: {
          progress: null,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      expect(vm.formatSeconds(330)).toBe("5 minutes, 30 seconds");
    });
  });

  describe("basic rendering", () => {
    it("should not render when progress is null", () => {
      const wrapper = mount(XProgressComponent, {
        props: {
          progress: null,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".progress-wrapper").exists()).toBe(false);
    });

    it("should display login message for login job", () => {
      const mockProgress: MockProgress = {
        currentJob: "login",
      };

      const wrapper = mount(XProgressComponent, {
        props: {
          progress: mockProgress as XProgress,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.find(".progress-wrapper").exists()).toBe(true);
      expect(wrapper.text()).toContain("Logging in");
    });

    it("should display tweet counts for indexTweets job", () => {
      const mockProgress: MockProgress = {
        currentJob: "indexTweets",
        tweetsIndexed: 1234,
        retweetsIndexed: 567,
        unknownIndexed: 0,
        errorsOccured: 0,
        isIndexTweetsFinished: false,
      };

      const wrapper = mount(XProgressComponent, {
        props: {
          progress: mockProgress as XProgress,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(wrapper.text()).toContain("1,234 tweets");
      expect(wrapper.text()).toContain("567 retweets");
    });

    it("should render XProgressErrorsOccuredComponent when errors exist", () => {
      const mockProgress: MockProgress = {
        currentJob: "indexTweets",
        tweetsIndexed: 100,
        retweetsIndexed: 50,
        unknownIndexed: 0,
        errorsOccured: 5,
        isIndexTweetsFinished: false,
      };

      const wrapper = mount(XProgressComponent, {
        props: {
          progress: mockProgress as XProgress,
          rateLimitInfo: null,
          accountID: 1,
        },
        global: {
          plugins: [i18n],
        },
      });

      expect(
        wrapper
          .findComponent({ name: "XProgressErrorsOccuredComponent" })
          .exists(),
      ).toBe(true);
      expect(
        wrapper
          .findComponent({ name: "XProgressErrorsOccuredComponent" })
          .props("errorsOccured"),
      ).toBe(5);
    });
  });
});
