<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { XViewModel, State } from "../../view_models/XViewModel";
import { xHasSomeData } from "../../util_x";
import { getBreadcrumbIcon, openURL, setJobsType } from "../../util";

import XLastImportOrBuildComponent from "./XLastImportOrBuildComponent.vue";
import BreadcrumbsComponent from "../shared_components/BreadcrumbsComponent.vue";
import ButtonsComponent from "../shared_components/ButtonsComponent.vue";

// Props
const props = defineProps<{
  model: XViewModel;
  userAuthenticated: boolean;
  userPremium: boolean;
}>();

// Emits
const emit = defineEmits<{
  updateAccount: [];
  setState: [value: State];
}>();

// Buttons
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "delete");
  emit("setState", State.WizardReview);
};

// Show more
const deleteTweetsShowMore = ref(false);
const deleteTweetsShowMoreButtonText = computed(() =>
  deleteTweetsShowMore.value ? "Hide more options" : "Show more options",
);
const deleteTweetsShowMoreClicked = () => {
  deleteTweetsShowMore.value = !deleteTweetsShowMore.value;
};

const deleteRetweetsShowMore = ref(false);
const deleteRetweetsShowMoreButtonText = computed(() =>
  deleteRetweetsShowMore.value ? "Hide more options" : "Show more options",
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
const deleteLikes = ref(false);
const deleteBookmarks = ref(false);
const deleteDMs = ref(false);
const unfollowEveryone = ref(false);

const loadSettings = async () => {
  console.log("XWizardDeleteOptionsPage", "loadSettings");
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
    deleteLikes.value = account.xAccount.deleteLikes;
    deleteBookmarks.value = account.xAccount.deleteBookmarks;
    deleteDMs.value = account.xAccount.deleteDMs;
    unfollowEveryone.value = account.xAccount.unfollowEveryone;
  }

  // Should delete tweets show more options?
  if (
    deleteTweets.value &&
    (deleteTweetsDaysOldEnabled.value ||
      deleteTweetsRetweetsThresholdEnabled.value ||
      deleteTweetsLikesThresholdEnabled.value)
  ) {
    deleteTweetsShowMore.value = true;
  }

  // Should delete retweets show more options?
  if (deleteRetweets.value && deleteRetweetsDaysOldEnabled.value) {
    deleteRetweetsShowMore.value = true;
  }
};

