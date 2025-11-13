import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import AdvancedSettingsModal from "./AdvancedSettingsModal.vue";

// Mock Bootstrap Modal
vi.mock("bootstrap/js/dist/modal", () => ({
  default: class MockModal {
    show = vi.fn();
    hide = vi.fn();
    dispose = vi.fn();
  },
}));

// Mock electron API
const mockShowOpenDialog = vi.fn();
const mockSetConfig = vi.fn();
const mockGetConfig = vi.fn();
const mockShowQuestion = vi.fn();
const mockDeleteSettingsAndRestart = vi.fn();

describe("AdvancedSettingsModal", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup electron API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).electron = {
      showOpenDialog: mockShowOpenDialog,
      database: {
        setConfig: mockSetConfig,
        getConfig: mockGetConfig,
      },
      showQuestion: mockShowQuestion,
      deleteSettingsAndRestart: mockDeleteSettingsAndRestart,
    };

    // Default mock responses
    mockGetConfig.mockResolvedValue("/default/data/path");
    mockShowOpenDialog.mockResolvedValue(null);
    mockShowQuestion.mockResolvedValue(false);
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  it("should render the modal with title", () => {
    wrapper = mount(AdvancedSettingsModal);

    expect(wrapper.find(".modal-title").text()).toBe("Advanced");
  });

  it("should load data path from config on mount", async () => {
    mockGetConfig.mockResolvedValue("/custom/data/path");

    wrapper = mount(AdvancedSettingsModal);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    expect(mockGetConfig).toHaveBeenCalledWith("dataPath");
    expect(
      (wrapper.find('input[type="text"]').element as HTMLInputElement).value,
    ).toBe("/custom/data/path");
  });

  it("should display default path when config is null", async () => {
    mockGetConfig.mockResolvedValue(null);

    wrapper = mount(AdvancedSettingsModal);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    expect(
      (wrapper.find('input[type="text"]').element as HTMLInputElement).value,
    ).toBe("");
  });

  it("should have readonly input field", () => {
    wrapper = mount(AdvancedSettingsModal);

    const input = wrapper.find('input[type="text"]');
    expect(input.attributes("readonly")).toBeDefined();
  });

  it("should have Browse button", () => {
    wrapper = mount(AdvancedSettingsModal);

    const browseButton = wrapper.find(".btn.btn-secondary");
    expect(browseButton.exists()).toBe(true);
    expect(browseButton.text()).toBe("Browse");
  });

  it("should call showOpenDialog when Browse button clicked", async () => {
    wrapper = mount(AdvancedSettingsModal);

    const browseButton = wrapper.find(".btn.btn-secondary");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    browseButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockShowOpenDialog).toHaveBeenCalledWith(true, false, undefined);
  });

  it("should update data path when new path selected", async () => {
    mockShowOpenDialog.mockResolvedValue("/new/data/path");

    wrapper = mount(AdvancedSettingsModal);

    // Wait for initial mount
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    const browseButton = wrapper.find(".btn.btn-secondary");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    browseButton.element.dispatchEvent(clickEvent);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    expect(mockSetConfig).toHaveBeenCalledWith("dataPath", "/new/data/path");
    expect(
      (wrapper.find('input[type="text"]').element as HTMLInputElement).value,
    ).toBe("/new/data/path");
  });

  it("should not update data path when browse is cancelled", async () => {
    mockShowOpenDialog.mockResolvedValue(null);

    wrapper = mount(AdvancedSettingsModal);

    // Wait for initial mount
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    const initialValue = (
      wrapper.find('input[type="text"]').element as HTMLInputElement
    ).value;

    const browseButton = wrapper.find(".btn.btn-secondary");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    browseButton.element.dispatchEvent(clickEvent);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    expect(mockSetConfig).not.toHaveBeenCalled();
    expect(
      (wrapper.find('input[type="text"]').element as HTMLInputElement).value,
    ).toBe(initialValue);
  });

  it("should have Reset Cyd button in danger zone", () => {
    wrapper = mount(AdvancedSettingsModal);

    const resetButton = wrapper.find(".btn-outline-danger");
    expect(resetButton.exists()).toBe(true);
    expect(resetButton.text()).toBe("Reset Cyd");
  });

  it("should show confirmation dialog when Reset Cyd clicked", async () => {
    wrapper = mount(AdvancedSettingsModal);

    const resetButton = wrapper.find(".btn-outline-danger");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    resetButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(mockShowQuestion).toHaveBeenCalledWith(
      "Are you sure you want to delete all settings and restart the app?",
      "Yes, delete it all!",
      "Cancel",
    );
  });

  it("should call deleteSettingsAndRestart when confirmed", async () => {
    mockShowQuestion.mockResolvedValue(true);

    wrapper = mount(AdvancedSettingsModal);

    const resetButton = wrapper.find(".btn-outline-danger");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    resetButton.element.dispatchEvent(clickEvent);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    expect(mockDeleteSettingsAndRestart).toHaveBeenCalled();
  });

  it("should not call deleteSettingsAndRestart when cancelled", async () => {
    mockShowQuestion.mockResolvedValue(false);

    wrapper = mount(AdvancedSettingsModal);

    const resetButton = wrapper.find(".btn-outline-danger");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    resetButton.element.dispatchEvent(clickEvent);

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 50));
    await wrapper.vm.$nextTick();

    expect(mockDeleteSettingsAndRestart).not.toHaveBeenCalled();
  });

  it("should have close button in header", () => {
    wrapper = mount(AdvancedSettingsModal);

    const closeButton = wrapper.find(".btn-close");
    expect(closeButton.exists()).toBe(true);
  });

  it("should emit hide event when close button clicked", async () => {
    wrapper = mount(AdvancedSettingsModal);

    const closeButton = wrapper.find(".btn-close");
    const clickEvent = document.createEvent("MouseEvents");
    clickEvent.initEvent("click", true, true);
    closeButton.element.dispatchEvent(clickEvent);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("hide")).toBeTruthy();
    expect(wrapper.emitted("hide")?.length).toBe(1);
  });

  it("should have danger zone with warning text", () => {
    wrapper = mount(AdvancedSettingsModal);

    const dangerZone = wrapper.find(".danger-zone");
    expect(dangerZone.exists()).toBe(true);
    expect(dangerZone.text()).toContain(
      "Delete all settings and restart the app",
    );
  });

  it("should have correct modal structure", () => {
    wrapper = mount(AdvancedSettingsModal);

    expect(wrapper.find(".modal").exists()).toBe(true);
    expect(wrapper.find(".modal-dialog").exists()).toBe(true);
    expect(wrapper.find(".modal-content").exists()).toBe(true);
    expect(wrapper.find(".modal-header").exists()).toBe(true);
    expect(wrapper.find(".modal-body").exists()).toBe(true);
  });

  it("should have Data Folder section with heading", () => {
    wrapper = mount(AdvancedSettingsModal);

    expect(wrapper.text()).toContain("Data Folder");
    expect(wrapper.find("h5").text()).toBe("Data Folder");
  });

  it("should have input group with input and button", () => {
    wrapper = mount(AdvancedSettingsModal);

    const inputGroup = wrapper.find(".input-group");
    expect(inputGroup.exists()).toBe(true);
    expect(inputGroup.find(".form-control").exists()).toBe(true);
    expect(inputGroup.find(".btn").exists()).toBe(true);
  });
});
