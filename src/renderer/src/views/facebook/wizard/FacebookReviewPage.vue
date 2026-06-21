<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  FacebookViewModel,
  State,
} from "../../../view_models/FacebookViewModel";
import { getBreadcrumbIcon } from "../../../util";
import {
  FACEBOOK_DELETE_CATEGORIES,
  type FacebookDeleteCategory,
} from "../../../view_models/FacebookViewModel/categories";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import { useWizardPage } from "../../../composables/useWizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import LoadingComponent from "../../shared_components/LoadingComponent.vue";
import AlertStayAwake from "../../shared_components/AlertStayAwake.vue";
import { PlatformStates } from "../../../types/PlatformStates";

const { t } = useI18n();

// Props
interface Props extends StandardWizardPageProps {
  model: FacebookViewModel;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits(["setState", "updateAccount", "startJobs"]);

// Use wizard page composable
const { isLoading, setLoading } = useWizardPage();

// The categories the user selected to delete.
const selectedCategories = ref<FacebookDeleteCategory[]>([]);

// Custom next handler
const nextClicked = async () => {
  emit("startJobs");
};

// Custom back handler
const backClicked = async () => {
  emit("setState", PlatformStates.WizardDeleteOptions);
};

// Check if we can proceed
const canProceed = computed(() => {
  return selectedCategories.value.length > 0;
});

onMounted(async () => {
  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.facebookAccount) {
      const facebookAccount = account.facebookAccount;
      selectedCategories.value = FACEBOOK_DELETE_CATEGORIES.filter(
        (category) => facebookAccount[category.setting],
      );
    }
  } finally {
    setLoading(false);
  }
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [
        {
          label: t('wizard.dashboard'),
          action: () => emit('setState', State.FacebookWizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
        {
          label: t('review.deleteOptions'),
          action: () => emit('setState', PlatformStates.WizardDeleteOptions),
          icon: getBreadcrumbIcon('delete'),
        },
      ],
      label: t('wizard.review'),
      icon: getBreadcrumbIcon('review'),
    }"
    :button-props="{
      backButtons: [
        {
          label: t('review.backToDeleteOptions'),
          action: backClicked,
          disabled: isLoading,
        },
      ],
      nextButtons: [
        {
          label: t('review.startDeleting'),
          action: nextClicked,
          disabled: isLoading || !canProceed,
        },
      ],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>{{ t("wizard.reviewChoices") }}</h2>
        </div>

        <template v-if="isLoading">
          <LoadingComponent />
        </template>
        <template v-else>
          <form @submit.prevent>
            <div>
              <h3>
                <i class="fa-solid fa-fire me-1" />
                {{ t("review.deleteMyData") }}
              </h3>
              <ul>
                <li
                  v-for="category in selectedCategories"
                  :key="category.setting"
                >
                  <b>{{ t(`facebook.review.${category.setting}`) }}</b>
                </li>
              </ul>
            </div>

            <div class="alert alert-info mt-4" role="alert">
              <p class="fw-bold mb-0">
                {{ t("facebook.review.languageSettingsMightChange") }}
              </p>
              <p class="alert-details mb-0">
                {{ t("facebook.review.languageSettingsDescription") }}
              </p>
            </div>

            <AlertStayAwake />
          </form>
        </template>
      </div>
    </template>
  </BaseWizardPage>
</template>
