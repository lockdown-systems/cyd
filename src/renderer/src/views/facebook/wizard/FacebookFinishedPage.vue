<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  FacebookViewModel,
  State,
} from "../../../view_models/FacebookViewModel";
import { getBreadcrumbIcon } from "../../../util";
import { FACEBOOK_DELETE_CATEGORIES } from "../../../view_models/FacebookViewModel/categories";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import { computed } from "vue";

const { t } = useI18n();

// Props
interface Props extends StandardWizardPageProps {
  model: FacebookViewModel;
}

const props = defineProps<Props>();

// One row per category that had at least one item deleted.
const deletedCounts = computed(() =>
  FACEBOOK_DELETE_CATEGORIES.map((category) => ({
    setting: category.setting,
    count: props.model.progress[category.counter],
    label: t(`facebook.finished.${category.counter}`),
  })).filter((entry) => entry.count > 0),
);

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
            <template v-if="deletedCounts.length > 0">
              <h2>{{ t("finished.youJustDeleted") }}</h2>
              <ul>
                <li v-for="entry in deletedCounts" :key="entry.setting">
                  <i class="fa-solid fa-fire delete-bullet" />
                  <strong>{{ entry.count.toLocaleString() }}</strong>
                  {{ entry.label }}
                </li>
              </ul>
            </template>
            <h2 v-else>{{ t("facebook.finished.nothingToDelete") }}</h2>
          </div>
        </div>
      </div>
    </template>
  </BaseWizardPage>
</template>
