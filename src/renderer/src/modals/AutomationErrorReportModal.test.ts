import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { ref } from "vue";
import AutomationErrorReportModal from "./AutomationErrorReportModal.vue";
import { AutomationErrorType } from "../automation_errors";
import i18n from "../i18n";

// Mock Bootstrap Modal
vi.mock("bootstrap/js/dist/modal", () => ({
  default: class MockModal {
    show = vi.fn();
    hide = vi.fn();
    dispose = vi.fn();
  },
}));

// Mock CydAPIClient
const mockPing = vi.fn();
const mockPostAutomationErrorReport = vi.fn();
vi.mock("../../../cyd-api-client", () => {
  return {
    default: class CydAPIClient {
      ping = mockPing;
      postAutomationErrorReport = mockPostAutomationErrorReport;
    },
  };
});

// Mock electron API
const mockGetNewErrorReports = vi.fn();
const mockUpdateErrorReportSubmitted = vi.fn();
const mockDismissNewErrorReports = vi.fn();
const mockGetConfig = vi.fn();
const mockSetConfig = vi.fn();
const mockShowQuestion = vi.fn();
const mockShowError = vi.fn();
const mockTrackEvent = vi.fn();

// Create mock event emitter
const mockEmit = vi.fn();
const mockEmitter = {
  emit: mockEmit,
  on: vi.fn(),
};

