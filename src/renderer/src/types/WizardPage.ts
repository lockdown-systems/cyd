import type { BasePlatformViewModel } from "./PlatformView";

/**
 * Standardized props interface that all wizard pages should accept
 * This matches what the dynamic component rendering passes to wizard pages
 */
export interface StandardWizardPageProps {
  /** The platform view model instance */
  model: BasePlatformViewModel;

  /** Whether the user is authenticated */
  userAuthenticated?: boolean;

  /** Whether the user has premium access */
  userPremium?: boolean;

  /** Platform-specific failure state flags for X */
  "failure-state-index-likes_-failed-to-retry-after-rate-limit"?: boolean;
  "failure-state-index-tweets_-failed-to-retry-after-rate-limit"?: boolean;
}

/**
 * Standardized events interface that all wizard pages should emit
 * This matches what the dynamic component rendering expects
 */
export interface StandardWizardPageEvents {
  /** Navigate to a specific state */
  "set-state": (state: string) => void;

  /** Trigger account data refresh */
  "update-account": () => void;

  /** Start job execution */
  "start-jobs": () => void;

  /** Start jobs in save-only mode */
  "start-jobs-just-save": () => void;

  /** Update user premium status */
  "update-user-premium": () => void;

  /** Handle finished jobs run-again action */
  "finished-run-again-clicked": () => void;

  /** Handle refresh action */
  "on-refresh-clicked": () => void;
}

/**
 * Configuration for wizard page behavior
 */
export interface WizardPageConfig {
  /** Whether to show breadcrumbs component */
  showBreadcrumbs?: boolean;

  /** Whether to show bottom navigation buttons */
  showButtons?: boolean;

  /** Whether to show back button */
  showBackButton?: boolean;

  /** Whether to show next button */
  showNextButton?: boolean;

  /** Whether to show cancel button */
  showCancelButton?: boolean;

  /** Custom button text overrides */
  buttonText?: {
    next?: string;
    back?: string;
    cancel?: string;
  };

  /** Breadcrumb configuration */
  breadcrumbs?: {
    currentStep?: string;
    totalSteps?: number;
    title?: string;
  };
}

/**
 * State interface for wizard page management
 */
export interface WizardPageState {
  /** Whether the page is in a loading state */
  isLoading: boolean;

  /** Whether the user can proceed to the next step */
  canProceed: boolean;

  /** Whether there are validation errors */
  hasErrors: boolean;

  /** Current form data (if applicable) */
  formData?: Record<string, unknown>;
}
