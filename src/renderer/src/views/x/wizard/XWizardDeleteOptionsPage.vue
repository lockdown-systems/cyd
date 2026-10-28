<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { XViewModel, State } from "../../../view_models/XViewModel";
import {
  xHasSomeData,
  isEmptyContainsFilterText,
  containsFilterHasTooManyWildcards,
  MAX_CONTAINS_FILTER_WILDCARDS,
} from "../../../util_x";
import { getBreadcrumbIcon, openURL, setJobsType } from "../../../util";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import { useWizardPage } from "../../../composables/useWizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import XLastImportOrBuildComponent from "../components/XLastImportOrBuildComponent.vue";
import XDirectMessagesWithdrawnComponent from "../components/XDirectMessagesWithdrawnComponent.vue";

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

// Show more
const deleteTweetsShowMore = ref(false);
const deleteTweetsShowMoreButtonText = computed(() =>
  deleteTweetsShowMore.value
    ? t("wizard.hideMoreOptions")
    : t("wizard.showMoreOptions"),
);
const deleteTweetsShowMoreClicked = () => {
  deleteTweetsShowMore.value = !deleteTweetsShowMore.value;
};

const deleteRetweetsShowMore = ref(false);
const deleteRetweetsShowMoreButtonText = computed(() =>
  deleteRetweetsShowMore.value
    ? t("wizard.hideMoreOptions")
    : t("wizard.showMoreOptions"),
);
const deleteRetweetsShowMoreClicked = () => {
  deleteRetweetsShowMore.value = !deleteRetweetsShowMore.value;
};

// Settings
const deleteTweets = ref(false);
const deleteTweetsDaysOldEnabled = ref(false);
const deleteTweetsDaysOld = ref(0);
const deleteTweetsRetweetsThresholdEnabled = ref(false);
const deleteTweetsRetweetsThreshold = ref(0);
const deleteTweetsLikesThresholdEnabled = ref(false);
const deleteTweetsLikesThreshold = ref(0);
const deleteRetweets = ref(false);
const deleteRetweetsDaysOldEnabled = ref(false);
const deleteRetweetsDaysOld = ref(0);
const deleteTweetsFilterEnabled = ref(false);
const deleteTweetsFilterText = ref("");
const deleteRetweetsFilterEnabled = ref(false);
const deleteRetweetsFilterText = ref("");
const deleteLikes = ref(false);
const deleteBookmarks = ref(false);
const unfollowEveryone = ref(false);

const hasSomeData = ref(false);

// "Only if they contain" preview: how many posts the current settings would
// delete. null means the count has not been fetched yet.
const PREVIEW_DEBOUNCE_MS = 400;
const tweetsMatchCount = ref<number | null>(null);
const retweetsMatchCount = ref<number | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | null = null;

// Runs are chained so two fetches never interleave their save and count,
// and only the most recent run is allowed to update the counts
let previewChain: Promise<void> = Promise.resolve();
let previewRun = 0;
const refreshPreview = (): Promise<void> => {
  const run = ++previewRun;
  previewChain = previewChain.then(async () => {
    if (!props.model.account || run !== previewRun) {
      return;
    }
    // The counts come from the same queries the delete jobs run, so the
    // settings have to be saved first
    await persistSettings();
    const stats = await window.electron.X.getDeleteReviewStats(
      props.model.account.id,
    );
    if (run === previewRun) {
      tweetsMatchCount.value = stats.tweetsToDelete;
      retweetsMatchCount.value = stats.retweetsToDelete;
    }
  });
  return previewChain;
};

const schedulePreview = () => {
  // Keep showing the last count until the new one arrives
  if (previewTimer) {
    clearTimeout(previewTimer);
  }
  previewTimer = setTimeout(() => {
    previewTimer = null;
    refreshPreview();
  }, PREVIEW_DEBOUNCE_MS);
};

// Ticking a filter puts the cursor in its text box, and clearing the text
// unticks the filter again, so a ticked filter never sits there empty
const tweetsFilterInput = ref<HTMLInputElement | null>(null);
const retweetsFilterInput = ref<HTMLInputElement | null>(null);