describe("AutomationErrorReportModal", () => {
  let wrapper: VueWrapper;

  const mockErrorReport = {
    id: 1,
    accountID: 1,
    appVersion: "1.1.21",
    clientPlatform: "macOS",
    accountType: "X",
    accountUsername: "testuser",
    errorReportType: AutomationErrorType.X_manualBugReport,
    errorReportData: JSON.stringify({
      message: "Test error",
      userDescription: "",
    }),
    sensitiveContextData: JSON.stringify({ context: "test" }),
    screenshotDataURI: "data:image/png;base64,test",
    submitted: false,
    dismissed: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup electron API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electron = {
      database: {
        getNewErrorReports: mockGetNewErrorReports,
        updateErrorReportSubmitted: mockUpdateErrorReportSubmitted,
        dismissNewErrorReports: mockDismissNewErrorReports,
        getConfig: mockGetConfig,
        setConfig: mockSetConfig,
      },
      showQuestion: mockShowQuestion,
      showError: mockShowError,
      trackEvent: mockTrackEvent,
    };

    // Setup localStorage
    Storage.prototype.getItem = vi.fn(() => "1");

    // Default mock responses
    mockGetNewErrorReports.mockResolvedValue([mockErrorReport]);
    mockGetConfig.mockResolvedValue(null);
    mockPing.mockResolvedValue(true);
    mockPostAutomationErrorReport.mockResolvedValue(true);
    mockShowQuestion.mockResolvedValue(false);
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it("should render the modal with title", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    expect(wrapper.find(".modal-title").text()).toBe("Submit an error report");
  });

  it("should load error reports on mount", async () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(mockGetNewErrorReports).toHaveBeenCalledWith(1);
  });

  it("should display error type when single error", async () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const heading = wrapper.find("h5");
    expect(heading.exists()).toBe(true);
  });

  it("should display error count when multiple errors", async () => {
    mockGetNewErrorReports.mockResolvedValue([
      mockErrorReport,
      mockErrorReport,
    ]);

    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("2 errors occured");
  });

  it("should have user description textarea", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    const textarea = wrapper.find("textarea.form-control");
    expect(textarea.exists()).toBe(true);
    expect(textarea.attributes("placeholder")).toBe(
      "Describe what happened (optional)",
    );
  });

  it("should have includeSensitiveData checkbox", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    const checkbox = wrapper.find("#includeSensitiveData");
    expect(checkbox.exists()).toBe(true);
    expect(checkbox.attributes("type")).toBe("checkbox");
  });

  it("should default includeSensitiveData to true when config is null", async () => {
    mockGetConfig.mockResolvedValue(null);

    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(mockSetConfig).toHaveBeenCalledWith(
      "includeSensitiveDataInAutomationErrorReports",
      "true",
    );
  });

  it("should load includeSensitiveData from config", async () => {
    mockGetConfig.mockResolvedValue("false");

    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const checkbox = wrapper.find("#includeSensitiveData");
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);
  });

  it("should have toggle details link", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    const toggleLink = wrapper.find(".toggle-details");
    expect(toggleLink.exists()).toBe(true);
    expect(toggleLink.text()).toContain("Show information included in report");
  });

  it("should toggle details when link clicked", async () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    const toggleLink = wrapper.find(".toggle-details");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    toggleLink.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(toggleLink.text()).toContain("Hide information included in report");
  });

  it("should show details when toggled", async () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const toggleLink = wrapper.find(".toggle-details");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    toggleLink.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    const details = wrapper.find("ul.details");
    expect(details.exists()).toBe(true);
  });

  it("should have Submit Report button", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    const submitButton = wrapper.find(".btn-primary");
    expect(submitButton.exists()).toBe(true);
    expect(submitButton.text()).toContain("Submit Report");
  });

  it("should have Don't Submit Report button", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    const dontSubmitButton = wrapper.find(".btn-outline-danger");
    expect(dontSubmitButton.exists()).toBe(true);
    expect(dontSubmitButton.text()).toContain("Don't Submit Report");
  });

  it("should track event and emit hide when Don't Submit Report clicked", async () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const dontSubmitButton = wrapper.find(".btn-outline-danger");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    dontSubmitButton.element.dispatchEvent(clickEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(mockDismissNewErrorReports).toHaveBeenCalledWith(1);
    expect(wrapper.emitted("hide")).toBeTruthy();
  });

  it("should submit error report when Submit Report clicked", async () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const submitButton = wrapper.find(".btn-primary");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    submitButton.element.dispatchEvent(clickEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(mockPostAutomationErrorReport).toHaveBeenCalled();
  });

  it("should disable buttons when submitting", async () => {
    mockPostAutomationErrorReport.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 500)),
    );

    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const submitButton = wrapper.find(".btn-primary");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    submitButton.element.dispatchEvent(clickEvent);

    await wrapper.vm.$nextTick();

    expect(submitButton.attributes("disabled")).toBeDefined();
  });

  it("should show submitting progress", async () => {
    mockPostAutomationErrorReport.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 500)),
    );

    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const submitButton = wrapper.find(".btn-primary");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    submitButton.element.dispatchEvent(clickEvent);

    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    expect(submitButton.text()).toContain("Submitting");
  });

  it("should emit resume for manual bug report", async () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    const submitButton = wrapper.find(".btn-primary");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    submitButton.element.dispatchEvent(clickEvent);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await wrapper.vm.$nextTick();

    expect(mockEmit).toHaveBeenCalledWith("automation-error-1-resume");
  });

  it("should have close button", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    const closeButton = wrapper.find(".btn-close");
    expect(closeButton.exists()).toBe(true);
  });

  it("should have correct modal structure", () => {
    wrapper = mount(AutomationErrorReportModal, {
      global: {
        plugins: [i18n],
        provide: {
          apiClient: ref({
            ping: mockPing,
            postAutomationErrorReport: mockPostAutomationErrorReport,
          }),
        },
        config: {
          globalProperties: {
            emitter: mockEmitter,
          } as any,
        },
      },
    });

    expect(wrapper.find(".modal").exists()).toBe(true);
    expect(wrapper.find(".modal-dialog").exists()).toBe(true);
    expect(wrapper.find(".modal-content").exists()).toBe(true);
    expect(wrapper.find(".modal-header").exists()).toBe(true);
    expect(wrapper.find(".modal-body").exists()).toBe(true);
    expect(wrapper.find(".modal-footer").exists()).toBe(true);
  });
});
