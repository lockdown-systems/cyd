<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  XViewModel,
  State,
  tombstoneUpdateBioCreditCydText,
} from "../../../view_models/XViewModel";
import { getBreadcrumbIcon, openURL, getJobsType } from "../../../util";

const { t } = useI18n();
import {
  XDeleteReviewStats,
  emptyXDeleteReviewStats,
  XMigrateTweetCounts,
  emptyXMigrateTweetCounts,
} from "../../../../../shared_types";
import { xHasSomeData } from "../../../util_x";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import type { ButtonInfo } from "../../../types";
import { useWizardPage } from "../../../composables/useWizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import LoadingComponent from "../../shared_components/LoadingComponent.vue";
import AlertStayAwake from "../../shared_components/AlertStayAwake.vue";
import XTombstoneBannerComponent from "../components/XTombstoneBannerComponent.vue";
import {
  TombstoneBannerBackground,
  TombstoneBannerSocialIcons,
} from "../../../types_x";

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
  "startJobs",
]);

// Use wizard page composable
const { isLoading, setLoading } = useWizardPage();

const jobsType = ref("");
const deleteReviewStats = ref<XDeleteReviewStats>(emptyXDeleteReviewStats());
const hasSomeData = ref(false);
const tweetCounts = ref<XMigrateTweetCounts>(emptyXMigrateTweetCounts());

const tombstoneUpdateBannerBackground = ref<TombstoneBannerBackground>(
  TombstoneBannerBackground.Night,
);
const tombstoneUpdateBannerSocialIcons = ref<TombstoneBannerSocialIcons>(
  TombstoneBannerSocialIcons.None,
);

const deleteTweetsCountNotArchived = ref(0);

// Custom next handler
const nextClicked = async () => {
  emit("startJobs");
};

// Custom back handler
const backClicked = async () => {
  if (jobsType.value == "delete") {
    emit("setState", State.WizardDeleteOptions);
  } else if (jobsType.value == "save") {
    emit("setState", State.WizardBuildOptions);
  } else if (jobsType.value == "archive") {
    emit("setState", State.WizardArchiveOptions);
  } else if (
    jobsType.value == "migrateBluesky" ||
    jobsType.value == "migrateBlueskyDelete"
  ) {
    emit("setState", State.WizardMigrateToBluesky);
  } else if (jobsType.value == "tombstone") {
    emit("setState", State.WizardTombstone);
  } else {
    console.error("Unknown review type:", jobsType.value);
    await window.electron.showError(t("facebook.unknownReviewType"));
  }
};

const archiveClicked = async () => {
  emit("setState", State.WizardArchiveOptions);
};

// Dynamic button labels
const backButtonLabel = computed(() => {
  if (jobsType.value == "delete") return t("review.backToDeleteOptions");
  if (jobsType.value == "save") return t("review.backToBuildOptions");
  if (jobsType.value == "archive") return t("review.backToArchiveOptions");
  if (
    jobsType.value == "migrateBluesky" ||
    jobsType.value == "migrateBlueskyDelete"
  )
    return t("review.backToMigrateOptions");
  if (jobsType.value == "tombstone") return t("review.backToTombstoneOptions");
  return "";
});

const nextButtonLabel = computed(() => {
  if (jobsType.value == "save") return t("review.buildDatabase");
  if (jobsType.value == "archive") return t("review.startArchiving");
  if (jobsType.value == "delete" || jobsType.value == "migrateBlueskyDelete")
    return t("review.startDeleting");
  if (jobsType.value == "migrateBluesky") return t("review.startMigrating");
  if (jobsType.value == "tombstone") return t("review.updateProfile");
  return "";
});

