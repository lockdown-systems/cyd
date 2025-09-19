<script setup lang="ts">
import { computed } from "vue";
import BreadcrumbsComponent from "../BreadcrumbsComponent.vue";
import ButtonsComponent from "../ButtonsComponent.vue";
import type {
  StandardWizardPageProps,
  StandardWizardPageEvents,
  WizardPageConfig,
} from "../../../types/WizardPage";

// Props interface
interface BaseWizardPageProps extends StandardWizardPageProps {
  /** Configuration for wizard page behavior */
  config?: WizardPageConfig;

  /** Whether page is loading */
  isLoading?: boolean;

  /** Whether user can proceed */
  canProceed?: boolean;

  /** Breadcrumb properties */
  breadcrumbProps?: {
    buttons?: Array<{ label: string; icon?: string; action: () => void }>;
    label?: string;
    icon?: string;
  };

  /** Button properties */
  buttonProps?: {
    backButtons?: Array<{
      label: string;
      action: () => void;
      disabled?: boolean;
      hide?: boolean;
    }>;
    nextButtons?: Array<{
      label: string;
      action: () => void;
      disabled?: boolean;
      hide?: boolean;
      dangerStyle?: boolean;
    }>;
  };
}

const props = withDefaults(defineProps<BaseWizardPageProps>(), {
  config: () => ({
    showBreadcrumbs: true,
    showButtons: true,
    showBackButton: true,
    showNextButton: true,
    showCancelButton: true,
  }),
  isLoading: false,
  canProceed: true,
  breadcrumbProps: () => ({
    buttons: [],
    label: "",
    icon: undefined,
  }),
  buttonProps: () => ({
    backButtons: [],
    nextButtons: [],
  }),
});

// Events
const emit = defineEmits<{
  // Standard wizard page events
  "set-state": (state: string) => void;
  "update-account": () => void;
  "start-jobs": () => void;
  "start-jobs-just-save": () => void;
  "update-user-premium": () => void;
  "finished-run-again-clicked": () => void;
  "on-refresh-clicked": () => void;
  // Navigation button events
  "next-clicked": () => void;
  "back-clicked": () => void;
  "cancel-clicked": () => void;
}>();

// Computed configuration
const pageConfig = computed(() => ({
  showBreadcrumbs: true,
  showButtons: true,
  showBackButton: true,
  showNextButton: true,
  showCancelButton: true,
  ...props.config,
}));

// Button handlers
const handleNext = () => {
  emit("next-clicked");
};

const handleBack = () => {
  emit("back-clicked");
};

const handleCancel = () => {
  emit("cancel-clicked");
};

// Computed breadcrumb configuration
const breadcrumbConfig = computed(() => ({
  buttons: props.breadcrumbProps?.buttons || [],
  label: props.breadcrumbProps?.label || "",
  icon: props.breadcrumbProps?.icon,
}));

// Computed button configuration
const buttonConfig = computed(() => {
  const backButtons = props.buttonProps?.backButtons || [];
  const nextButtons = props.buttonProps?.nextButtons || [];

  // Add default back button if showBackButton is true and no custom buttons provided
  const defaultBackButtons =
    pageConfig.value.showBackButton && backButtons.length === 0
      ? [
          {
            label: pageConfig.value.buttonText?.back || "Back",
            action: handleBack,
            disabled: props.isLoading,
          },
        ]
      : backButtons;

  // Add default next button if showNextButton is true and no custom buttons provided
  const defaultNextButtons =
    pageConfig.value.showNextButton && nextButtons.length === 0
      ? [
          {
            label: pageConfig.value.buttonText?.next || "Next",
            action: handleNext,
            disabled: props.isLoading || !props.canProceed,
          },
        ]
      : nextButtons;

  return {
    backButtons: defaultBackButtons,
    nextButtons: defaultNextButtons,
  };
});
</script>

<template>
  <div class="base-wizard-page">
    <!-- Breadcrumbs Section -->
    <div v-if="pageConfig.showBreadcrumbs" class="wizard-breadcrumbs">
      <BreadcrumbsComponent
        :buttons="breadcrumbConfig.buttons"
        :label="breadcrumbConfig.label"
        :icon="breadcrumbConfig.icon"
      />
    </div>

    <!-- Main Content Area -->
    <div class="wizard-content">
      <div class="wizard-scroll-content">
        <!-- Content slot - wizard page specific content goes here -->
        <slot
          name="content"
          :model="model"
          :user-authenticated="userAuthenticated"
          :user-premium="userPremium"
          :is-loading="isLoading"
          :can-proceed="canProceed"
        />

        <!-- Default content if no slot provided -->
        <div v-if="!$slots.content">
          <slot />
        </div>
      </div>
    </div>

    <!-- Navigation Buttons Section -->
    <div v-if="pageConfig.showButtons" class="wizard-buttons">
      <ButtonsComponent
        :back-buttons="buttonConfig.backButtons"
        :next-buttons="buttonConfig.nextButtons"
      />
    </div>
  </div>
</template>

<style scoped>
.base-wizard-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.wizard-breadcrumbs {
  flex-shrink: 0;
}

.wizard-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wizard-scroll-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.wizard-buttons {
  flex-shrink: 0;
}
</style>
