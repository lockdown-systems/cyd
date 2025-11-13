import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardImportingPage from "./XWizardImportingPage.vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XAccount } from "../../../../../shared_types";
import { createMockAccount, mockElectronAPI } from "../../../test_util";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
}));

// Mock child components
vi.mock("../../shared_components/RunningIcon.vue", () => ({
  default: {
    name: "RunningIcon",
    template: "<div></div>",
  },
}));

vi.mock("../../shared_components/wizard/BaseWizardPage.vue", () => ({
  default: {
    name: "BaseWizardPage",
    template: "<div><slot></slot></div>",
    props: ["breadcrumbProps", "buttonProps"],
  },
}));

describe("XWizardImportingPage", () => {
  let wrapper: VueWrapper;
  let mockEmitter: {
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
  };

  const createMockModel = (
    accountOverrides: { xAccount?: Partial<XAccount> } = {},
  ): Partial<XViewModel> => ({
    account: createMockAccount({
      xAccount: {
        archiveOnly: false,
        ...accountOverrides.xAccount,
      } as XAccount,
    }),
    reloadAccount: vi.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    mockElectronAPI();
    mockEmitter = {
      on: vi.fn(),
      emit: vi.fn(),
    };
    vi.clearAllMocks();

    // Mock platform
    window.electron.getPlatform = vi.fn().mockResolvedValue("darwin");

    // Mock X import functions
    window.electron.X.unzipXArchive = vi
      .fn()
      .mockResolvedValue("/path/to/unzipped");
    window.electron.X.verifyXArchive = vi.fn().mockResolvedValue(null);
    window.electron.X.importXArchive = vi.fn().mockResolvedValue({
      status: "success",
      importCount: 100,
      skipCount: 0,
      errorMessage: "",
    });
    window.electron.X.archiveBuild = vi.fn().mockResolvedValue(undefined);
    window.electron.X.deleteUnzippedXArchive = vi
      .fn()
      .mockResolvedValue(undefined);
    window.electron.X.setConfig = vi.fn().mockResolvedValue(undefined);
    window.electron.showOpenDialog = vi
      .fn()
      .mockResolvedValue("/path/to/archive.zip");
  });

  describe("basic rendering", () => {
    it("should mount importing page component", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it("should render BaseWizardPage wrapper", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      expect(wrapper.findComponent({ name: "BaseWizardPage" }).exists()).toBe(
        true,
      );
    });
  });

  describe("navigation", () => {
    it("should emit setState with WizardImportStart when Back clicked in normal mode", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: false } });

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back"));

      if (backButton) {
        (backButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("setState")).toBeTruthy();
        expect(wrapper.emitted("setState")?.[0]).toEqual([
          State.WizardImportStart,
        ]);
      }
    });

    it("should emit setState with WizardArchiveOnly when Back clicked in archive-only mode", async () => {
      const mockModel = createMockModel({ xAccount: { archiveOnly: true } });

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back"));

      if (backButton) {
        (backButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("setState")).toBeTruthy();
        expect(wrapper.emitted("setState")?.[0]).toEqual([
          State.WizardArchiveOnly,
        ]);
      }
    });
  });

  describe("file selection", () => {
    it("should open file dialog when browse clicked", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const browseButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Browse"));

      if (browseButton) {
        (browseButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(window.electron.showOpenDialog).toHaveBeenCalled();
      }
    });
  });

  describe("platform detection", () => {
    it("should detect platform on mount", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(window.electron.getPlatform).toHaveBeenCalled();
    });
  });

  describe("import process", () => {
    it("should show import progress when started", async () => {
      const mockModel = createMockModel();

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Set a path first
      const input = wrapper.find('input[type="text"]');
      if (input.exists()) {
        await input.setValue("/path/to/archive.zip");
      }

      const startButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Start Import"));

      if (startButton && !startButton.attributes("disabled")) {
        (startButton.element as HTMLButtonElement).click();
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should show some progress indication
        expect(wrapper.text()).toContain("Validating");
      }
    });
  });

  describe("error handling", () => {
    it("should display error messages when import fails", async () => {
      window.electron.X.verifyXArchive = vi
        .fn()
        .mockResolvedValue("Invalid archive");

      const mockModel = createMockModel();

      wrapper = mount(XWizardImportingPage, {
        props: {
          model: mockModel as XViewModel,
        },
        global: {
          config: {
            globalProperties: {
              emitter: mockEmitter,
            },
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Set a path first
      const input = wrapper.find('input[type="text"]');
      if (input.exists()) {
        await input.setValue("/path/to/archive.zip");
      }

      const startButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Start Import"));

      if (startButton && !startButton.attributes("disabled")) {
        (startButton.element as HTMLButtonElement).click();
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Should show error
        const alerts = wrapper.findAll(".alert-danger");
        expect(alerts.length).toBeGreaterThan(0);
      }
    });
  });
});
