<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { FacebookViewModel, State } from "../../view_models/FacebookViewModel";
import { facebookHasSomeData } from "../../util_facebook";
import { getBreadcrumbIcon, setJobsType } from "../../util";
import type { StandardWizardPageProps } from "../../types/WizardPage";
import { useWizardPage } from "../../composables/useWizardPage";
import BaseWizardPage from "../shared_components/wizard/BaseWizardPage.vue";
import FacebookLastImportOrBuildComponent from "./FacebookLastImportOrBuildComponent.vue";

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
const wizardConfig = {
  showBreadcrumbs: true,
  showButtons: true,
  showBackButton: true,
  showNextButton: true,
  showCancelButton: false,
  buttonText: {
    back: "Back to Import or Build Database",
    next: "Continue to Review (NOT IMPL YET)",
  },
  breadcrumbs: {
    title: "Delete Options",
  },
};

const { setLoading, setProceedEnabled, updateFormData, isLoading, canProceed } =
  useWizardPage(props, emit, wizardConfig);

// Show more
const deletePostsShowMore = ref(false);
const deletePostsShowMoreButtonText = computed(() =>
  deletePostsShowMore.value ? "Hide more options" : "Show more options",
);
const deletePostsShowMoreClicked = () => {
  deletePostsShowMore.value = !deletePostsShowMore.value;
};

const deleteRepostsShowMore = ref(false);
const deleteRepostsShowMoreButtonText = computed(() =>
  deleteRepostsShowMore.value ? "Hide more options" : "Show more options",
);
const deleteRepostsShowMoreClicked = () => {
  deleteRepostsShowMore.value = !deleteRepostsShowMore.value;
};

// Settings
const deletePosts = ref(false);
const deletePostsDaysOldEnabled = ref(false);
const deletePostsDaysOld = ref(0);
const deleteReposts = ref(false);
const deleteRepostsDaysOldEnabled = ref(false);
const deleteRepostsDaysOld = ref(0);

const hasSomeData = ref(false);

// Custom next handler
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "delete");
  emit("setState", State.WizardReview);
};

// Custom back handler
const backClicked = async () => {
  await saveSettings();
  emit("setState", State.WizardBuildOptions);
};

// Check if any delete option is selected
const hasValidSelection = computed(() => {
  return hasSomeData.value && (deletePosts.value || deleteReposts.value);
});

// Update proceed state when selection changes
const updateProceedState = () => {
  setProceedEnabled(hasValidSelection.value);
};

const loadSettings = async () => {
  console.log("FacebookWizardDeleteOptionsPage", "loadSettings");
  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.facebookAccount) {
      deletePosts.value = account.facebookAccount.deletePosts;
      deletePostsDaysOld.value = account.facebookAccount.deletePostsDaysOld;
      deletePostsDaysOldEnabled.value =
        account.facebookAccount.deletePostsDaysOldEnabled;
      deleteReposts.value = account.facebookAccount.deleteReposts;
      deleteRepostsDaysOld.value = account.facebookAccount.deleteRepostsDaysOld;
      deleteRepostsDaysOldEnabled.value =
        account.facebookAccount.deleteRepostsDaysOldEnabled;

      // Store in form data
      updateFormData("deletePosts", deletePosts.value);
      updateFormData(
        "deletePostsDaysOldEnabled",
        deletePostsDaysOldEnabled.value,
      );
      updateFormData("deletePostsDaysOld", deletePostsDaysOld.value);
      updateFormData("deleteReposts", deleteReposts.value);
      updateFormData(
        "deleteRepostsDaysOldEnabled",
        deleteRepostsDaysOldEnabled.value,
      );
      updateFormData("deleteRepostsDaysOld", deleteRepostsDaysOld.value);
    }

    // Should delete posts show more options?
    if (
      deletePosts.value &&
      (deletePostsDaysOldEnabled.value || deleteRepostsDaysOldEnabled.value)
    ) {
      deletePostsShowMore.value = true;
    }

    // Should delete reposts show more options?
    if (deleteReposts.value && deleteRepostsDaysOldEnabled.value) {
      deleteRepostsShowMore.value = true;
    }

    updateProceedState();
  } finally {
    setLoading(false);
  }
};

const saveSettings = async () => {
  console.log("FacebookWizardDeleteOptionsPage", "saveSettings");
  if (!props.model.account) {
    console.error(
      "FacebookWizardDeleteOptionsPage",
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
      account.facebookAccount.deletePosts = deletePosts.value;
      account.facebookAccount.deletePostsDaysOldEnabled =
        deletePostsDaysOldEnabled.value;
      account.facebookAccount.deletePostsDaysOld = deletePostsDaysOld.value;
      account.facebookAccount.deleteReposts = deleteReposts.value;
      account.facebookAccount.deleteRepostsDaysOldEnabled =
        deleteRepostsDaysOldEnabled.value;
      account.facebookAccount.deleteRepostsDaysOld = deleteRepostsDaysOld.value;

      await window.electron.database.saveAccount(JSON.stringify(account));
      emit("updateAccount");
    }
  } finally {
    setLoading(false);
  }
};

