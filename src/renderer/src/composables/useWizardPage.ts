import { ref } from "vue";

/**
 * Wizard page composable for basic state management.
 * Provides standardized loading and error state handling for wizard pages.
 */
export function useWizardPage() {
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
