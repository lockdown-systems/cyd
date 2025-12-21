<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  FacebookViewModel,
  State,
} from "../../../view_models/FacebookViewModel";
import { getBreadcrumbIcon, setJobsType } from "../../../util";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import { useWizardPage } from "../../../composables/useWizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import { PlatformStates } from "../../../types/PlatformStates";

const { t } = useI18n();

// Props
interface Props extends StandardWizardPageProps {
  model: FacebookViewModel;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits(["setState", "updateAccount"]);

// Use wizard page composable
const { isLoading, setLoading } = useWizardPage();

// Settings
const deleteWallPosts = ref(false);

// Check if delete option is selected
const hasValidSelection = computed(() => {
  return deleteWallPosts.value;
});

// Custom next handler
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "delete");
  emit("setState", PlatformStates.WizardReview);
};

// Custom back handler
const backClicked = async () => {
  emit("setState", State.FacebookWizardDashboard);
};

const loadSettings = async () => {
  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.facebookAccount) {
      deleteWallPosts.value = account.facebookAccount.deleteWallPosts;
    }
  } finally {
    setLoading(false);
  }
};

const saveSettings = async () => {
  if (!props.model.account) {
    console.error(
      "FacebookDeleteOptionsPage",
      "saveSettings",
      "account is null",
    );
    return;
  }

  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.facebookAccount) {
      account.facebookAccount.deleteWallPosts = deleteWallPosts.value;
      await window.electron.database.saveAccount(JSON.stringify(account));
      emit("updateAccount");
    }
  } finally {
    setLoading(false);
  }
};

onMounted(async () => {
  await loadSettings();
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [
        {
          label: t('wizard.dashboard'),
          action: backClicked,
          icon: getBreadcrumbIcon('dashboard'),
        },
      ],
      label: t('review.deleteOptions'),
      icon: getBreadcrumbIcon('delete'),
    }"
    :button-props="{
      backButtons: [
        {
          label: t('wizard.backToDashboard'),
          action: backClicked,
          disabled: isLoading,
        },
      ],
      nextButtons: [
        {
          label: t('wizard.continueToReview'),
          action: nextClicked,
          disabled: isLoading || !hasValidSelection,
        },
      ],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>{{ t("facebook.deleteOptions.title") }}</h2>
          <p class="text-muted">
            {{ t("facebook.deleteOptions.description") }}
          </p>
        </div>

        <form @submit.prevent>
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="form-check">
                <input
                  id="deleteWallPosts"
                  v-model="deleteWallPosts"
                  type="checkbox"
                  class="form-check-input"
                />
                <label
                  class="form-check-label mr-1 text-nowrap"
                  for="deleteWallPosts"
                >
                  {{ t("facebook.deleteOptions.deleteWallPosts") }}
                </label>
                <span class="ms-2 text-muted">{{
                  t("wizard.recommended")
                }}</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </template>
  </BaseWizardPage>
</template>
