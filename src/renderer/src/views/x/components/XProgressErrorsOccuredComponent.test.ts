import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import XProgressErrorsOccuredComponent from "./XProgressErrorsOccuredComponent.vue";

describe("XProgressErrorsOccuredComponent", () => {
  describe("rendering", () => {
    it("should not render when errorsOccured is 0", () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 0,
        },
      });

      expect(wrapper.find("span").exists()).toBe(false);
    });

    it("should render when errorsOccured is greater than 0", () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 5,
        },
      });

      expect(wrapper.find("span").exists()).toBe(true);
    });

    it("should have text-muted class", () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 1,
        },
      });

      expect(wrapper.find("span.text-muted").exists()).toBe(true);
    });
  });

  describe("error count display", () => {
    it('should display singular "error" for 1 error', () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 1,
        },
      });

      expect(wrapper.text()).toContain("1 error occured");
      expect(wrapper.text()).not.toContain("errors");
    });

    it('should display plural "errors" for multiple errors', () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 5,
        },
      });

      expect(wrapper.text()).toContain("5 errors occured");
      expect(wrapper.text()).not.toContain("1 error");
    });

    it("should format large numbers with locale formatting", () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 1000,
        },
      });

      // toLocaleString() for 1000 is "1,000" in most locales
      expect(wrapper.text()).toContain("1,000");
      expect(wrapper.text()).toContain("errors occured");
    });

    it("should format very large numbers with locale formatting", () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 1234567,
        },
      });

      // toLocaleString() for 1234567 is "1,234,567" in most locales
      expect(wrapper.text()).toContain("1,234,567");
      expect(wrapper.text()).toContain("errors occured");
    });
  });

  describe("edge cases", () => {
    it("should handle exactly 2 errors (boundary case for plural)", () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: 2,
        },
      });

      expect(wrapper.text()).toContain("2 errors occured");
    });

    it("should not render for negative numbers", () => {
      const wrapper = mount(XProgressErrorsOccuredComponent, {
        props: {
          errorsOccured: -1,
        },
      });

      expect(wrapper.find("span").exists()).toBe(false);
    });
  });
});
