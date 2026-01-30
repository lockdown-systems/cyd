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
      icon: getBreadcrumbIcon('delete'),
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
        <div class="container mt-3">
          <div class="finished">
            <h2>{{ t("finished.youJustDeleted") }}</h2>
            <ul>
              <li>
                <i class="fa-solid fa-fire delete-bullet" />
                <strong>{{
                  model.progress.wallPostsDeleted.toLocaleString()
                }}</strong>
                {{ t("facebook.finished.wallPosts") }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </BaseWizardPage>
</template>
