import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import FacebookProgressComponent from "./FacebookProgressComponent.vue";
import type { FacebookProgress } from "../../../view_models/FacebookViewModel/types";
import en from "../../../i18n/locales/en.json";

// Create i18n instance for tests
const i18n = createI18n({
  legacy: false,
  locale: "en",
  messages: { en },
});

/**
 * Creates a mock FacebookProgress for testing
 */
function createMockProgress(
  overrides?: Partial<FacebookProgress>,
): FacebookProgress {
  return {
    currentJob: "",
    wallPostsDeleted: 0,
    isDeleteWallPostsFinished: false,
    ...overrides,
  };
}

describe("FacebookProgressComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders nothing when progress is null", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: null,
        },
      });

      expect(wrapper.text()).toBe("");
    });

    it("renders progress wrapper when progress is provided", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({ currentJob: "deleteWallPosts" }),
        },
      });

      expect(wrapper.find(".progress-wrapper").exists()).toBe(true);
    });
  });

  describe("deleteWallPosts job", () => {
    it("shows deleted wall posts count when currentJob is deleteWallPosts", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({
            currentJob: "deleteWallPosts",
            wallPostsDeleted: 42,
          }),
        },
      });

      expect(wrapper.text()).toContain("42");
    });

    it("formats large numbers with locale string", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({
            currentJob: "deleteWallPosts",
            wallPostsDeleted: 1234567,
          }),
        },
      });

      // Check that the formatted number is present (locale-dependent)
      expect(wrapper.text()).toContain("1,234,567");
    });

    it("shows completion message when job is finished", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({
            currentJob: "deleteWallPosts",
            wallPostsDeleted: 100,
            isDeleteWallPostsFinished: true,
          }),
        },
      });

      expect(wrapper.text()).toContain("Saving complete");
    });

    it("does not show completion message when job is not finished", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({
            currentJob: "deleteWallPosts",
            wallPostsDeleted: 50,
            isDeleteWallPostsFinished: false,
          }),
        },
      });

      expect(wrapper.text()).not.toContain("complete");
    });
  });

  describe("other jobs", () => {
    it("does not show delete progress for login job", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({
            currentJob: "login",
            wallPostsDeleted: 0,
          }),
        },
      });

      // Should not show delete content when job is login
      expect(wrapper.text()).not.toContain("Deleted");
    });

    it("does not show delete progress for saveUserLang job", () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({
            currentJob: "saveUserLang",
          }),
        },
      });

      expect(wrapper.text()).not.toContain("Deleted");
    });
  });

  describe("prop updates", () => {
    it("updates display when progress changes", async () => {
      const wrapper = mount(FacebookProgressComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          progress: createMockProgress({
            currentJob: "deleteWallPosts",
            wallPostsDeleted: 10,
          }),
        },
      });

      expect(wrapper.text()).toContain("10");

      await wrapper.setProps({
        progress: createMockProgress({
          currentJob: "deleteWallPosts",
          wallPostsDeleted: 25,
        }),
      });

      expect(wrapper.text()).toContain("25");
    });
  });
});
