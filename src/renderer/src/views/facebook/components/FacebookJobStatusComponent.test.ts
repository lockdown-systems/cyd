import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import FacebookJobStatusComponent from "./FacebookJobStatusComponent.vue";
import StatusComponent from "../../shared_components/StatusComponent.vue";
import type { FacebookJob } from "../../../view_models/FacebookViewModel/types";
import en from "../../../i18n/locales/en.json";

// Create i18n instance for tests
const i18n = createI18n({
  legacy: false,
  locale: "en",
  messages: { en },
});

/**
 * Creates a mock FacebookJob for testing
 */
function createMockJob(
  jobType: string,
  overrides?: Partial<FacebookJob>,
): FacebookJob {
  return {
    id: 1,
    jobType: jobType as FacebookJob["jobType"],
    status: "pending",
    startedAt: null,
    finishedAt: null,
    progressJSON: "",
    error: null,
    ...overrides,
  };
}

// Mock the StatusComponent to avoid deep rendering
vi.mock("../../shared_components/StatusComponent.vue", () => ({
  default: {
    name: "StatusComponent",
    props: ["jobs", "getJobTypeText", "isPaused", "clickingEnabled"],
    emits: [
      "onPause",
      "onResume",
      "onCancel",
      "onReportBug",
      "onClickingEnabled",
      "onClickingDisabled",
    ],
    template: '<div class="mock-status-component"></div>',
  },
}));

describe("FacebookJobStatusComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders StatusComponent", () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: true,
        },
      });

      expect(wrapper.find(".mock-status-component").exists()).toBe(true);
    });

    it("passes jobs prop to StatusComponent", () => {
      const jobs = [createMockJob("login"), createMockJob("deleteWallPosts")];

      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs,
          isPaused: false,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      expect(statusComponent.props("jobs")).toEqual(jobs);
    });

    it("passes isPaused prop to StatusComponent", () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: true,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      expect(statusComponent.props("isPaused")).toBe(true);
    });

    it("passes clickingEnabled prop to StatusComponent", () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: false,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      expect(statusComponent.props("clickingEnabled")).toBe(false);
    });
  });

  describe("events", () => {
    it("emits onPause when StatusComponent emits onPause", async () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      await statusComponent.vm.$emit("onPause");

      expect(wrapper.emitted("onPause")).toBeTruthy();
    });

    it("emits onResume when StatusComponent emits onResume", async () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: true,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      await statusComponent.vm.$emit("onResume");

      expect(wrapper.emitted("onResume")).toBeTruthy();
    });

    it("emits onCancel when StatusComponent emits onCancel", async () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      await statusComponent.vm.$emit("onCancel");

      expect(wrapper.emitted("onCancel")).toBeTruthy();
    });

    it("emits onReportBug when StatusComponent emits onReportBug", async () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      await statusComponent.vm.$emit("onReportBug");

      expect(wrapper.emitted("onReportBug")).toBeTruthy();
    });

    it("emits onClickingEnabled when StatusComponent emits onClickingEnabled", async () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: false,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      await statusComponent.vm.$emit("onClickingEnabled");

      expect(wrapper.emitted("onClickingEnabled")).toBeTruthy();
    });

    it("emits onClickingDisabled when StatusComponent emits onClickingDisabled", async () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      await statusComponent.vm.$emit("onClickingDisabled");

      expect(wrapper.emitted("onClickingDisabled")).toBeTruthy();
    });
  });

  describe("getJobTypeText", () => {
    it("passes getJobTypeText function to StatusComponent", () => {
      const wrapper = mount(FacebookJobStatusComponent, {
        global: {
          plugins: [i18n],
        },
        props: {
          jobs: [],
          isPaused: false,
          clickingEnabled: true,
        },
      });

      const statusComponent = wrapper.findComponent(StatusComponent);
      const getJobTypeTextFn = statusComponent.props("getJobTypeText");

      expect(typeof getJobTypeTextFn).toBe("function");
    });
  });
});