onMounted(async () => {
  hasSomeData.value = await facebookHasSomeData(props.model.account.id);

  await loadSettings();

  if (!hasSomeData.value) {
    deletePosts.value = false;
    deleteReposts.value = false;
  }
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
      buttons: [],
      label: 'Delete Options',
      icon: getBreadcrumbIcon('delete'),
    }"
    :button-props="{
      backButtons: [
        {
          label: 'Back to Import or Build Database',
          action: backClicked,
          disabled: isLoading,
        },
      ],
      nextButtons: [
        {
          label: 'Continue to Review (NOT IMPL YET)',
          action: nextClicked,
          disabled: isLoading || !hasValidSelection,
        },
      ],
    }"
  >
    <template #content>
      <div class="mb-4">
        <h2>Delete from Facebook</h2>
        <p class="text-muted">
          Delete your data from Facebook, except for what you want to keep.
        </p>
      </div>

      <FacebookLastImportOrBuildComponent
        :account-i-d="model.account.id"
        :show-button="true"
        :show-no-data-warning="true"
        :button-text="'Build Your Local Database'"
        :button-text-no-data="'Build Your Local Database'"
        :button-state="State.WizardBuildOptions"
        @set-state="emit('setState', $event)"
      />

      <form @submit.prevent>
        <!-- deletePosts -->
        <div class="mb-3">
          <div class="d-flex align-items-center justify-content-between">
            <div class="form-check">
              <input
                id="deletePosts"
                v-model="deletePosts"
                type="checkbox"
                class="form-check-input"
                :disabled="!hasSomeData"
                @change="updateProceedState"
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                for="deletePosts"
              >
                Delete my posts
              </label>
              <span class="ms-2 text-muted">(recommended)</span>
              <button
                class="btn btn-sm btn-link"
                @click="deletePostsShowMoreClicked"
              >
                {{ deletePostsShowMoreButtonText }}
              </button>
            </div>
          </div>
          <div v-if="deletePostsShowMore" class="indent">
            <div class="d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center flex-nowrap">
                <div class="form-check">
                  <input
                    id="deletePostsDaysOldEnabled"
                    v-model="deletePostsDaysOldEnabled"
                    type="checkbox"
                    class="form-check-input"
                    :disabled="!deletePosts || !hasSomeData"
                  />
                  <label
                    class="form-check-label mr-1 text-nowrap"
                    for="deletePostsDaysOldEnabled"
                  >
                    older than
                  </label>
                </div>
                <div class="d-flex align-items-center">
                  <label
                    class="form-check-label mr-1 sr-only"
                    for="deletePostsDaysOld"
                  >
                    days
                  </label>
                  <div class="input-group flex-nowrap">
                    <input
                      id="deletePostsDaysOld"
                      v-model="deletePostsDaysOld"
                      type="text"
                      class="form-control form-short small"
                      :disabled="
                        !deletePosts ||
                        !deletePostsDaysOldEnabled ||
                        !hasSomeData
                      "
                    />
                    <div class="input-group-append">
                      <span class="input-group-text small">days</span>
                    </div>
                  </div>
                </div>
              </div>
              <span
                v-if="!userAuthenticated || !userPremium"
                class="premium badge badge-primary"
                >Premium</span
              >
            </div>
          </div>
        </div>

        <!-- deleteReposts -->
        <div class="mb-3">
          <div class="d-flex align-items-center justify-content-between">
            <div class="form-check">
              <input
                id="deleteReposts"
                v-model="deleteReposts"
                type="checkbox"
                class="form-check-input"
                :disabled="!hasSomeData"
                @change="updateProceedState"
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                for="deleteReposts"
              >
                Delete my reposts
              </label>
              <span class="ms-2 text-muted">(recommended)</span>
              <button
                class="btn btn-sm btn-link"
                @click="deleteRepostsShowMoreClicked"
              >
                {{ deleteRepostsShowMoreButtonText }}
              </button>
            </div>
          </div>
          <div v-if="deleteRepostsShowMore" class="indent">
            <div class="d-flex align-items-center justify-content-between">
              <div class="d-flex align-items-center flex-nowrap">
                <div class="form-check">
                  <input
                    id="deleteRepostsDaysOldEnabled"
                    v-model="deleteRepostsDaysOldEnabled"
                    type="checkbox"
                    class="form-check-input"
                    :disabled="!deleteReposts || !hasSomeData"
                  />
                  <label
                    class="form-check-label mr-1 text-nowrap"
                    for="deleteRepostsDaysOldEnabled"
                  >
                    older than
                  </label>
                </div>
                <div class="d-flex align-items-center">
                  <label
                    class="form-check-label mr-1 sr-only"
                    for="deleteRepostsDaysOld"
                  >
                    days
                  </label>
                  <div class="input-group flex-nowrap">
                    <input
                      id="deleteRepostsDaysOld"
                      v-model="deleteRepostsDaysOld"
                      type="text"
                      class="form-control form-short small"
                      :disabled="!deleteReposts || !deleteRepostsDaysOldEnabled"
                    />
                    <div class="input-group-append">
                      <span class="input-group-text small">days</span>
                    </div>
                  </div>
                </div>
              </div>
              <span
                v-if="!userAuthenticated || !userPremium"
                class="premium badge badge-primary"
                >Premium</span
              >
            </div>
          </div>
        </div>
      </form>
    </template>
  </BaseWizardPage>
</template>

<style scoped>
.form-short {
  width: 55px;
}

.small {
  font-size: 0.9rem;
}
</style>
