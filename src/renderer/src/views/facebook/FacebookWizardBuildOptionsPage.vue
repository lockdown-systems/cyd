<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { FacebookViewModel, State } from "../../view_models/FacebookViewModel";
import { setJobsType, getBreadcrumbIcon } from "../../util";
import type { StandardWizardPageProps } from "../../types/WizardPage";
import { useWizardPage } from "../../composables/useWizardPage";
import BaseWizardPage from "../shared_components/wizard/BaseWizardPage.vue";

// Props
interface Props extends StandardWizardPageProps {
  model: FacebookViewModel;
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
const savePosts = ref(false);
const savePostsHTML = ref(false);

// Custom next handler
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "save");
  emit("setState", State.WizardReview);
};

// Check if any save option is selected
const hasValidSelection = computed(() => {
  return savePosts.value;
});

// Update proceed state when selection changes
const updateProceedState = () => {
  setProceedEnabled(hasValidSelection.value);
};

const loadSettings = async () => {
  console.log("FacebookWizardBuildOptionsPage", "loadSettings");
  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.facebookAccount) {
      savePosts.value = account.facebookAccount.savePosts;
      savePostsHTML.value = account.facebookAccount.savePostsHTML;

      updateProceedState();
    }
  } finally {
    setLoading(false);
  }
};

const saveSettings = async () => {
  console.log("FacebookWizardBuildOptionsPage", "saveSettings");
  if (!props.model.account) {
    console.error(
      "FacebookWizardBuildOptionsPage",
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
      account.facebookAccount.savePosts = savePosts.value;
      account.facebookAccount.savePostsHTML = savePostsHTML.value;
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
      buttons: [],
      label: 'Build Options',
      icon: getBreadcrumbIcon('build'),
    }"
    :button-props="{
      backButtons: [],
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
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>Build your local database</h2>
          <p class="text-muted">You can save posts.</p>
        </div>

        <form @submit.prevent>
          <div class="mb-3">
            <div class="form-check">
              <input
                id="savePosts"
                v-model="savePosts"
                type="checkbox"
                class="form-check-input"
                @change="updateProceedState"
              />
              <label class="form-check-label" for="savePosts"
                >Save my posts</label
              >
            </div>
          </div>
          <div class="indent">
            <div class="mb-3">
              <div class="form-check">
                <input
                  id="savePostsHTML"
                  v-model="savePostsHTML"
                  type="checkbox"
                  class="form-check-input"
                  :disabled="!savePosts"
                />
                <label class="form-check-label" for="savePostsHTML">
                  Save an HTML version of each post
                </label>
              </div>
              <div class="indent">
                <small class="form-text text-muted">
                  Make an HTML archive of each post, including its comments,
                  which is good for taking screenshots
                  <em>(takes longer)</em>
                </small>
              </div>
            </div>
          </div>
        </form>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped></style>