const filterToggled = async (
  enabled: boolean,
  input: HTMLInputElement | null,
) => {
  schedulePreview();
  if (enabled) {
    await nextTick();
    input?.focus();
  }
};

watch(deleteTweetsFilterText, (text, previous) => {
  if (
    deleteTweetsFilterEnabled.value &&
    isEmptyContainsFilterText(text) &&
    !isEmptyContainsFilterText(previous)
  ) {
    deleteTweetsFilterEnabled.value = false;
    schedulePreview();
  }
});
watch(deleteRetweetsFilterText, (text, previous) => {
  if (
    deleteRetweetsFilterEnabled.value &&
    isEmptyContainsFilterText(text) &&
    !isEmptyContainsFilterText(previous)
  ) {
    deleteRetweetsFilterEnabled.value = false;
    schedulePreview();
  }
});

const previewText = (count: number | null): string => {
  if (count === null) {
    return "";
  }
  if (count === 0) {
    return t("wizard.containsFilterPreviewNone");
  }
  if (count === 1) {
    return t("wizard.containsFilterPreviewOne");
  }
  return t("wizard.containsFilterPreview", {
    count: count.toLocaleString(),
  });
};

const showTweetsPreview = computed(
  () =>
    deleteTweets.value &&
    deleteTweetsFilterEnabled.value &&
    !isEmptyContainsFilterText(deleteTweetsFilterText.value) &&
    !containsFilterHasTooManyWildcards(deleteTweetsFilterText.value),
);
const showRetweetsPreview = computed(
  () =>
    deleteRetweets.value &&
    deleteRetweetsFilterEnabled.value &&
    !isEmptyContainsFilterText(deleteRetweetsFilterText.value) &&
    !containsFilterHasTooManyWildcards(deleteRetweetsFilterText.value),
);

// Custom next handler
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "delete");
  emit("setState", State.WizardReview);
};

// Custom back handler
const backClicked = async () => {
  emit("setState", State.WizardDashboard);
};

// A ticked "only if they contain" filter with no text would match everything,
// so it must be filled in (or unticked) before continuing
const tweetsFilterMissingText = computed(
  () =>
    deleteTweets.value &&
    deleteTweetsFilterEnabled.value &&
    isEmptyContainsFilterText(deleteTweetsFilterText.value),
);
const retweetsFilterMissingText = computed(
  () =>
    deleteRetweets.value &&
    deleteRetweetsFilterEnabled.value &&
    isEmptyContainsFilterText(deleteRetweetsFilterText.value),
);
const tweetsFilterTooManyWildcards = computed(
  () =>
    deleteTweets.value &&
    deleteTweetsFilterEnabled.value &&
    containsFilterHasTooManyWildcards(deleteTweetsFilterText.value),
);
const retweetsFilterTooManyWildcards = computed(
  () =>
    deleteRetweets.value &&
    deleteRetweetsFilterEnabled.value &&
    containsFilterHasTooManyWildcards(deleteRetweetsFilterText.value),
);

// Check if any delete option is selected
const hasValidSelection = computed(() => {
  if (
    tweetsFilterMissingText.value ||
    retweetsFilterMissingText.value ||
    tweetsFilterTooManyWildcards.value ||
    retweetsFilterTooManyWildcards.value
  ) {
    return false;
  }
  return (
    (hasSomeData.value &&
      (deleteTweets.value ||
        deleteRetweets.value ||
        deleteLikes.value ||
        deleteBookmarks.value ||
        unfollowEveryone.value)) ||
    (!hasSomeData.value && unfollowEveryone.value)
  );
});

// Update proceed state when selection changes
const updateProceedState = () => {
  setProceedEnabled(hasValidSelection.value);
};

