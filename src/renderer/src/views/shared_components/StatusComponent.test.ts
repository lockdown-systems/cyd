import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import StatusComponent from "./StatusComponent.vue";
import RunningIcon from "./RunningIcon.vue";
import type { XJob } from "../../../../shared_types";
import i18n from "../../i18n";

describe("StatusComponent", () => {
  const mockJobs: XJob[] = [
    {
      id: 1,
      jobType: "archiveTweets",
      status: "finished",
      scheduledAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
      progressJSON: "{}",
      error: null,
    },
    {
      id: 2,
      jobType: "deleteTweets",
      status: "running",
      scheduledAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      progressJSON: "{}",
      error: null,
    },
    {
      id: 3,
      jobType: "buildArchive",
      status: "pending",
      scheduledAt: new Date(),
      startedAt: null,
      finishedAt: null,
      progressJSON: "{}",
      error: null,
    },
  ];

  const mockGetJobTypeText = vi.fn((jobType: string) => {
    const labels: Record<string, string> = {
      archiveTweets: "Archive Data",
      deleteTweets: "Delete Data",
      buildArchive: "Build Archive",
    };
    return labels[jobType] || jobType;
  });

  it("should render all jobs", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const jobItems = wrapper.findAll(".job-status-item");
    expect(jobItems).toHaveLength(3);
  });

  it("should display correct job text", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const jobTypes = wrapper.findAll(".job-type");
    expect(jobTypes[0].text()).toBe("Archive Data");
    expect(jobTypes[1].text()).toBe("Delete Data");
    expect(jobTypes[2].text()).toBe("Build Archive");
  });

  it("should show correct status icons", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const icons = wrapper.findAll(".status-icon i");

    // Finished job should have check icon
    expect(icons[0].classes()).toContain("fa-square-check");
    expect(icons[0].classes()).toContain("text-success");

    // Pending job should have ellipsis icon
    expect(icons[2].classes()).toContain("fa-ellipsis");
    expect(icons[2].classes()).toContain("text-primary");
  });

  it("should show RunningIcon for running job when not paused", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const runningIcon = wrapper.findComponent(RunningIcon);
    expect(runningIcon.exists()).toBe(true);
  });

  it("should show pause icon for running job when paused", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: true,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const statusIcons = wrapper.findAll(".status-icon");
    const pauseIcon = statusIcons[1].find("i.fa-pause");
    expect(pauseIcon.exists()).toBe(true);
  });

  it("should show pause button when not paused", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const pauseButton = wrapper.find("button.btn-outline-secondary");
    expect(pauseButton.exists()).toBe(true);
    expect(pauseButton.text()).toContain("Pause");
  });

  it("should show resume button when paused", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: true,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const resumeButton = wrapper.find("button.btn-primary");
    expect(resumeButton.exists()).toBe(true);
    expect(resumeButton.text()).toContain("Resume");
  });

  it("should emit onPause when pause button clicked", async () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const pauseButton = wrapper.find("button.btn-outline-secondary");
    (pauseButton.element as HTMLButtonElement).click();
    await nextTick();

    expect(wrapper.emitted("onPause")).toBeTruthy();
    expect(wrapper.emitted("onPause")).toHaveLength(1);
  });

  it("should emit onResume when resume button clicked", async () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: true,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const resumeButton = wrapper.find("button.btn-primary");
    (resumeButton.element as HTMLButtonElement).click();
    await nextTick();

    expect(wrapper.emitted("onResume")).toBeTruthy();
    expect(wrapper.emitted("onResume")).toHaveLength(1);
  });

  it("should emit onCancel when cancel button clicked", async () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const cancelButton = wrapper.find("button.btn-cancel");
    (cancelButton.element as HTMLButtonElement).click();
    await nextTick();

    expect(wrapper.emitted("onCancel")).toBeTruthy();
    expect(wrapper.emitted("onCancel")).toHaveLength(1);
  });

  it("should emit onReportBug when report button clicked", async () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const buttons = wrapper.findAll("button.btn-link");
    const reportButton = buttons.find((btn) =>
      btn.text().includes("Report a Bug"),
    );
    expect(reportButton).toBeDefined();

    (reportButton!.element as HTMLButtonElement).click();
    await nextTick();

    expect(wrapper.emitted("onReportBug")).toBeTruthy();
  });

  it("should show Enable Clicking button when clicking disabled", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const buttons = wrapper.findAll("button.btn-link");
    const clickingButton = buttons.find((btn) =>
      btn.text().includes("Enable Clicking"),
    );
    expect(clickingButton).toBeDefined();
    expect(clickingButton!.text()).toContain("Enable Clicking in Browser");
  });

  it("should show Disable Clicking button when clicking enabled", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: true,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const buttons = wrapper.findAll("button.btn-link");
    const clickingButton = buttons.find((btn) =>
      btn.text().includes("Disable Clicking"),
    );
    expect(clickingButton).toBeDefined();
    expect(clickingButton!.text()).toContain("Disable Clicking in Browser");
  });

  it("should emit onClickingEnabled when enable button clicked", async () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const buttons = wrapper.findAll("button.btn-link");
    const clickingButton = buttons.find((btn) =>
      btn.text().includes("Enable Clicking"),
    );
    (clickingButton!.element as HTMLButtonElement).click();
    await nextTick();

    expect(wrapper.emitted("onClickingEnabled")).toBeTruthy();
  });

  it("should emit onClickingDisabled when disable button clicked", async () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: mockJobs,
        isPaused: false,
        clickingEnabled: true,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const buttons = wrapper.findAll("button.btn-link");
    const clickingButton = buttons.find((btn) =>
      btn.text().includes("Disable Clicking"),
    );
    (clickingButton!.element as HTMLButtonElement).click();
    await nextTick();

    expect(wrapper.emitted("onClickingDisabled")).toBeTruthy();
  });

  it("should handle empty jobs array", () => {
    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: [],
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const jobItems = wrapper.findAll(".job-status-item");
    expect(jobItems).toHaveLength(0);

    // Control buttons should still be present
    const cancelButton = wrapper.find("button.btn-cancel");
    expect(cancelButton.exists()).toBe(true);
  });

  it("should handle canceled job status", () => {
    const canceledJobs: XJob[] = [
      {
        id: 1,
        jobType: "archiveTweets",
        status: "canceled",
        scheduledAt: new Date(),
        startedAt: new Date(),
        finishedAt: new Date(),
        progressJSON: "{}",
        error: null,
      },
    ];

    const wrapper = mount(StatusComponent, {
      global: {
        plugins: [i18n],
      },
      props: {
        jobs: canceledJobs,
        isPaused: false,
        clickingEnabled: false,
        getJobTypeText: mockGetJobTypeText,
      },
    });

    const icon = wrapper.find(".status-icon i");
    expect(icon.classes()).toContain("fa-circle-exclamation");
    expect(icon.classes()).toContain("text-danger");
  });
});
