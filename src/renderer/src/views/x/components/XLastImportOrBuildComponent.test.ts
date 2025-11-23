import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XLastImportOrBuildComponent from "./XLastImportOrBuildComponent.vue";
import { State } from "../../../view_models/XViewModel";
import * as utilX from "../../../util_x";
import i18n from "../../../i18n";

vi.mock("../../../util_x", () => ({
  xGetLastImportArchive: vi.fn(),
  xGetLastBuildDatabase: vi.fn(),
}));

describe("XLastImportOrBuildComponent", () => {
  let wrapper: VueWrapper;
  const mockGetLastImportArchive = vi.mocked(utilX.xGetLastImportArchive);
  const mockGetLastBuildDatabase = vi.mocked(utilX.xGetLastBuildDatabase);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("data loading", () => {
    it("should fetch last import and build dates on mount", async () => {
      const lastImport = new Date("2024-01-01");
      const lastBuild = new Date("2024-01-02");
      mockGetLastImportArchive.mockResolvedValue(lastImport);
      mockGetLastBuildDatabase.mockResolvedValue(lastBuild);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockGetLastImportArchive).toHaveBeenCalledWith(1);
      expect(mockGetLastBuildDatabase).toHaveBeenCalledWith(1);
    });
  });

  describe("conditional rendering", () => {
    it("should not render when no data and showNoDataWarning is false", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.find(".alert").exists()).toBe(false);
    });

    it("should render warning alert when no data and showNoDataWarning is true", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const alert = wrapper.find(".alert");
      expect(alert.exists()).toBe(true);
      expect(alert.classes()).toContain("alert-warning");
    });

    it("should render info alert when data exists", async () => {
      const lastImport = new Date("2024-01-01");
      mockGetLastImportArchive.mockResolvedValue(lastImport);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const alert = wrapper.find(".alert");
      expect(alert.exists()).toBe(true);
      expect(alert.classes()).toContain("alert-info");
      expect(alert.classes()).not.toContain("alert-warning");
    });
  });

  describe("last import display", () => {
    it("should display last import time when available", async () => {
      const lastImport = new Date("2024-01-01");
      mockGetLastImportArchive.mockResolvedValue(lastImport);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("You last imported your X archive");
      expect(wrapper.text()).toContain("ago");
    });

    it("should not display last import when not available", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(new Date("2024-01-02"));

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).not.toContain("You last imported your X archive");
    });
  });

  describe("last build display", () => {
    it("should display last build time when available", async () => {
      const lastBuild = new Date("2024-01-02");
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(lastBuild);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain(
        "You last built your local database from scratch",
      );
      expect(wrapper.text()).toContain("ago");
    });

    it("should not display last build when not available", async () => {
      mockGetLastImportArchive.mockResolvedValue(new Date("2024-01-01"));
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).not.toContain(
        "You last built your local database from scratch",
      );
    });

    it("should display both times when both are available", async () => {
      const lastImport = new Date("2024-01-01");
      const lastBuild = new Date("2024-01-02");
      mockGetLastImportArchive.mockResolvedValue(lastImport);
      mockGetLastBuildDatabase.mockResolvedValue(lastBuild);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain("You last imported your X archive");
      expect(wrapper.text()).toContain(
        "You last built your local database from scratch",
      );
    });
  });

  describe("no data warning", () => {
    it("should display archive-only warning when archiveOnly is true", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: true,
          archiveOnly: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain(
        "import your local database of tweets before you can migrate them to Bluesky",
      );
    });

    it("should display full warning when archiveOnly is false", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: true,
          archiveOnly: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.text()).toContain(
        "import your local database of tweets, or build it from scratch",
      );
      expect(wrapper.text()).toContain("delete your tweets or likes");
    });

    it("should display warning icon", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.find(".fa-triangle-exclamation").exists()).toBe(true);
    });
  });

  describe("button display", () => {
    it("should not render button when showButton is false", async () => {
      mockGetLastImportArchive.mockResolvedValue(new Date("2024-01-01"));
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.find("button").exists()).toBe(false);
    });

    it("should render Import X Archive button when archiveOnly is true", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: true,
          showNoDataWarning: true,
          archiveOnly: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const button = wrapper.find("button");
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe("Import X Archive");
      expect(button.classes()).toContain("btn-primary");
    });

    it("should emit setState with WizardArchiveOnly when archive button clicked", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: true,
          showNoDataWarning: true,
          archiveOnly: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const button = wrapper.find("button");
      (button.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")![0]).toEqual([
        State.WizardArchiveOnly,
      ]);
    });

    it("should render Build Your Local Database button when no data and archiveOnly is false", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: true,
          showNoDataWarning: true,
          archiveOnly: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const button = wrapper.find("button");
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe("Build Your Local Database");
      expect(button.classes()).toContain("btn-secondary");
    });

    it("should render Rebuild Your Local Database button when data exists", async () => {
      mockGetLastImportArchive.mockResolvedValue(new Date("2024-01-01"));
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: true,
          showNoDataWarning: false,
          archiveOnly: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const button = wrapper.find("button");
      expect(button.exists()).toBe(true);
      expect(button.text()).toBe("Rebuild Your Local Database");
    });

    it("should emit setState with WizardDatabase when database button clicked", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: true,
          showNoDataWarning: true,
          archiveOnly: false,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const button = wrapper.find("button");
      (button.element as HTMLButtonElement).click();
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")![0]).toEqual([State.WizardDatabase]);
    });
  });

  describe("props", () => {
    it("should accept all required props", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 123,
          showButton: true,
          showNoDataWarning: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockGetLastImportArchive).toHaveBeenCalledWith(123);
    });

    it("should accept optional archiveOnly prop", async () => {
      mockGetLastImportArchive.mockResolvedValue(null);
      mockGetLastBuildDatabase.mockResolvedValue(null);

      wrapper = mount(XLastImportOrBuildComponent, {
        props: {
          accountID: 1,
          showButton: false,
          showNoDataWarning: true,
          archiveOnly: true,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.exists()).toBe(true);
    });
  });
});