const loadSettings = async () => {
  console.log("XWizardDeleteOptionsPage", "loadSettings");
  setLoading(true);
  try {
    const account = await window.electron.database.getAccount(
      props.model.account?.id,
    );
    if (account && account.xAccount) {
      deleteTweets.value = account.xAccount.deleteTweets;
      deleteTweetsDaysOld.value = account.xAccount.deleteTweetsDaysOld;
      deleteTweetsDaysOldEnabled.value =
        account.xAccount.deleteTweetsDaysOldEnabled;
      deleteTweetsRetweetsThresholdEnabled.value =
        account.xAccount.deleteTweetsRetweetsThresholdEnabled;
      deleteTweetsRetweetsThreshold.value =
        account.xAccount.deleteTweetsRetweetsThreshold;
      deleteTweetsLikesThresholdEnabled.value =
        account.xAccount.deleteTweetsLikesThresholdEnabled;
      deleteTweetsLikesThreshold.value =
        account.xAccount.deleteTweetsLikesThreshold;
      deleteRetweets.value = account.xAccount.deleteRetweets;
      deleteRetweetsDaysOldEnabled.value =
        account.xAccount.deleteRetweetsDaysOldEnabled;
      deleteRetweetsDaysOld.value = account.xAccount.deleteRetweetsDaysOld;
      // A filter saved as ticked with no text means nothing, so load it as off
      deleteTweetsFilterText.value = account.xAccount.deleteTweetsFilterText;
      deleteTweetsFilterEnabled.value =
        account.xAccount.deleteTweetsFilterEnabled &&
        !isEmptyContainsFilterText(deleteTweetsFilterText.value);
      deleteRetweetsFilterText.value =
        account.xAccount.deleteRetweetsFilterText;
      deleteRetweetsFilterEnabled.value =
        account.xAccount.deleteRetweetsFilterEnabled &&
        !isEmptyContainsFilterText(deleteRetweetsFilterText.value);
      deleteLikes.value = account.xAccount.deleteLikes;
      deleteBookmarks.value = account.xAccount.deleteBookmarks;
      unfollowEveryone.value = account.xAccount.unfollowEveryone;
    }

    // Should delete tweets show more options?
    if (
      deleteTweets.value &&
      (deleteTweetsDaysOldEnabled.value ||
        deleteTweetsRetweetsThresholdEnabled.value ||
        deleteTweetsLikesThresholdEnabled.value ||
        deleteTweetsFilterEnabled.value)
    ) {
      deleteTweetsShowMore.value = true;
    }

    // Should delete retweets show more options?
    if (
      deleteRetweets.value &&
      (deleteRetweetsDaysOldEnabled.value || deleteRetweetsFilterEnabled.value)
    ) {
      deleteRetweetsShowMore.value = true;
    }

    updateProceedState();
  } finally {
    setLoading(false);
  }

  if (showTweetsPreview.value || showRetweetsPreview.value) {
    await refreshPreview();
  }
};

const saveSettings = async () => {
  console.log("XWizardDeleteOptionsPage", "saveSettings");
  setLoading(true);
  try {
    await persistSettings();
    emit("updateAccount");
  } finally {
    setLoading(false);
  }
};

// Write the current settings to the account without telling the parent, so
// the preview can re-count on every change without reloading the wizard
const persistSettings = async () => {
  if (!props.model.account) {
    console.error(
      "XWizardDeleteOptionsPage",
      "persistSettings",
      "account is null",
    );
    return;
  }

  const account = await window.electron.database.getAccount(
    props.model.account?.id,
  );
  if (account && account.xAccount) {
    account.xAccount.saveMyData = false;
    account.xAccount.deleteMyData = true;
    account.xAccount.archiveMyData = false;

    account.xAccount.deleteTweets = deleteTweets.value;
    account.xAccount.deleteTweetsDaysOldEnabled =
      deleteTweetsDaysOldEnabled.value;
    account.xAccount.deleteTweetsDaysOld = deleteTweetsDaysOld.value;
    account.xAccount.deleteTweetsRetweetsThresholdEnabled =
      deleteTweetsRetweetsThresholdEnabled.value;
    account.xAccount.deleteTweetsRetweetsThreshold =
      deleteTweetsRetweetsThreshold.value;
    account.xAccount.deleteTweetsLikesThresholdEnabled =
      deleteTweetsLikesThresholdEnabled.value;
    account.xAccount.deleteTweetsLikesThreshold =
      deleteTweetsLikesThreshold.value;
    account.xAccount.deleteRetweets = deleteRetweets.value;
    account.xAccount.deleteRetweetsDaysOldEnabled =
      deleteRetweetsDaysOldEnabled.value;
    account.xAccount.deleteRetweetsDaysOld = deleteRetweetsDaysOld.value;
    account.xAccount.deleteTweetsFilterEnabled =
      deleteTweetsFilterEnabled.value;
    account.xAccount.deleteTweetsFilterText =
      deleteTweetsFilterText.value.trim();
    account.xAccount.deleteRetweetsFilterEnabled =
      deleteRetweetsFilterEnabled.value;
    account.xAccount.deleteRetweetsFilterText =
      deleteRetweetsFilterText.value.trim();
    account.xAccount.deleteLikes = deleteLikes.value;
    account.xAccount.deleteBookmarks = deleteBookmarks.value;
    account.xAccount.unfollowEveryone = unfollowEveryone.value;

    await window.electron.database.saveAccount(JSON.stringify(account));
  }
};

