<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  FacebookViewModel,
  State,
} from "../../../view_models/FacebookViewModel";
import { getBreadcrumbIcon } from "../../../util";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";

const { t } = useI18n();

// Props
interface Props extends StandardWizardPageProps {
  model: FacebookViewModel;
}

defineProps<Props>();

// Emits
const emit = defineEmits(["setState"]);

// Go back to dashboard
const backToDashboard = () => {
  emit("setState", State.FacebookWizardDashboard);
};
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [],
      label: t('facebook.finished.title'),
      icon: getBreadcrumbIcon('finished'),
    }"
    :button-props="{
      backButtons: [],
      nextButtons: [
        {
          label: t('wizard.backToDashboard'),
          action: backToDashboard,
        },
      ],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>
            <i class="fa-solid fa-check-circle text-success me-2" />
            {{ t("facebook.finished.title") }}
          </h2>
          <p class="text-muted">
            {{ t("facebook.finished.description") }}
          </p>
        </div>
      </div>
    </template>
  </BaseWizardPage>
</template>
