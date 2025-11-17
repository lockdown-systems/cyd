import { describe, it, expect, beforeEach } from "vitest";
import { useWizardPage } from "./useWizardPage";

describe("useWizardPage", () => {
  let wizardPage: ReturnType<typeof useWizardPage>;

  beforeEach(() => {
    wizardPage = useWizardPage();
  });

  describe("initial state", () => {
    it("should initialize with loading set to false", () => {
      expect(wizardPage.isLoading.value).toBe(false);
    });

    it("should initialize with no error", () => {
      expect(wizardPage.hasError.value).toBe(false);
      expect(wizardPage.errorMessage.value).toBe("");
    });
  });

  describe("setLoading", () => {
    it("should set loading to true", () => {
      wizardPage.setLoading(true);
      expect(wizardPage.isLoading.value).toBe(true);
    });

    it("should set loading to false", () => {
      wizardPage.setLoading(true);
      wizardPage.setLoading(false);
      expect(wizardPage.isLoading.value).toBe(false);
    });

    it("should allow toggling loading state multiple times", () => {
      wizardPage.setLoading(true);
      expect(wizardPage.isLoading.value).toBe(true);
      wizardPage.setLoading(false);
      expect(wizardPage.isLoading.value).toBe(false);
      wizardPage.setLoading(true);
      expect(wizardPage.isLoading.value).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should set error message and hasError flag", () => {
      const errorMsg = "Something went wrong";
      wizardPage.setError(errorMsg);

      expect(wizardPage.hasError.value).toBe(true);
      expect(wizardPage.errorMessage.value).toBe(errorMsg);
    });

    it("should clear error state", () => {
      wizardPage.setError("An error occurred");
      wizardPage.clearError();

      expect(wizardPage.hasError.value).toBe(false);
      expect(wizardPage.errorMessage.value).toBe("");
    });

    it("should handle multiple consecutive errors", () => {
      wizardPage.setError("First error");
      expect(wizardPage.errorMessage.value).toBe("First error");

      wizardPage.setError("Second error");
      expect(wizardPage.errorMessage.value).toBe("Second error");
      expect(wizardPage.hasError.value).toBe(true);
    });

    it("should allow setting errors after clearing", () => {
      wizardPage.setError("First error");
      wizardPage.clearError();
      wizardPage.setError("Second error");

      expect(wizardPage.hasError.value).toBe(true);
      expect(wizardPage.errorMessage.value).toBe("Second error");
    });
  });

  describe("state independence", () => {
    it("should allow loading and error states to coexist", () => {
      wizardPage.setLoading(true);
      wizardPage.setError("Error while loading");

      expect(wizardPage.isLoading.value).toBe(true);
      expect(wizardPage.hasError.value).toBe(true);
      expect(wizardPage.errorMessage.value).toBe("Error while loading");
    });

    it("should not affect loading state when clearing errors", () => {
      wizardPage.setLoading(true);
      wizardPage.setError("Error");
      wizardPage.clearError();

      expect(wizardPage.isLoading.value).toBe(true);
      expect(wizardPage.hasError.value).toBe(false);
    });
  });
});
