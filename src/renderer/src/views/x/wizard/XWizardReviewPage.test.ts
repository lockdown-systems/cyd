import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardReviewPage from "./XWizardReviewPage.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";
import i18n from "../../../i18n";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
  openURL: vi.fn(),
  getJobsType: vi.fn(() => "save"),
}));

vi.mock("../../../util_x", () => ({
  xHasSomeData: vi.fn().mockResolvedValue(true),
}));

// Mock child components
vi.mock("../../shared_components/LoadingComponent.vue", () => ({
  default: {
    name: "LoadingComponent",
    template: "<div>Loading...</div>",
  },
}));

vi.mock("../../shared_components/AlertStayAwake.vue", () => ({
  default: {
    name: "AlertStayAwake",
    template: "<div></div>",
  },
}));

vi.mock("../components/XTombstoneBannerComponent.vue", () => ({
  default: {
    name: "XTombstoneBannerComponent",
    template: "<div></div>",
  },
}));

describe("XWizardReviewPage", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        archiveTweets: true,
        archiveLikes: false,
        archiveBookmarks: false,
        archiveDMs: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(() => {
    mockElectronAPI();
    vi.clearAllMocks();

    // Mock X-specific methods that exist
    global.window.electron.X.getDeleteReviewStats = vi.fn().mockResolvedValue({
      tweetsToDelete: 10,
      retweetsToDelete: 5,
      likesToDelete: 20,
      bookmarksToDelete: 15,
      dmsToDelete: 3,
    });
    global.window.electron.X.deleteTweetsCountNotArchived = vi
      .fn()
      .mockResolvedValue(5);
  });

  describe("basic rendering - save mode", () => {
    it("should render review page for save mode", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("Review");
    });

    it("should show Build Database button for save mode", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const buildButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Build Database"));

      expect(buildButton).toBeTruthy();
    });

    it("should show Back to Build Options button for save mode", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Build Options"));

      expect(backButton).toBeTruthy();
    });
  });

  describe("basic rendering - delete mode", () => {
    it("should show Start Deleting button for delete mode", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("delete");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const startButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Start Deleting"));

      expect(startButton).toBeTruthy();
    });

    it("should show Back to Delete Options button for delete mode", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("delete");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Delete Options"));

      expect(backButton).toBeTruthy();
    });
  });

  describe("basic rendering - archive mode", () => {
    it("should show Start Archiving button for archive mode", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("archive");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const startButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Start Archiving"));

      expect(startButton).toBeTruthy();
    });
  });

  describe("navigation - save mode", () => {
    it("should emit startJobs when Build Database clicked", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const buildButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Build Database"));

      (buildButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("startJobs")).toBeTruthy();
    });

    it("should emit setState with WizardBuildOptions when Back clicked", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Build Options"));

      (backButton!.element as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardBuildOptions,
      ]);
    });

    it("should emit setState with WizardDashboard when Dashboard breadcrumb clicked", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const dashboardButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Dashboard"));

      (dashboardButton!.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDashboard]);
    });
  });

  describe("navigation - delete mode", () => {
    it("should emit setState with WizardDeleteOptions when Back clicked", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("delete");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Delete Options"));

      (backButton!.element as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardDeleteOptions,
      ]);
    });
  });

  describe("navigation - archive mode", () => {
    it("should emit setState with WizardArchiveOptions when Back clicked", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("archive");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back to Archive Options"));

      (backButton!.element as HTMLButtonElement).click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardArchiveOptions,
      ]);
    });
  });

  describe("button disabled state", () => {
    it("should disable Build Database button when no archive options selected", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: false,
          archiveLikes: false,
          archiveBookmarks: false,
          archiveDMs: false,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const buildButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Build Database"));

      expect((buildButton?.element as HTMLButtonElement).disabled).toBe(true);
    });

    it("should enable Build Database button when at least one archive option selected", async () => {
      const { getJobsType } = await import("../../../util");
      vi.mocked(getJobsType).mockReturnValue("save");

      const mockModel = createMockModel({
        xAccount: {
          archiveTweets: true,
          archiveLikes: false,
          archiveBookmarks: false,
          archiveDMs: false,
        },
      });

      wrapper = mount(XWizardReviewPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const buildButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Build Database"));

      expect((buildButton?.element as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
