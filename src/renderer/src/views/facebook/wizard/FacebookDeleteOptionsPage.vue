<script setup lang="ts">
import { reactive, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  FacebookViewModel,
  State,
} from "../../../view_models/FacebookViewModel";
import {
  FACEBOOK_DELETE_CATEGORIES,
  type FacebookDeleteSetting,
} from "../../../view_models/FacebookViewModel/categories";
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

const settings = reactive<Record<FacebookDeleteSetting, boolean>>({
  deleteWallPosts: false,
  deleteComments: false,
  deleteReactions: false,
  deletePostsOnOthers: false,
  deleteOthersPosts: false,
  deleteCheckins: false,
  deleteTaggedPosts: false,
  deleteTaggedMedia: false,
});

// At least one category must be selected to continue
const hasValidSelection = computed(() =>
  FACEBOOK_DELETE_CATEGORIES.some((category) => settings[category.setting]),
);

// Whether every category is currently selected
const allSelected = computed(() =>
  FACEBOOK_DELETE_CATEGORIES.every((category) => settings[category.setting]),
);

// Toggle every category on or off at once
const toggleSelectAll = async () => {
  const shouldSelect = !allSelected.value;
  for (const category of FACEBOOK_DELETE_CATEGORIES) {
    settings[category.setting] = shouldSelect;
  }
  await saveSettings();
};

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
      for (const category of FACEBOOK_DELETE_CATEGORIES) {
        settings[category.setting] = account.facebookAccount[category.setting];
      }
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
      for (const category of FACEBOOK_DELETE_CATEGORIES) {
        account.facebookAccount[category.setting] = settings[category.setting];
      }
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
            <button
              type="button"
              class="btn btn-sm btn-link"
              @click="toggleSelectAll"
            >
              {{
                allSelected
                  ? t("facebook.deleteOptions.deselectAll")
                  : t("facebook.deleteOptions.selectAll")
              }}
            </button>
          </div>
          <div
            v-for="category in FACEBOOK_DELETE_CATEGORIES"
            :key="category.setting"
            class="mb-3"
          >
            <div class="form-check">
              <input
                :id="category.setting"
                v-model="settings[category.setting]"
                type="checkbox"
                class="form-check-input"
                @change="saveSettings"
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                :for="category.setting"
              >
                {{ t(category.labelKey) }}
              </label>
            </div>
          </div>
        </form>
      </div>
    </template>
  </BaseWizardPage>
</template>
