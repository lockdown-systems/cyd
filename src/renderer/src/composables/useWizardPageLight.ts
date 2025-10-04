import { ref } from "vue";

/**
 * Lightweight wizard page composable for basic state management.
 * Use this for special-purpose pages that don't need the full form management
 * features of useWizardPage, but still want standardized state handling.
 *
 * For full-featured wizard pages with forms, use useWizardPage instead.
 */
export function useWizardPageLight() {
  // Basic loading state
  const isLoading = ref(false);

  const setLoading = (value: boolean) => {
    isLoading.value = value;
  };

  // Basic error state
  const hasError = ref(false);
  const errorMessage = ref("");

  const setError = (error: string) => {
    hasError.value = true;
    errorMessage.value = error;
  };

  const clearError = () => {
    hasError.value = false;
    errorMessage.value = "";
  };

  return {
    // State
    isLoading,
    hasError,
    errorMessage,

    // Actions
    setLoading,
    setError,
    clearError,
  };
}
