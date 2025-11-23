import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import XWizardDashboard from "./XWizardDashboard.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { mockElectronAPI, createMockAccount } from "../../../test_util";
import i18n from "../../../i18n";

vi.mock("../../../util_x", () => ({
  xHasSomeData: vi.fn(),
  xGetLastImportArchive: vi.fn(),
  xGetLastBuildDatabase: vi.fn(),
  xGetLastDelete: vi.fn(),
}));

describe("XWizardDashboard", () => {
  let wrapper: VueWrapper;

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        archiveOnly: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    mockElectronAPI();

    // Mock feature flag
    vi.mocked(window.electron.isFeatureEnabled).mockResolvedValue(true);

    // Mock util functions
    const {
      xHasSomeData,
      xGetLastImportArchive,
      xGetLastBuildDatabase,
      xGetLastDelete,
    } = await import("../../../util_x");
    vi.mocked(xHasSomeData).mockResolvedValue(false);
    vi.mocked(xGetLastImportArchive).mockResolvedValue(null);
    vi.mocked(xGetLastBuildDatabase).mockResolvedValue(null);
    vi.mocked(xGetLastDelete).mockResolvedValue(null);
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("basic rendering", () => {
    it("should render dashboard with cards", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await nextTick();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.find(".dashboard").exists()).toBe(true);
      expect(wrapper.findAll(".card").length).toBeGreaterThan(0);
    });

    it("should show 'Start Here' badge when no data exists", async () => {
      const { xHasSomeData } = await import("../../../util_x");
      vi.mocked(xHasSomeData).mockResolvedValue(false);

      const mockModel = createMockModel();

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.find(".start-here-badge").exists()).toBe(true);
      expect(wrapper.find(".start-here-badge").text()).toBe("Start Here");
    });

    it("should hide 'Start Here' badge when data exists", async () => {
      const { xHasSomeData } = await import("../../../util_x");
      vi.mocked(xHasSomeData).mockResolvedValue(true);

      const mockModel = createMockModel();

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(wrapper.find(".start-here-badge").exists()).toBe(false);
    });
  });

  describe("regular account (not archiveOnly)", () => {
    it("should show Local Database card", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Local Database");
    });

    it("should show Delete from X card", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Delete from X");
    });

    it("should show Migrate to Bluesky card", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Migrate to Bluesky");
    });

    it("should show Tombstone card when feature is enabled", async () => {
      vi.mocked(window.electron.isFeatureEnabled).mockResolvedValue(true);

      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Tombstone");
    });

    it("should hide Tombstone card when feature is disabled", async () => {
      vi.mocked(window.electron.isFeatureEnabled).mockResolvedValue(false);

      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).not.toContain("Tombstone");
    });
  });

  describe("archiveOnly account", () => {
    it("should show Import X Archive card for archiveOnly accounts", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: true } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Import X Archive");
    });

    it("should hide Local Database card for archiveOnly accounts", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: true } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).not.toContain("Local Database");
    });

    it("should hide Delete from X card for archiveOnly accounts", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: true } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).not.toContain("Delete from X");
    });

    it("should hide Tombstone card for archiveOnly accounts", async () => {
      vi.mocked(window.electron.isFeatureEnabled).mockResolvedValue(true);

      const mockModel = createMockModel({ xAccount: { archiveOnly: true } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).not.toContain("Tombstone");
    });

    it("should still show Migrate to Bluesky card for archiveOnly accounts", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: true } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Migrate to Bluesky");
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardDatabase when Local Database clicked", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const cards = wrapper.findAll(".card");
      const databaseCard = cards.find((card) =>
        card.text().includes("Local Database"),
      );
      expect(databaseCard).toBeDefined();

      (databaseCard!.element as HTMLDivElement).click();
      await nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardDatabase]);
    });

    it("should emit setState with WizardDeleteOptions when Delete clicked", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const cards = wrapper.findAll(".card");
      const deleteCard = cards.find((card) =>
        card.text().includes("Delete from X"),
      );
      expect(deleteCard).toBeDefined();

      (deleteCard!.element as HTMLDivElement).click();
      await nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardDeleteOptions,
      ]);
    });

    it("should emit setState with WizardMigrateToBluesky when Bluesky clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const cards = wrapper.findAll(".card");
      const blueskyCard = cards.find((card) =>
        card.text().includes("Migrate to Bluesky"),
      );
      expect(blueskyCard).toBeDefined();

      (blueskyCard!.element as HTMLDivElement).click();
      await nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardMigrateToBluesky,
      ]);
    });

    it("should emit setState with WizardTombstone when Tombstone clicked", async () => {
      vi.mocked(window.electron.isFeatureEnabled).mockResolvedValue(true);

      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const cards = wrapper.findAll(".card");
      const tombstoneCard = cards.find((card) =>
        card.text().includes("Tombstone"),
      );
      expect(tombstoneCard).toBeDefined();

      (tombstoneCard!.element as HTMLDivElement).click();
      await nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([State.WizardTombstone]);
    });

    it("should emit setState with WizardArchiveOnly when Import Archive clicked (archiveOnly)", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: true } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const cards = wrapper.findAll(".card");
      const archiveCard = cards.find((card) =>
        card.text().includes("Import X Archive"),
      );
      expect(archiveCard).toBeDefined();

      (archiveCard!.element as HTMLDivElement).click();
      await nextTick();

      expect(wrapper.emitted("setState")).toBeTruthy();
      expect(wrapper.emitted("setState")?.[0]).toEqual([
        State.WizardArchiveOnly,
      ]);
    });
  });

  describe("last run timestamps", () => {
    it("should display last database timestamp when available", async () => {
      const { xGetLastBuildDatabase } = await import("../../../util_x");
      const testDate = new Date(2024, 0, 1); // Jan 1, 2024
      vi.mocked(xGetLastBuildDatabase).mockResolvedValue(testDate);

      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Last ran");
    });

    it("should display last delete timestamp when available", async () => {
      const { xGetLastDelete } = await import("../../../util_x");
      const testDate = new Date(2024, 0, 1); // Jan 1, 2024
      vi.mocked(xGetLastDelete).mockResolvedValue(testDate);

      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const text = wrapper.text();
      expect(text).toContain("Last ran");
    });

    it("should use most recent date when both import and build exist", async () => {
      const { xGetLastImportArchive, xGetLastBuildDatabase } = await import(
        "../../../util_x"
      );
      const importDate = new Date(2024, 0, 1); // Jan 1, 2024
      const buildDate = new Date(2024, 0, 15); // Jan 15, 2024 (more recent)
      vi.mocked(xGetLastImportArchive).mockResolvedValue(importDate);
      vi.mocked(xGetLastBuildDatabase).mockResolvedValue(buildDate);

      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should show last ran text (using most recent date)
      const text = wrapper.text();
      expect(text).toContain("Last ran");
    });
  });

  describe("data loading", () => {
    it("should call xHasSomeData on mount", async () => {
      const { xHasSomeData } = await import("../../../util_x");

      const mockModel = createMockModel();

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(xHasSomeData).toHaveBeenCalledWith(1);
    });

    it("should call timestamp utilities on mount", async () => {
      const { xGetLastImportArchive, xGetLastBuildDatabase, xGetLastDelete } =
        await import("../../../util_x");

      const mockModel = createMockModel();

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(xGetLastImportArchive).toHaveBeenCalledWith(1);
      expect(xGetLastBuildDatabase).toHaveBeenCalledWith(1);
      expect(xGetLastDelete).toHaveBeenCalledWith(1);
    });

    it("should check feature flag for tombstone on mount", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardDashboard, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          plugins: [i18n],
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.electron.isFeatureEnabled).toHaveBeenCalledWith(
        "x_tombstone",
      );
    });
  });
});
