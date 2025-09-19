import { ref, computed, onMounted, onUnmounted } from "vue";
import type {
  StandardWizardPageProps,
  StandardWizardPageEvents,
  WizardPageConfig,
  WizardPageState,
} from "../types/WizardPage";

/**
 * Composable for standardized wizard page functionality
 * Provides common state management, navigation, and event handling for wizard pages
 */
export function useWizardPage(
  props: StandardWizardPageProps,
  emit: (event: keyof StandardWizardPageEvents, ...args: unknown[]) => void,
  config: WizardPageConfig = {},
) {
  // Default configuration
  const pageConfig = {
    showBreadcrumbs: true,
    showButtons: true,
    showBackButton: true,
    showNextButton: true,
    showCancelButton: true,
    buttonText: {
      next: "Next",
      back: "Back",
      cancel: "Cancel",
    },
    ...config,
  };

  // Page state
  const state = ref<WizardPageState>({
    isLoading: false,
    canProceed: true,
    hasErrors: false,
    formData: {},
  });

  // Loading state management
  const setLoading = (loading: boolean) => {
    state.value.isLoading = loading;
  };

  const setProceedEnabled = (enabled: boolean) => {
    state.value.canProceed = enabled;
  };

  const setHasErrors = (hasErrors: boolean) => {
    state.value.hasErrors = hasErrors;
  };

  // Form data management
  const updateFormData = (key: string, value: unknown) => {
    if (!state.value.formData) {
      state.value.formData = {};
    }
    state.value.formData[key] = value;
  };

  const getFormData = (key?: string) => {
    if (key) {
      return state.value.formData?.[key];
    }
    return state.value.formData;
  };

  const resetFormData = () => {
    state.value.formData = {};
  };

  // Navigation handlers
  const handleSetState = (newState: string) => {
    emit("set-state", newState);
  };

  const handleUpdateAccount = () => {
    emit("update-account");
  };

  const handleStartJobs = () => {
    emit("start-jobs");
  };

  const handleStartJobsJustSave = () => {
    emit("start-jobs-just-save");
  };

  const handleUpdateUserPremium = () => {
    emit("update-user-premium");
  };

  const handleFinishedRunAgain = () => {
    emit("finished-run-again-clicked");
  };

  const handleRefresh = () => {
    emit("on-refresh-clicked");
  };

  // Button click handlers with loading state management
  const handleNext = async (customHandler?: () => Promise<void> | void) => {
    if (state.value.isLoading || !state.value.canProceed) return;

    try {
      setLoading(true);
      if (customHandler) {
        await customHandler();
      }
    } catch (error) {
      console.error("Error in next handler:", error);
      setHasErrors(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async (customHandler?: () => Promise<void> | void) => {
    if (state.value.isLoading) return;

    try {
      setLoading(true);
      if (customHandler) {
        await customHandler();
      }
    } catch (error) {
      console.error("Error in back handler:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (customHandler?: () => Promise<void> | void) => {
    if (state.value.isLoading) return;

    try {
      setLoading(true);
      if (customHandler) {
        await customHandler();
      }
    } catch (error) {
      console.error("Error in cancel handler:", error);
    } finally {
      setLoading(false);
    }
  };

  // Computed properties for template use
  const isLoading = computed(() => state.value.isLoading);
  const canProceed = computed(
    () => state.value.canProceed && !state.value.isLoading,
  );
  const hasErrors = computed(() => state.value.hasErrors);

  // Platform-specific computed properties
  const platformModel = computed(() => props.model);
  const isAuthenticated = computed(() => props.userAuthenticated ?? false);
  const hasPremium = computed(() => props.userPremium ?? false);

  // Breadcrumb props
  const breadcrumbProps = computed(() => ({
    currentStep: pageConfig.breadcrumbs?.currentStep || "",
    totalSteps: pageConfig.breadcrumbs?.totalSteps || 0,
    title: pageConfig.breadcrumbs?.title || "",
  }));

  // Button props
  const buttonProps = computed(() => ({
    canProceed: canProceed.value,
    isLoading: isLoading.value,
    showBack: pageConfig.showBackButton,
    showNext: pageConfig.showNextButton,
    showCancel: pageConfig.showCancelButton,
    nextText: pageConfig.buttonText?.next || "Next",
    backText: pageConfig.buttonText?.back || "Back",
    cancelText: pageConfig.buttonText?.cancel || "Cancel",
  }));

  // Validation helpers
  const validateRequired = (value: unknown, _fieldName: string) => {
    if (!value || (typeof value === "string" && value.trim() === "")) {
      setHasErrors(true);
      return false;
    }
    return true;
  };

  const validateForm = (
    validators: Record<string, (value: unknown) => boolean>,
  ) => {
    let isValid = true;
    setHasErrors(false);

    Object.entries(validators).forEach(([fieldName, validator]) => {
      const fieldValue = getFormData(fieldName);
      if (!validator(fieldValue)) {
        isValid = false;
        setHasErrors(true);
      }
    });

    setProceedEnabled(isValid);
    return isValid;
  };

  // Lifecycle
  onMounted(() => {
    // Reset errors on mount
    setHasErrors(false);
  });

  onUnmounted(() => {
    // Cleanup if needed
  });

  return {
    // Configuration
    pageConfig,

    // State
    state: state.value,
    isLoading,
    canProceed,
    hasErrors,

    // Platform properties
    platformModel,
    isAuthenticated,
    hasPremium,

    // State management
    setLoading,
    setProceedEnabled,
    setHasErrors,

    // Form management
    updateFormData,
    getFormData,
    resetFormData,

    // Event handlers
    handleSetState,
    handleUpdateAccount,
    handleStartJobs,
    handleStartJobsJustSave,
    handleUpdateUserPremium,
    handleFinishedRunAgain,
    handleRefresh,

    // Navigation handlers
    handleNext,
    handleBack,
    handleCancel,

    // Computed props for components
    breadcrumbProps,
    buttonProps,

    // Validation
    validateRequired,
    validateForm,
  };
}
