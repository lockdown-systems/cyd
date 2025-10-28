<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { XViewModel, State } from "../../../view_models/XViewModel";
import type { XDatabaseStats } from "../../../../../shared_types";
import { emptyXDatabaseStats } from "../../../../../shared_types";
import { getBreadcrumbIcon, setJobsType } from "../../../util";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import { useWizardPage } from "../../../composables/useWizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";

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
const archiveTweetsHTML = ref(false);
const archiveBookmarks = ref(false);
const archiveDMs = ref(false);

const databaseStats = ref<XDatabaseStats>(emptyXDatabaseStats());
const deleteTweetsCountNotArchived = ref(0);

// Custom next handler
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "archive");
  emit("setState", State.WizardReview);
};

// Custom back handler
const backClicked = async () => {
  await saveSettings();
  emit("setState", State.WizardDatabase);
};

// Check if any archive option is selected
const hasValidSelection = computed(() => {
  return archiveTweetsHTML.value || archiveBookmarks.value || archiveDMs.value;
});

// Update proceed state when selection changes
const updateProceedState = () => {
  setProceedEnabled(hasValidSelection.value);
};

const loadSettings = async () => {
  console.log("XWizardArchiveOptionsPage", "loadSettings");
  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.xAccount) {
      archiveTweetsHTML.value = account.xAccount.archiveTweetsHTML;
      archiveBookmarks.value = account.xAccount.archiveBookmarks;
      archiveDMs.value = account.xAccount.archiveDMs;

      updateProceedState();
    }
  } finally {
    setLoading(false);
  }
};

const saveSettings = async () => {
  console.log("XWizardArchiveOptionsPage", "saveSettings");
  if (!props.model.account) {
    console.error(
      "XWizardArchiveOptionsPage",
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
    if (account && account.xAccount) {
      account.xAccount.saveMyData = false;
      account.xAccount.deleteMyData = false;
      account.xAccount.archiveMyData = true;

      account.xAccount.archiveTweetsHTML = archiveTweetsHTML.value;
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
  databaseStats.value = await window.electron.X.getDatabaseStats(
    props.model.account.id,
  );
  deleteTweetsCountNotArchived.value =
    await window.electron.X.deleteTweetsCountNotArchived(
      props.model.account?.id,
      true,
    );
});
</script>

<template>
  <BaseWizardPage
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
      label: 'Archive Options',
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
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>Archive options</h2>
          <p class="text-muted">
            You can save an HTML version of each tweet, and you can save your
            bookmarks and your direct messages.
          </p>
        </div>

        <form @submit.prevent>
          <div class="mb-3">
            <div class="form-check">
              <input
                id="archiveTweetsHTML"
                v-model="archiveTweetsHTML"
                type="checkbox"
                class="form-check-input"
                @change="updateProceedState"
              />
              <label class="form-check-label" for="archiveTweetsHTML"
                >Save an HTML version of each tweet</label
              >
            </div>
            <div class="indent">
              <small
                v-if="databaseStats.tweetsSaved == 0"
                class="form-text text-muted"
              >
                <i class="fa-solid fa-triangle-exclamation" />
                Your local database doesn't have any tweets yet. You need to
                import your X archive or build your database from scratch before
                you can save HTML versions of your tweets.
              </small>
              <small v-else class="form-text text-muted">
                Make an HTML archive of each tweet, including its replies, which
                is good for taking screenshots
                <em>(takes much longer than just deleting them)</em>
              </small>
            </div>
            <div v-if="deleteTweetsCountNotArchived > 0" class="indent">
              <small>
                <i class="fa-solid fa-circle-info" />
                You have
                <strong>{{ deleteTweetsCountNotArchived }} tweets</strong> that
                haven't been archived yet
              </small>
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
              <label class="form-check-label" for="archiveBookmarks"
                >Save my bookmarks</label
              >
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
              <label class="form-check-label" for="archiveDMs"
                >Save my direct messages</label
              >
            </div>
          </div>
        </form>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped></style>