onMounted(async () => {
  hasSomeData.value = await xHasSomeData(props.model.account.id);

  await loadSettings();

  if (!hasSomeData.value) {
    deleteTweets.value = false;
    deleteRetweets.value = false;
    deleteLikes.value = false;
  }
});

onUnmounted(() => {
  if (previewTimer) {
    clearTimeout(previewTimer);
  }
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
          <h2>{{ t("wizard.deleteFromX") }}</h2>
          <p class="text-muted">
            {{ t("wizard.deleteFromXDescription") }}
          </p>
        </div>

        <XLastImportOrBuildComponent
          :account-i-d="model.account.id"
          :show-button="true"
          :show-no-data-warning="true"
          :button-text="t('wizard.buildYourLocalDatabase')"
          :button-state="State.WizardDatabase"
          @set-state="emit('setState', $event)"
        />

        <form @submit.prevent>
          <!-- deleteTweets -->
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="form-check">
                <input
                  id="deleteTweets"
                  v-model="deleteTweets"
                  type="checkbox"
                  class="form-check-input"
                  :disabled="!hasSomeData"
                  @change="updateProceedState"
                />
                <label
                  class="form-check-label mr-1 text-nowrap"
                  for="deleteTweets"
                >
                  {{ t("wizard.deleteMyTweets") }}
                </label>
                <span class="ms-2 text-muted">{{
                  t("wizard.recommended")
                }}</span>
                <button
                  class="btn btn-sm btn-link"
                  @click="deleteTweetsShowMoreClicked"
                >
                  {{ deleteTweetsShowMoreButtonText }}
                </button>
              </div>
            </div>
            <div v-if="deleteTweetsShowMore" class="indent">
              <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center flex-nowrap">
                  <div class="form-check">
                    <input
                      id="deleteTweetsDaysOldEnabled"
                      v-model="deleteTweetsDaysOldEnabled"
                      type="checkbox"
                      class="form-check-input"
                      :disabled="!deleteTweets || !hasSomeData"
                    />
                    <label
                      class="form-check-label mr-1 text-nowrap"
                      for="deleteTweetsDaysOldEnabled"
                    >
                      {{ t("wizard.olderThan") }}
                    </label>
                  </div>
                  <div class="d-flex align-items-center">
                    <label
                      class="form-check-label mr-1 sr-only"
                      for="deleteTweetsDaysOld"
                    >
                      {{ t("wizard.days") }}
                    </label>
                    <div class="input-group flex-nowrap">
                      <input
                        id="deleteTweetsDaysOld"
                        v-model="deleteTweetsDaysOld"
                        type="text"
                        class="form-control form-short small"
                        :disabled="
                          !deleteTweets ||
                          !deleteTweetsDaysOldEnabled ||
                          !hasSomeData
                        "
                      />
                      <div class="input-group-append">
                        <span class="input-group-text small">{{
                          t("wizard.days")
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
              <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center flex-nowrap">
                  <div class="form-check">
                    <input
                      id="deleteTweetsRetweetsThresholdEnabled"
                      v-model="deleteTweetsRetweetsThresholdEnabled"
                      type="checkbox"
                      class="form-check-input"
                      :disabled="!deleteTweets || !hasSomeData"
                    />
                    <label
                      class="form-check-label mr-1 text-nowrap"
                      for="deleteTweetsRetweetsThresholdEnabled"
                    >
                      {{ t("wizard.unlessTheyHaveAtLeast") }}
                    </label>
                  </div>
                  <div class="d-flex align-items-center">
                    <label
                      class="form-check-label mr-1 sr-only"
                      for="deleteTweetsRetweetsThreshold"
                    >
                      {{ t("review.retweets") }}
                    </label>
                    <div class="input-group flex-nowrap">
                      <input
                        id="deleteTweetsRetweetsThreshold"
                        v-model="deleteTweetsRetweetsThreshold"
                        type="text"
                        class="form-control form-short small"
                        :disabled="
                          !deleteTweets ||
                          !deleteTweetsRetweetsThresholdEnabled ||
                          !hasSomeData
                        "
                      />
                      <div class="input-group-append">
                        <span class="input-group-text small">{{
                          t("review.retweets")
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
              <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center flex-nowrap">
                  <div class="form-check">
                    <input
                      id="deleteTweetsLikesThresholdEnabled"
                      v-model="deleteTweetsLikesThresholdEnabled"
                      type="checkbox"
                      class="form-check-input"
                      :disabled="!deleteTweets || !hasSomeData"
                    />
                    <label
                      class="form-check-label mr-1 text-nowrap"
                      for="deleteTweetsLikesThresholdEnabled"
                    >
                      {{ t("wizard.orAtLeast") }}
                    </label>
                  </div>
                  <div class="d-flex align-items-center">
                    <label
                      class="form-check-label mr-1 sr-only"
                      for="deleteTweetsLikesThreshold"
                    >
                      {{ t("review.likes") }}
                    </label>
                    <div class="input-group flex-nowrap">
                      <input
                        id="deleteTweetsLikesThreshold"
                        v-model="deleteTweetsLikesThreshold"
                        type="text"
                        class="form-control form-short small"
                        :disabled="
                          !deleteTweets || !deleteTweetsLikesThresholdEnabled
                        "
                      />
                      <div class="input-group-append">
                        <span class="input-group-text small">{{
                          t("review.likes")
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
              <div
                class="filter-row d-flex align-items-center justify-content-between"
              >
                <div class="d-flex align-items-center flex-nowrap">
                  <div class="form-check">
                    <input
                      id="deleteTweetsFilterEnabled"
                      v-model="deleteTweetsFilterEnabled"
                      type="checkbox"
                      class="form-check-input"
                      :disabled="!deleteTweets || !hasSomeData"
                      @change="
                        filterToggled(
                          deleteTweetsFilterEnabled,
                          tweetsFilterInput,
                        )
                      "
                    />
                    <label
                      class="form-check-label mr-1 text-nowrap"
                      for="deleteTweetsFilterEnabled"
                    >
                      {{ t("wizard.onlyIfTheyContain") }}
                    </label>
                  </div>
                  <div class="d-flex align-items-center">
                    <input
                      id="deleteTweetsFilterText"
                      ref="tweetsFilterInput"
                      v-model="deleteTweetsFilterText"
                      :aria-label="t('wizard.onlyIfTheyContain')"
                      type="text"
                      class="form-control form-filter small"
                      :placeholder="t('wizard.containsFilterPlaceholder')"
                      :disabled="
                        !deleteTweets ||
                        !deleteTweetsFilterEnabled ||
                        !hasSomeData
                      "
                      @input="schedulePreview"
                    />
                  </div>
                </div>
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
              <div v-if="tweetsFilterMissingText" class="indent filter-preview">
                <small
                  id="deleteTweetsFilterMissing"
                  class="form-text text-muted"
                  >{{ t("wizard.containsFilterMissingText") }}</small
                >
              </div>
              <div
                v-if="tweetsFilterTooManyWildcards"
                class="indent filter-preview"
              >
                <small
                  id="deleteTweetsFilterTooManyWildcards"
                  class="form-text text-muted"
                  >{{
                    t("wizard.containsFilterTooManyWildcards", {
                      max: MAX_CONTAINS_FILTER_WILDCARDS,
                    })
                  }}</small
                >
              </div>
              <div v-if="showTweetsPreview" class="indent filter-preview">
                <small
                  id="deleteTweetsFilterPreview"
                  class="form-text text-muted"
                >
                  <span class="d-block">{{
                    previewText(tweetsMatchCount)
                  }}</span>
                  <span v-if="tweetsMatchCount" class="d-block">{{
                    t("wizard.containsFilterRateLimitNote")
                  }}</span>
                  <span class="d-block">{{
                    t("wizard.containsFilterWildcardHint")
                  }}</span>
                </small>
              </div>
            </div>
          </div>

          <!-- deleteRetweets -->
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="form-check">
                <input
                  id="deleteRetweets"
                  v-model="deleteRetweets"
                  type="checkbox"
                  class="form-check-input"
                  :disabled="!hasSomeData"
                  @change="updateProceedState"
                />
                <label
                  class="form-check-label mr-1 text-nowrap"
                  for="deleteRetweets"
                >
                  {{ t("wizard.deleteMyRetweets") }}
                </label>
                <span class="ms-2 text-muted">{{
                  t("wizard.recommended")
                }}</span>
                <button
                  class="btn btn-sm btn-link"
                  @click="deleteRetweetsShowMoreClicked"
                >
                  {{ deleteRetweetsShowMoreButtonText }}
                </button>
              </div>
            </div>
            <div v-if="deleteRetweetsShowMore" class="indent">
              <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center flex-nowrap">
                  <div class="form-check">
                    <input
                      id="deleteRetweetsDaysOldEnabled"
                      v-model="deleteRetweetsDaysOldEnabled"
                      type="checkbox"
                      class="form-check-input"
                      :disabled="!deleteRetweets || !hasSomeData"
                    />
                    <label
                      class="form-check-label mr-1 text-nowrap"
                      for="deleteRetweetsDaysOldEnabled"
                    >
                      {{ t("wizard.olderThan") }}
                    </label>
                  </div>
                  <div class="d-flex align-items-center">
                    <label
                      class="form-check-label mr-1 sr-only"
                      for="deleteRetweetsDaysOld"
                    >
                      {{ t("wizard.days") }}
                    </label>
                    <div class="input-group flex-nowrap">
                      <input
                        id="deleteRetweetsDaysOld"
                        v-model="deleteRetweetsDaysOld"
                        type="text"
                        class="form-control form-short small"
                        :disabled="
                          !deleteRetweets || !deleteRetweetsDaysOldEnabled
                        "
                      />
                      <div class="input-group-append">
                        <span class="input-group-text small">{{
                          t("wizard.days")
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
              <div
                class="filter-row d-flex align-items-center justify-content-between"
              >
                <div class="d-flex align-items-center flex-nowrap">
                  <div class="form-check">
                    <input
                      id="deleteRetweetsFilterEnabled"
                      v-model="deleteRetweetsFilterEnabled"
                      type="checkbox"
                      class="form-check-input"
                      :disabled="!deleteRetweets || !hasSomeData"
                      @change="
                        filterToggled(
                          deleteRetweetsFilterEnabled,
                          retweetsFilterInput,
                        )
                      "
                    />
                    <label
                      class="form-check-label mr-1 text-nowrap"
                      for="deleteRetweetsFilterEnabled"
                    >
                      {{ t("wizard.onlyIfTheyContain") }}
                    </label>
                  </div>
                  <div class="d-flex align-items-center">
                    <input
                      id="deleteRetweetsFilterText"
                      ref="retweetsFilterInput"
                      v-model="deleteRetweetsFilterText"
                      :aria-label="t('wizard.onlyIfTheyContain')"
                      type="text"
                      class="form-control form-filter small"
                      :placeholder="t('wizard.containsFilterPlaceholder')"
                      :disabled="
                        !deleteRetweets ||
                        !deleteRetweetsFilterEnabled ||
                        !hasSomeData
                      "
                      @input="schedulePreview"
                    />
                  </div>
                </div>
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
              <div
                v-if="retweetsFilterMissingText"
                class="indent filter-preview"
              >
                <small
                  id="deleteRetweetsFilterMissing"
                  class="form-text text-muted"
                  >{{ t("wizard.containsFilterMissingText") }}</small
                >
              </div>
              <div
                v-if="retweetsFilterTooManyWildcards"
                class="indent filter-preview"
              >
                <small
                  id="deleteRetweetsFilterTooManyWildcards"
                  class="form-text text-muted"
                  >{{
                    t("wizard.containsFilterTooManyWildcards", {
                      max: MAX_CONTAINS_FILTER_WILDCARDS,
                    })
                  }}</small
                >
              </div>
              <div v-if="showRetweetsPreview" class="indent filter-preview">
                <small
                  id="deleteRetweetsFilterPreview"
                  class="form-text text-muted"
                >
                  <span class="d-block">{{
                    previewText(retweetsMatchCount)
                  }}</span>
                  <span v-if="retweetsMatchCount" class="d-block">{{
                    t("wizard.containsFilterRateLimitNote")
                  }}</span>
                  <span class="d-block">{{
                    t("wizard.containsFilterWildcardHint")
                  }}</span>
                </small>
              </div>
            </div>
          </div>

          <!-- unfollowEveryone -->
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="form-check">
                <input
                  id="unfollowEveryone"
                  v-model="unfollowEveryone"
                  type="checkbox"
                  class="form-check-input"
                  @change="updateProceedState"
                />
                <label
                  class="form-check-label mr-1 text-nowrap"
                  for="unfollowEveryone"
                >
                  {{ t("premium.unfollowEveryone") }}
                </label>
                <span class="ms-2 text-muted">{{
                  t("wizard.recommended")
                }}</span>
              </div>
              <span
                v-if="!userAuthenticated || !userPremium"
                class="premium badge badge-primary"
                >{{ t("wizard.premium") }}</span
              >
            </div>
          </div>

          <!-- deleteLikes -->
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="form-check">
                <input
                  id="deleteLikes"
                  v-model="deleteLikes"
                  type="checkbox"
                  class="form-check-input"
                  :disabled="!hasSomeData"
                  @change="updateProceedState"
                />
                <label
                  class="form-check-label mr-1 text-nowrap"
                  for="deleteLikes"
                >
                  {{ t("wizard.deleteMyLikes") }}
                </label>
              </div>
              <div class="d-flex align-items-center flex-nowrap">
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
            </div>
            <div class="indent">
              <small class="form-text text-muted">
                {{ t("wizard.likesDescription") }}
                <a
                  href="#"
                  @click="
                    openURL('https://docs.cyd.social/docs/x/tips/ghost-likes')
                  "
                >
                  {{ t("wizard.readMore") }}</a
                >.
              </small>
            </div>
          </div>

          <!-- deleteBookmarks -->
          <div class="mb-3">
            <div class="d-flex align-items-center justify-content-between">
              <div class="form-check">
                <input
                  id="deleteBookmarks"
                  v-model="deleteBookmarks"
                  type="checkbox"
                  class="form-check-input"
                  @change="updateProceedState"
                />
                <label
                  class="form-check-label mr-1 text-nowrap"
                  for="deleteBookmarks"
                >
                  {{ t("wizard.deleteMyBookmarks") }}
                </label>
              </div>
              <div class="d-flex align-items-center flex-nowrap">
                <span
                  v-if="!userAuthenticated || !userPremium"
                  class="premium badge badge-primary"
                  >{{ t("wizard.premium") }}</span
                >
              </div>
            </div>
            <div class="indent">
              <small class="form-text text-muted">
                {{ t("wizard.bookmarksDescription") }}
              </small>
            </div>
          </div>

          <XDirectMessagesWithdrawnComponent />
        </form>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped>
.form-short {
  width: 55px;
}

.form-filter {
  width: 180px;
}

/* Keep the preview line's height while the count is being fetched so the
   options below don't jump around as you type */
.filter-preview {
  min-height: 1.6rem;
  padding-top: 0.4rem;
  padding-bottom: 0.5rem;
}

/* The other option rows sit flush against each other, but the filter row's
   taller text box needs room so its border doesn't touch the row above */
.filter-row {
  margin-top: 0.6rem;
}

.small {
  font-size: 0.9rem;
}
</style>
