import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import XJobStatusComponent from "./XJobStatusComponent.vue";
import StatusComponent from "../../shared_components/StatusComponent.vue";
import type { XJob } from "../../../../../shared_types";
import i18n from "../../../i18n";

describe("XJobStatusComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockJob = (
    jobType: string,
    status: "pending" | "running" | "finished" | "canceled",
  ): XJob => ({
    id: 1,
    jobType,
    status,
    startedAt: new Date(),
    finishedAt: status === "finished" ? new Date() : null,
    scheduledAt: new Date(),
    progressJSON: "{}",
    error: null,
  });

  it("should render StatusComponent", () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    expect(wrapper.findComponent(StatusComponent).exists()).toBe(true);
  });

  it("should pass jobs prop to StatusComponent", () => {
    const jobs: XJob[] = [
      createMockJob("login", "running"),
      createMockJob("indexTweets", "pending"),
    ];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    expect(statusComponent.props("jobs")).toEqual(jobs);
  });

  it("should pass isPaused prop to StatusComponent", () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: true,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    expect(statusComponent.props("isPaused")).toBe(true);
  });

  it("should pass clickingEnabled prop to StatusComponent", () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    expect(statusComponent.props("clickingEnabled")).toBe(false);
  });

  it("should emit onPause when StatusComponent emits onPause", async () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    await statusComponent.vm.$emit("onPause");

    expect(wrapper.emitted("onPause")).toBeTruthy();
  });

  it("should emit onResume when StatusComponent emits onResume", async () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: true,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    await statusComponent.vm.$emit("onResume");

    expect(wrapper.emitted("onResume")).toBeTruthy();
  });

  it("should emit onCancel when StatusComponent emits onCancel", async () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    await statusComponent.vm.$emit("onCancel");

    expect(wrapper.emitted("onCancel")).toBeTruthy();
  });

  it("should emit onReportBug when StatusComponent emits onReportBug", async () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    await statusComponent.vm.$emit("onReportBug");

    expect(wrapper.emitted("onReportBug")).toBeTruthy();
  });

  it("should emit onClickingEnabled when StatusComponent emits it", async () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: false,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    await statusComponent.vm.$emit("onClickingEnabled");

    expect(wrapper.emitted("onClickingEnabled")).toBeTruthy();
  });

  it("should emit onClickingDisabled when StatusComponent emits it", async () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    await statusComponent.vm.$emit("onClickingDisabled");

    expect(wrapper.emitted("onClickingDisabled")).toBeTruthy();
  });

  it("should provide getJobTypeText function to StatusComponent", () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    expect(statusComponent.props("getJobTypeText")).toBeInstanceOf(Function);
  });

  it("should translate login job type", () => {
    const jobs: XJob[] = [createMockJob("login", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    const getJobTypeText = statusComponent.props("getJobTypeText");
    expect(getJobTypeText("login")).toBe("Logging in");
  });

  it("should translate indexTweets job type", () => {
    const jobs: XJob[] = [createMockJob("indexTweets", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    const getJobTypeText = statusComponent.props("getJobTypeText");
    expect(getJobTypeText("indexTweets")).toBe("Saving tweets");
  });

  it("should translate deleteTweets job type", () => {
    const jobs: XJob[] = [createMockJob("deleteTweets", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    const getJobTypeText = statusComponent.props("getJobTypeText");
    expect(getJobTypeText("deleteTweets")).toBe("Deleting tweets");
  });

  it("should translate migrateBluesky job type", () => {
    const jobs: XJob[] = [createMockJob("migrateBluesky", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    const getJobTypeText = statusComponent.props("getJobTypeText");
    expect(getJobTypeText("migrateBluesky")).toBe("Migrating to Bluesky");
  });

  it("should return original job type for unknown types", () => {
    const jobs: XJob[] = [createMockJob("unknownJobType", "running")];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    const getJobTypeText = statusComponent.props("getJobTypeText");
    expect(getJobTypeText("unknownJobType")).toBe("unknownJobType");
  });

  it("should handle empty jobs array", () => {
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs: [],
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    expect(statusComponent.props("jobs")).toEqual([]);
  });

  it("should handle multiple jobs", () => {
    const jobs: XJob[] = [
      createMockJob("login", "finished"),
      createMockJob("indexTweets", "running"),
      createMockJob("deleteTweets", "pending"),
    ];
    const wrapper = mount(XJobStatusComponent, {
      props: {
        jobs,
        isPaused: false,
        clickingEnabled: true,
      },
      global: {
        plugins: [i18n],
      },
    });

    const statusComponent = wrapper.findComponent(StatusComponent);
    expect(statusComponent.props("jobs")).toHaveLength(3);
  });
});