const saveSettings = async () => {
  console.log("XWizardDeleteOptionsPage", "saveSettings");
  if (!props.model.account) {
    console.error(
      "XWizardDeleteOptionsPage",
      "saveSettings",
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
    account.xAccount.deleteLikes = deleteLikes.value;
    account.xAccount.deleteBookmarks = deleteBookmarks.value;
    account.xAccount.deleteDMs = deleteDMs.value;
    account.xAccount.unfollowEveryone = unfollowEveryone.value;

    await window.electron.database.saveAccount(JSON.stringify(account));
    emit("updateAccount");
  }
};

const hasSomeData = ref(false);

onMounted(async () => {
  await loadSettings();
  hasSomeData.value = await xHasSomeData(props.model.account.id);

  if (!hasSomeData.value) {
    deleteTweets.value = false;
    deleteRetweets.value = false;
    deleteLikes.value = false;
  }
});
</script>

<template>
  <div class="wizard-content">
    <BreadcrumbsComponent
      :buttons="[
        {
          label: 'Dashboard',
          action: () => emit('setState', State.WizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
      ]"
      label="Delete Options"
      :icon="getBreadcrumbIcon('delete')"
    />

    <div class="wizard-scroll-content">
      <div class="mb-4">
        <h2>Delete from X</h2>
        <p class="text-muted">
          Delete your data from X, except for what you want to keep.
        </p>
      </div>

      <XLastImportOrBuildComponent
        :account-i-d="model.account.id"
        :show-button="true"
        :show-no-data-warning="true"
        :button-text="'Build Your Local Database'"
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
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                for="deleteTweets"
              >
                Delete my tweets
              </label>
              <span class="ms-2 text-muted">(recommended)</span>
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
                    older than
                  </label>
                </div>
                <div class="d-flex align-items-center">
                  <label
                    class="form-check-label mr-1 sr-only"
                    for="deleteTweetsDaysOld"
                  >
                    days
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
                    unless they have at least
                  </label>
                </div>
                <div class="d-flex align-items-center">
                  <label
                    class="form-check-label mr-1 sr-only"
                    for="deleteTweetsRetweetsThreshold"
                  >
                    retweets
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
                      <span class="input-group-text small">retweets</span>
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
                    or at least
                  </label>
                </div>
                <div class="d-flex align-items-center">
                  <label
                    class="form-check-label mr-1 sr-only"
                    for="deleteTweetsLikesThreshold"
                  >
                    likes
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
                      <span class="input-group-text small">likes</span>
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
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                for="deleteRetweets"
              >
                Delete my retweets
              </label>
              <span class="ms-2 text-muted">(recommended)</span>
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
                    older than
                  </label>
                </div>
                <div class="d-flex align-items-center">
                  <label
                    class="form-check-label mr-1 sr-only"
                    for="deleteRetweetsDaysOld"
                  >
                    days
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

        <!-- unfollowEveryone -->
        <div class="mb-3">
          <div class="d-flex align-items-center justify-content-between">
            <div class="form-check">
              <input
                id="unfollowEveryone"
                v-model="unfollowEveryone"
                type="checkbox"
                class="form-check-input"
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                for="unfollowEveryone"
              >
                Unfollow everyone
              </label>
              <span class="ms-2 text-muted">(recommended)</span>
            </div>
            <span
              v-if="!userAuthenticated || !userPremium"
              class="premium badge badge-primary"
              >Premium</span
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
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                for="deleteLikes"
              >
                Delete my likes
              </label>
            </div>
            <div class="d-flex align-items-center flex-nowrap">
              <span
                v-if="!userAuthenticated || !userPremium"
                class="premium badge badge-primary"
                >Premium</span
              >
            </div>
          </div>
          <div class="indent">
            <small class="form-text text-muted">
              Likes are only visible to you on X. Cyd will delete all of the
              likes it can, but it can't delete
              <em>ghost likes</em>.
              <a
                href="#"
                @click="
                  openURL('https://docs.cyd.social/docs/x/tips/ghost-likes')
                "
              >
                Read more</a
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
              />
              <label
                class="form-check-label mr-1 text-nowrap"
                for="deleteBookmarks"
              >
                Delete my bookmarks
              </label>
            </div>
            <div class="d-flex align-items-center flex-nowrap">
              <span
                v-if="!userAuthenticated || !userPremium"
                class="premium badge badge-primary"
                >Premium</span
              >
            </div>
          </div>
          <div class="indent">
            <small class="form-text text-muted">
              Bookmarks are only visible to you on X.
            </small>
          </div>
        </div>

        <!-- deleteDMs -->
        <div class="mb-3">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
              <div class="form-check">
                <input
                  id="deleteDMs"
                  v-model="deleteDMs"
                  type="checkbox"
                  class="form-check-input"
                />
                <label
                  class="form-check-label mr-1 text-nowrap"
                  for="deleteDMs"
                >
                  Delete my direct messages
                </label>
              </div>
            </div>
            <span
              v-if="!userAuthenticated || !userPremium"
              class="premium badge badge-primary"
              >Premium</span
            >
          </div>
          <div class="indent">
            <small class="form-text text-muted">
              This will only delete DMs from your account. The people you've
              sent messages to will still have them unless they delete their DMs
              as well.
            </small>
          </div>
        </div>
      </form>
    </div>

    <ButtonsComponent
      :back-buttons="[
        {
          label: 'Back to Dashboard',
          action: () => emit('setState', State.WizardDashboard),
        },
      ]"
      :next-buttons="[
        {
          label: 'Continue to Review',
          action: nextClicked,
          disabled:
            (hasSomeData &&
              !(
                deleteTweets ||
                deleteRetweets ||
                deleteLikes ||
                deleteBookmarks ||
                unfollowEveryone ||
                deleteDMs
              )) ||
            (!hasSomeData && !(unfollowEveryone || deleteDMs)),
        },
      ]"
    />
  </div>
</template>

<style scoped>
.form-short {
  width: 55px;
}

.small {
  font-size: 0.9rem;
}
</style>
