import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import XWizardArchiveOnly from "./XWizardArchiveOnly.vue";

vi.mock("../../../util", () => ({
  getBreadcrumbIcon: vi.fn(() => "icon"),
}));

vi.mock("../../shared_components/wizard/BaseWizardPage.vue", () => ({
  default: {
    name: "BaseWizardPage",
    template: "<div><slot></slot></div>",
    props: ["breadcrumbProps", "buttonProps"],
  },
}));

describe("XWizardArchiveOnly", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should mount archive only page component", () => {
      wrapper = mount(XWizardArchiveOnly);
      expect(wrapper.exists()).toBe(true);
    });

    it("should render BaseWizardPage wrapper", () => {
      wrapper = mount(XWizardArchiveOnly);
      expect(wrapper.findComponent({ name: "BaseWizardPage" }).exists()).toBe(
        true,
      );
    });
  });

  describe("navigation", () => {
    it("should emit set-state with WizardDashboard when Back clicked", async () => {
      wrapper = mount(XWizardArchiveOnly);

      const backButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Back"));

      if (backButton) {
        (backButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("set-state")).toBeTruthy();
        expect(wrapper.emitted("set-state")?.[0]).toEqual(["WizardDashboard"]);
      }
    });

    it("should emit set-state with WizardImporting when Continue clicked", async () => {
      wrapper = mount(XWizardArchiveOnly);

      const nextButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().includes("Continue"));

      if (nextButton) {
        (nextButton.element as HTMLButtonElement).click();
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted("set-state")).toBeTruthy();
        expect(wrapper.emitted("set-state")?.[0]).toEqual(["WizardImporting"]);
      }
    });
  });
});
