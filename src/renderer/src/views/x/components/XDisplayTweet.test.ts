import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import XDisplayTweet from "./XDisplayTweet.vue";

interface MockModel {
  currentTweetItem: null;
}

describe("XDisplayTweet", () => {
  describe("basic rendering", () => {
    it("should render parent container with correct classes", () => {
      const mockModel: MockModel = {
        currentTweetItem: null,
      };

      const wrapper = mount(XDisplayTweet, {
        props: {
          model: mockModel as never,
          mediaPath: "/path/to/media",
        },
      });

      const parent = wrapper.find(".parent");
      expect(parent.exists()).toBe(true);
      expect(parent.classes()).toContain("d-flex");
      expect(parent.classes()).toContain("justify-content-center");
      expect(parent.classes()).toContain("align-items-start");
    });

    it("should not render tweet when tweetItem is null", () => {
      const mockModel: MockModel = {
        currentTweetItem: null,
      };

      const wrapper = mount(XDisplayTweet, {
        props: {
          model: mockModel as never,
          mediaPath: "/path/to/media",
        },
      });

      expect(wrapper.find(".tweet-container").exists()).toBe(false);
    });
  });

  describe("getImageClass helper", () => {
    it("should return correct class for single image", () => {
      const mockModel: MockModel = {
        currentTweetItem: null,
      };

      const wrapper = mount(XDisplayTweet, {
        props: {
          model: mockModel as never,
          mediaPath: "/path/to/media",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      vm.imageDataURIs = ["data:image/png;base64,test"];

      expect(vm.getImageClass(0)).toBe("col-12 d-flex justify-content-center");
    });

    it("should return correct class for two images", () => {
      const mockModel: MockModel = {
        currentTweetItem: null,
      };

      const wrapper = mount(XDisplayTweet, {
        props: {
          model: mockModel as never,
          mediaPath: "/path/to/media",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      vm.imageDataURIs = [
        "data:image/png;base64,test1",
        "data:image/png;base64,test2",
      ];

      expect(vm.getImageClass(0)).toBe("col-6");
    });

    it("should return correct class for three images", () => {
      const mockModel: MockModel = {
        currentTweetItem: null,
      };

      const wrapper = mount(XDisplayTweet, {
        props: {
          model: mockModel as never,
          mediaPath: "/path/to/media",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      vm.imageDataURIs = [
        "data:image/png;base64,test1",
        "data:image/png;base64,test2",
        "data:image/png;base64,test3",
      ];

      expect(vm.getImageClass(0)).toBe("col-6 col-md-6");
    });

    it("should return correct class for four images", () => {
      const mockModel: MockModel = {
        currentTweetItem: null,
      };

      const wrapper = mount(XDisplayTweet, {
        props: {
          model: mockModel as never,
          mediaPath: "/path/to/media",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      vm.imageDataURIs = [
        "data:image/png;base64,test1",
        "data:image/png;base64,test2",
        "data:image/png;base64,test3",
        "data:image/png;base64,test4",
      ];

      expect(vm.getImageClass(0)).toBe("col-6 col-md-6");
    });

    it("should return correct class for five or more images", () => {
      const mockModel: MockModel = {
        currentTweetItem: null,
      };

      const wrapper = mount(XDisplayTweet, {
        props: {
          model: mockModel as never,
          mediaPath: "/path/to/media",
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any;
      vm.imageDataURIs = [
        "data:image/png;base64,test1",
        "data:image/png;base64,test2",
        "data:image/png;base64,test3",
        "data:image/png;base64,test4",
        "data:image/png;base64,test5",
      ];

      expect(vm.getImageClass(0)).toBe("col-6 col-md-4");
    });
  });
});
