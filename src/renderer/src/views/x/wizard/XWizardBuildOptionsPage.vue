<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { XViewModel, State } from "../../../view_models/XViewModel";
import { setJobsType, getBreadcrumbIcon } from "../../../util";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import { useWizardPage } from "../../../composables/useWizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import XLastImportOrBuildComponent from "../components/XLastImportOrBuildComponent.vue";

const { t } = useI18n();

// Props
interface Props extends StandardWizardPageProps {
  model: XViewModel;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits([
  "set-state",
  "update-account",
  "start-jobs",
  "start-jobs-just-save",
  "update-user-premium",
  "finished-run-again-clicked",
  "on-refresh-clicked",
  "next-clicked",
  "back-clicked",
  "cancel-clicked",
  "updateAccount",
  "setState",
]);

// Use wizard page composable
const { isLoading, setLoading } = useWizardPage();

// Proceed state
const canProceed = ref(false);
const setProceedEnabled = (enabled: boolean) => {
  canProceed.value = enabled;
};

// Settings
const archiveTweets = ref(false);
const archiveTweetsHTML = ref(false);
const archiveLikes = ref(false);
const archiveBookmarks = ref(false);
const archiveDMs = ref(false);

// Custom next handler
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "save");
  emit("setState", State.WizardReview);
};

// Custom back handler
const backClicked = async () => {
  await saveSettings();
  emit("setState", State.WizardDatabase);
};

// Check if any archive option is selected
const hasValidSelection = computed(() => {
  return (
    archiveTweets.value ||
    archiveLikes.value ||
    archiveBookmarks.value ||
    archiveDMs.value
  );
});

// Update proceed state when selection changes
const updateProceedState = () => {
  setProceedEnabled(hasValidSelection.value);
};

const loadSettings = async () => {
  console.log("XWizardBuildOptionsPage", "loadSettings");
  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.xAccount) {
      archiveTweets.value = account.xAccount.archiveTweets;
      archiveTweetsHTML.value = account.xAccount.archiveTweetsHTML;
      archiveLikes.value = account.xAccount.archiveLikes;
      archiveBookmarks.value = account.xAccount.archiveBookmarks;
      archiveDMs.value = account.xAccount.archiveDMs;

      updateProceedState();
    }
  } finally {
    setLoading(false);
  }
};

const saveSettings = async () => {
  console.log("XWizardBuildOptionsPage", "saveSettings");
  if (!props.model.account) {
    console.error("XWizardBuildOptionsPage", "saveSettings", "account is null");
    return;
  }

  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.xAccount) {
      account.xAccount.saveMyData = true;
      account.xAccount.deleteMyData = false;
      account.xAccount.archiveMyData = false;

      account.xAccount.archiveTweets = archiveTweets.value;
      account.xAccount.archiveTweetsHTML = archiveTweetsHTML.value;
      account.xAccount.archiveLikes = archiveLikes.value;
      account.xAccount.archiveBookmarks = archiveBookmarks.value;
      account.xAccount.archiveDMs = archiveDMs.value;
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
          action: () => emit('setState', State.WizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
        {
          label: t('review.localDatabase'),
          action: backClicked,
          icon: getBreadcrumbIcon('database'),
        },
      ],
      label: t('review.buildOptions'),
      icon: getBreadcrumbIcon('build'),
    }"
    :button-props="{
      backButtons: [
        {
          label: t('wizard.backToLocalDatabase'),
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
          <h2>{{ t('wizard.buildOptions') }}</h2>
          <p class="text-muted">
            {{ t('wizard.buildOptionsDescription') }}
          </p>
        </div>

        <XLastImportOrBuildComponent
          :account-i-d="model.account.id"
          :show-button="false"
          :show-no-data-warning="false"
          @set-state="emit('setState', $event)"
        />

        <form @submit.prevent>
          <div class="mb-3">
            <div class="form-check">
              <input
                id="archiveTweets"
                v-model="archiveTweets"
                type="checkbox"
                class="form-check-input"
                @change="updateProceedState"
              />
              <label class="form-check-label" for="archiveTweets">
                {{ t('wizard.saveMyTweets') }}
              </label>
            </div>
          </div>
          <div class="indent">
            <div class="mb-3">
              <div class="form-check">
                <input
                  id="archiveTweetsHTML"
                  v-model="archiveTweetsHTML"
                  type="checkbox"
                  class="form-check-input"
                  :disabled="!archiveTweets"
                />
                <label class="form-check-label" for="archiveTweetsHTML">
                  {{ t('wizard.saveHTMLVersionOfEachTweet') }}
                </label>
              </div>
              <div class="indent">
                <small class="form-text text-muted">
                  {{ t('wizard.saveHTMLVersionDescription') }}
                  <em>{{ t('wizard.takesLonger') }}</em>
                </small>
              </div>
            </div>
          </div>
          <div class="mb-3">
            <div class="form-check">
              <input
                id="archiveLikes"
                v-model="archiveLikes"
                type="checkbox"
                class="form-check-input"
                @change="updateProceedState"
              />
              <label class="form-check-label" for="archiveLikes">
                {{ t('wizard.saveMyLikes') }}
              </label>
            </div>
          </div>
          <div class="mb-3">
            <div class="form-check">
              <input
                id="archiveBookmarks"
                v-model="archiveBookmarks"
                type="checkbox"
                class="form-check-input"
                @change="updateProceedState"
              />
              <label class="form-check-label" for="archiveBookmarks">
                {{ t('wizard.saveMyBookmarks') }}
              </label>
            </div>
          </div>
          <div class="mb-3">
            <div class="form-check">
              <input
                id="archiveDMs"
                v-model="archiveDMs"
                type="checkbox"
                class="form-check-input"
                @change="updateProceedState"
              />
              <label class="form-check-label" for="archiveDMs">
                {{ t('wizard.saveMyDMs') }}
              </label>
            </div>
          </div>
        </form>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped></style>