// Dynamic breadcrumb buttons
const breadcrumbButtons = computed(() => {
  const buttons: ButtonInfo[] = [
    {
      label: t("wizard.dashboard"),
      action: () => emit("setState", State.WizardDashboard),
      icon: "fa-solid fa-house",
    },
  ];

  const localDatabaseButton: ButtonInfo = {
    label: t("review.localDatabase"),
    action: () => emit("setState", State.WizardDatabase),
    icon: getBreadcrumbIcon("database"),
  };

  if (jobsType.value == "delete") {
    buttons.push({
      label: t("review.deleteOptions"),
      action: () => emit("setState", State.WizardDeleteOptions),
      icon: getBreadcrumbIcon("delete"),
    });
  } else if (jobsType.value == "save") {
    buttons.push(localDatabaseButton);
    buttons.push({
      label: t("review.buildOptions"),
      action: () => emit("setState", State.WizardBuildOptions),
      icon: getBreadcrumbIcon("build"),
    });
  } else if (jobsType.value == "archive") {
    buttons.push(localDatabaseButton);
    buttons.push({
      label: t("review.archiveOptions"),
      action: () => emit("setState", State.WizardArchiveOptions),
      icon: getBreadcrumbIcon("build"),
    });
  } else if (
    jobsType.value == "migrateBluesky" ||
    jobsType.value == "migrateBlueskyDelete"
  ) {
    buttons.push({
      label: t("review.migrateToBlueskyOptions"),
      action: () => emit("setState", State.WizardMigrateToBluesky),
      icon: getBreadcrumbIcon("bluesky"),
    });
  } else if (jobsType.value == "tombstone") {
    buttons.push({
      label: t("review.tombstoneOptions"),
      action: () => emit("setState", State.WizardTombstone),
      icon: getBreadcrumbIcon("tombstone"),
    });
  }

  return buttons;
});

// Next button disabled state
const isNextDisabled = computed(() => {
  return (
    !(
      props.model.account?.xAccount?.archiveTweets ||
      props.model.account?.xAccount?.archiveLikes ||
      props.model.account?.xAccount?.archiveBookmarks ||
      props.model.account?.xAccount?.archiveDMs
    ) &&
    (jobsType.value == "save" ||
      jobsType.value == "archive" ||
      jobsType.value == "delete")
  );
});

