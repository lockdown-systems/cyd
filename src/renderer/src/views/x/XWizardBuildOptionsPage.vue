<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { XViewModel, State } from "../../view_models/XViewModel";
import { setJobsType, getBreadcrumbIcon } from "../../util";
import type {
  StandardWizardPageProps,
  StandardWizardPageEvents,
} from "../../types/WizardPage";
import { useWizardPage } from "../../composables/useWizardPage";
import BaseWizardPage from "../shared_components/wizard/BaseWizardPage.vue";
import XLastImportOrBuildComponent from "./XLastImportOrBuildComponent.vue";

// Props
interface Props extends StandardWizardPageProps {
  model: XViewModel;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<
  StandardWizardPageEvents & {
    updateAccount: [];
    setState: [value: State];
  }
>();

// Use wizard page composable
const wizardConfig = {
  showBreadcrumbs: true,
  showButtons: true,
  showBackButton: true,
  showNextButton: true,
  showCancelButton: false,
  buttonText: {
    back: "Back to Local Database",
    next: "Continue to Review",
  },
  breadcrumbs: {
    title: "Build Options",
  },
};

const {
  setLoading,
  setProceedEnabled,
  updateFormData,
  getFormData,
  handleNext,
  handleBack,
  isLoading,
  canProceed,
} = useWizardPage(props, emit, wizardConfig);

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

      // Store in form data
      updateFormData("archiveTweets", archiveTweets.value);
      updateFormData("archiveTweetsHTML", archiveTweetsHTML.value);
      updateFormData("archiveLikes", archiveLikes.value);
      updateFormData("archiveBookmarks", archiveBookmarks.value);
      updateFormData("archiveDMs", archiveDMs.value);

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
    :model="model"
    :user-authenticated="userAuthenticated"
    :user-premium="userPremium"
    :config="wizardConfig"
    :is-loading="isLoading"
    :can-proceed="canProceed && hasValidSelection"
    :breadcrumb-props="{
      buttons: [
        {
          label: 'Dashboard',
          action: () => emit('setState', State.WizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
        {
          label: 'Local Database',
          action: backClicked,
          icon: getBreadcrumbIcon('database'),
        },
      ],
      label: 'Build Options',
      icon: getBreadcrumbIcon('build'),
    }"
    :button-props="{
      backButtons: [
        {
          label: 'Back to Local Database',
          action: backClicked,
          disabled: isLoading,
        },
      ],
      nextButtons: [
        {
          label: 'Continue to Review',
          action: nextClicked,
          disabled: isLoading || !hasValidSelection,
        },
      ],
    }"
  >
    <template #content>
      <div class="mb-4">
        <h2>Build options</h2>
        <p class="text-muted">
          You can save tweets, likes, and direct messages.
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
              Save my tweets
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
                Save an HTML version of each tweet
              </label>
            </div>
            <div class="indent">
              <small class="form-text text-muted">
                Make an HTML archive of each tweet, including its replies, which
                is good for taking screenshots
                <em>(takes longer)</em>
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
              Save my likes
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
              Save my bookmarks
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
              Save my direct messages
            </label>
          </div>
        </div>
      </form>
    </template>
  </BaseWizardPage>
</template>

<style scoped></style>