onMounted(async () => {
  setLoading(true);

  jobsType.value = getJobsType(props.model.account.id) || "";

  deleteReviewStats.value = await window.electron.X.getDeleteReviewStats(
    props.model.account.id,
  );
  hasSomeData.value = await xHasSomeData(props.model.account.id);
  tweetCounts.value =
    (await window.electron.X.blueskyGetTweetCounts(props.model.account.id)) ||
    emptyXMigrateTweetCounts();

  if (
    jobsType.value == "delete" &&
    props.model.account?.xAccount?.deleteTweets
  ) {
    deleteTweetsCountNotArchived.value =
      await window.electron.X.deleteTweetsCountNotArchived(
        props.model.account?.id,
        false,
      );
  }

  if (jobsType.value == "tombstone") {
    if (
      props.model.account?.xAccount?.tombstoneUpdateBannerBackground ==
      "morning"
    ) {
      tombstoneUpdateBannerBackground.value = TombstoneBannerBackground.Morning;
    } else {
      tombstoneUpdateBannerBackground.value = TombstoneBannerBackground.Night;
    }

    if (
      props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons ==
      "bluesky"
    ) {
      tombstoneUpdateBannerSocialIcons.value =
        TombstoneBannerSocialIcons.Bluesky;
    } else if (
      props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons ==
      "mastodon"
    ) {
      tombstoneUpdateBannerSocialIcons.value =
        TombstoneBannerSocialIcons.Mastodon;
    } else if (
      props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons ==
      "bluesky-mastodon"
    ) {
      tombstoneUpdateBannerSocialIcons.value =
        TombstoneBannerSocialIcons.BlueskyMastodon;
    } else if (
      props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons ==
      "mastodon-bluesky"
    ) {
      tombstoneUpdateBannerSocialIcons.value =
        TombstoneBannerSocialIcons.MastodonBluesky;
    } else {
      tombstoneUpdateBannerSocialIcons.value = TombstoneBannerSocialIcons.None;
    }
  }

  setLoading(false);
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: breadcrumbButtons,
      label: t('wizard.review'),
      icon: getBreadcrumbIcon('review'),
    }"
    :button-props="{
      backButtons: [
        {
          label: backButtonLabel,
          action: backClicked,
          disabled: isLoading,
        },
      ],
      nextButtons: [
        {
          label: nextButtonLabel,
          action: nextClicked,
          disabled: isLoading || isNextDisabled,
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
            <div v-if="jobsType == 'save'">
              <h3>
                <i class="fa-solid fa-floppy-disk me-1" />
                {{ t("wizard.buildLocalDatabase") }}
              </h3>
              <ul>
                <li v-if="model.account?.xAccount?.archiveTweets">
                  {{ t("wizard.saveTweets") }}
                  <ul>
                    <li v-if="model.account?.xAccount?.archiveTweetsHTML">
                      {{ t("wizard.saveTweetsHTML") }}
                    </li>
                  </ul>
                </li>
                <li v-if="model.account?.xAccount?.archiveLikes">
                  {{ t("wizard.saveLikes") }}
                </li>
                <li v-if="model.account?.xAccount?.archiveBookmarks">
                  {{ t("wizard.saveBookmarks") }}
                </li>
                <li v-if="model.account?.xAccount?.archiveDMs">
                  {{ t("wizard.saveDirectMessages") }}
                </li>
              </ul>
            </div>

            <div v-if="jobsType == 'archive'">
              <h3>
                <i class="fa-solid fa-floppy-disk me-1" />
                {{ t("wizard.archiveMyData") }}
              </h3>
              <ul>
                <li v-if="model.account?.xAccount?.archiveTweetsHTML">
                  {{ t("wizard.saveTweetsHTML") }}
                </li>
                <li v-if="model.account?.xAccount?.archiveBookmarks">
                  {{ t("wizard.saveBookmarks") }}
                </li>
                <li v-if="model.account?.xAccount?.archiveDMs">
                  {{ t("wizard.saveDirectMessages") }}
                </li>
              </ul>
            </div>

            <div v-if="jobsType == 'delete'">
              <h3>
                <i class="fa-solid fa-fire me-1" />
                {{ t("review.deleteMyData") }}
              </h3>
              <ul>
                <li v-if="hasSomeData && model.account?.xAccount?.deleteTweets">
                  <b
                    >{{ deleteReviewStats.tweetsToDelete.toLocaleString() }}
                    {{ t("review.tweets") }}</b
                  >
                  <span
                    v-if="model.account?.xAccount?.deleteTweetsDaysOldEnabled"
                  >
                    {{
                      t("review.thatAreOlderThan", {
                        days: model.account?.xAccount?.deleteTweetsDaysOld,
                      })
                    }}
                  </span>
                  <span
                    v-if="
                      model.account?.xAccount
                        ?.deleteTweetsRetweetsThresholdEnabled &&
                      !model.account?.xAccount
                        ?.deleteTweetsLikesThresholdEnabled
                    "
                  >
                    {{
                      t("review.unlessTheyHaveAtLeast", {
                        count:
                          model.account?.xAccount
                            ?.deleteTweetsRetweetsThreshold,
                        type: t("review.retweets"),
                      })
                    }}
                  </span>
                  <span
                    v-if="
                      !model.account?.xAccount
                        ?.deleteTweetsRetweetsThresholdEnabled &&
                      model.account?.xAccount?.deleteTweetsLikesThresholdEnabled
                    "
                  >
                    {{
                      t("review.unlessTheyHaveAtLeast", {
                        count:
                          model.account?.xAccount?.deleteTweetsLikesThreshold,
                        type: t("review.likes"),
                      })
                    }}
                  </span>
                  <span
                    v-if="
                      model.account?.xAccount
                        ?.deleteTweetsRetweetsThresholdEnabled &&
                      model.account?.xAccount?.deleteTweetsLikesThresholdEnabled
                    "
                  >
                    {{
                      t("review.unlessTheyHaveAtLeastOr", {
                        retweets:
                          model.account?.xAccount
                            ?.deleteTweetsRetweetsThreshold,
                        likes:
                          model.account?.xAccount?.deleteTweetsLikesThreshold,
                      })
                    }}
                  </span>
                  <div v-if="deleteTweetsCountNotArchived > 0">
                    <small class="text-form">
                      <i class="fa-solid fa-triangle-exclamation" />
                      <em>
                        <span
                          v-if="
                            deleteTweetsCountNotArchived ==
                            deleteReviewStats.tweetsToDelete
                          "
                        >
                          {{ t("review.haventSavedHTML") }}
                        </span>
                        <span v-else>
                          {{
                            t("review.haventSavedHTMLSome", {
                              count:
                                deleteTweetsCountNotArchived.toLocaleString(),
                            })
                          }}
                        </span>
                      </em>
                      <span>
                        {{ t("review.ifYouCare", { archiveLink: "" }) }}
                        <a href="#" @click="archiveClicked">{{
                          t("review.archiveYourTweets")
                        }}</a>
                        {{ t("review.beforeDeleteThem") }}
                      </span>
                    </small>
                  </div>
                </li>
                <li
                  v-if="hasSomeData && model.account?.xAccount?.deleteRetweets"
                >
                  <b
                    >{{ deleteReviewStats.retweetsToDelete.toLocaleString() }}
                    {{ t("review.retweets") }}</b
                  >
                  <span
                    v-if="model.account?.xAccount?.deleteRetweetsDaysOldEnabled"
                  >
                    {{
                      t("review.thatAreOlderThan", {
                        days: model.account?.xAccount?.deleteRetweetsDaysOld,
                      })
                    }}
                  </span>
                </li>
                <li v-if="hasSomeData && model.account?.xAccount?.deleteLikes">
                  <b
                    >{{ deleteReviewStats.likesToDelete.toLocaleString() }}
                    {{ t("review.likes") }}</b
                  >
                </li>
                <li
                  v-if="hasSomeData && model.account?.xAccount?.deleteBookmarks"
                >
                  <b
                    >{{ deleteReviewStats.bookmarksToDelete.toLocaleString() }}
                    {{ t("review.bookmarks") }}</b
                  >
                </li>
                <li v-if="model.account?.xAccount?.unfollowEveryone">
                  <b>{{ t("premium.unfollowEveryone") }}</b>
                </li>
                <li v-if="model.account?.xAccount?.deleteDMs">
                  <b>{{ t("review.allOfYourDirectMessages") }}</b>
                </li>
              </ul>
            </div>

            <div v-if="jobsType == 'migrateBluesky'">
              <h3>
                <i class="fa-brands fa-bluesky me-1" />
                {{ t("review.migrateToBluesky") }}
              </h3>
              <ul>
                <li>
                  {{
                    t("review.migrateTweets", {
                      count:
                        tweetCounts.toMigrateTweets.length.toLocaleString(),
                    })
                  }}
                </li>
              </ul>
            </div>

            <div v-if="jobsType == 'migrateBlueskyDelete'">
              <h3>
                <i class="fa-brands fa-bluesky me-1" />
                {{ t("review.deleteMigratedBlueskyPosts") }}
              </h3>
              <ul>
                <li>
                  {{
                    t("review.deletePostsFromBluesky", {
                      count:
                        tweetCounts.alreadyMigratedTweets.length.toLocaleString(),
                    })
                  }}
                </li>
              </ul>
            </div>

            <div v-if="jobsType == 'tombstone'">
              <h3>
                <i class="fa-solid fa-skull me-1" />
                {{ t("wizard.tombstone") }}
              </h3>
              <ul>
                <li v-if="model.account?.xAccount?.tombstoneUpdateBanner">
                  <div>{{ t("review.updateYourBanner") }}</div>
                  <XTombstoneBannerComponent
                    :update-banner="
                      model.account?.xAccount?.tombstoneUpdateBanner
                    "
                    :update-banner-background="tombstoneUpdateBannerBackground"
                    :update-banner-social-icons="
                      tombstoneUpdateBannerSocialIcons
                    "
                    :update-banner-show-text="
                      model.account?.xAccount?.tombstoneUpdateBannerShowText
                    "
                  />
                </li>
                <li v-if="model.account?.xAccount?.tombstoneUpdateBio">
                  <div>{{ t("review.updateYourBio") }}</div>
                  <p class="text-center text-muted small mb-1">
                    {{ t("review.bioPreview") }}
                  </p>
                  <p class="small">
                    {{ model.account?.xAccount?.tombstoneUpdateBioText }}
                    <span
                      v-if="
                        model.account?.xAccount?.tombstoneUpdateBioCreditCyd
                      "
                    >
                      {{ tombstoneUpdateBioCreditCydText }}
                    </span>
                  </p>
                </li>
                <li v-if="model.account?.xAccount?.tombstoneLockAccount">
                  {{ t("review.lockYourAccount") }}
                </li>
              </ul>
            </div>
          </form>

          <div
            v-if="
              jobsType == 'save' ||
              jobsType == 'archive' ||
              jobsType == 'delete'
            "
            class="alert alert-info mt-4"
            role="alert"
          >
            <p class="fw-bold mb-0">
              X restricts how fast you can access your data using
              <span class="fst-italic">rate limits</span>.
            </p>
            <p class="alert-details mb-0">
              You might hit rate limits while Cyd works. Cyd will pause and wait
              for the rate limit to reset before continuing.
            </p>
          </div>

          <div
            v-if="
              jobsType == 'migrateBluesky' || jobsType == 'migrateBlueskyDelete'
            "
            class="alert alert-info mt-4"
            role="alert"
          >
            <p class="fw-bold mb-0">
              Bluesky restricts how fast you create or delete posts using
              <span class="fst-italic">rate limits</span>.
            </p>
            <p class="alert-details mb-0">
              You might hit rate limits while Cyd works. Cyd will pause and wait
              for the rate limit to reset before continuing.
              <a
                href="#"
                @click="
                  openURL(
                    'https://docs.bsky.app/docs/advanced-guides/rate-limits',
                  )
                "
                >{{ t("review.learnMore") }}</a
              >
            </p>
          </div>
          <AlertStayAwake />
        </template>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped></style>
