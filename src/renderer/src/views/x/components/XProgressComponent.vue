<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import type { XProgress, XRateLimitInfo } from "../../../../../shared_types";
import XProgressErrorsOccuredComponent from "./XProgressErrorsOccuredComponent.vue";

const { t } = useI18n();

const intervalID = ref<number | null>(null);
const rateLimitSecondsLeft = ref<number | null>(null);

const props = defineProps<{
  progress: XProgress | null;
  rateLimitInfo: XRateLimitInfo | null;
  accountID: number;
}>();

const formatSeconds = (seconds: number | null) => {
  if (seconds === null) {
    return "";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes == 0) {
    return t("common.seconds", { count: remainingSeconds });
  }
  return t("common.minutes", { minutes, seconds: remainingSeconds });
};

onMounted(() => {
  // @ts-expect-error intervalID is a NodeJS.Interval, not a number
  intervalID.value = setInterval(() => {
    if (
      props.rateLimitInfo &&
      props.rateLimitInfo.isRateLimited &&
      props.rateLimitInfo.rateLimitReset
    ) {
      const rateLimitReset = props.rateLimitInfo.rateLimitReset;
      const currentUTCTimestamp = Math.floor(Date.now() / 1000);
      rateLimitSecondsLeft.value = rateLimitReset - currentUTCTimestamp;
      if (rateLimitSecondsLeft.value <= 0) {
        rateLimitSecondsLeft.value = 0;
      }
    }
  }, 1000);
});

onUnmounted(() => {
  if (intervalID.value) {
    clearInterval(intervalID.value);
  }
});
</script>

<template>
  <template v-if="progress">
    <div class="progress-wrapper">
      <!-- Login -->
      <template v-if="progress.currentJob == 'login'">
        <p>{{ t("jobs.login") }}</p>
      </template>

      <!-- Index tweets -->
      <template v-if="progress.currentJob == 'indexTweets'">
        <p>
          {{
            t("progress.savedTweetsAndRetweets", {
              tweets: progress.tweetsIndexed.toLocaleString(),
              retweets: progress.retweetsIndexed.toLocaleString(),
            })
          }}
          <span v-if="progress.unknownIndexed > 0" class="text-muted">
            {{
              t("progress.savedOtherTweets", {
                count: progress.unknownIndexed.toLocaleString(),
              })
            }}
          </span>
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isIndexTweetsFinished">
            {{ t("progress.savingComplete") }}
          </template>
        </p>
      </template>

      <!-- Index conversations -->
      <template v-if="progress.currentJob == 'indexConversations'">
        <p>
          {{
            t("progress.savedConversations", {
              count: progress.conversationsIndexed.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isIndexConversationsFinished">
            {{ t("progress.savingComplete") }}
          </template>
        </p>
      </template>

      <!-- Index messages -->
      <template v-if="progress.currentJob == 'indexMessages'">
        <p v-if="progress.totalConversations">
          {{
            t("progress.savedMessages", {
              messages: progress.messagesIndexed.toLocaleString(),
              conversationsIndexed:
                progress.conversationMessagesIndexed.toLocaleString(),
              totalConversations: progress.totalConversations.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isIndexMessagesFinished">
            {{ t("progress.savingComplete") }}
          </template>
        </p>
        <div
          v-if="progress.totalConversations"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${(progress.conversationMessagesIndexed / progress.totalConversations) * 100}%`,
              }"
              :aria-valuenow="
                (progress.conversationMessagesIndexed /
                  progress.totalConversations) *
                100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  (progress.conversationMessagesIndexed /
                    progress.totalConversations) *
                    100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Index likes -->
      <template v-if="progress.currentJob == 'indexLikes'">
        <p>
          {{
            t("progress.savedLikes", {
              count: progress.likesIndexed.toLocaleString(),
            })
          }}
          <span v-if="progress.unknownIndexed > 0" class="text-muted">
            {{
              t("progress.savedOtherTweets", {
                count: progress.unknownIndexed.toLocaleString(),
              })
            }}
          </span>
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isIndexLikesFinished">
            {{ t("progress.savingComplete") }}
          </template>
        </p>
      </template>

      <!-- Index bookmarks -->
      <template v-if="progress.currentJob == 'indexBookmarks'">
        <p>
          {{
            t("progress.savedBookmarks", {
              count: progress.bookmarksIndexed.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isIndexBookmarksFinished">
            {{ t("progress.savingComplete") }}
          </template>
        </p>
      </template>

      <!-- Archive Tweets -->
      <template v-if="progress.currentJob == 'archiveTweets'">
        <p>
          {{
            t("progress.savedTweetsAsHTML", {
              archived: progress.tweetsArchived.toLocaleString(),
              total: progress.totalTweetsToArchive.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isArchiveTweetsFinished">
            {{ t("progress.finishedSavingTweetsAsHTML") }}
          </template>
        </p>
        <div
          v-if="progress.totalTweetsToArchive"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${(progress.tweetsArchived / progress.totalTweetsToArchive) * 100}%`,
              }"
              :aria-valuenow="
                (progress.tweetsArchived / progress.totalTweetsToArchive) * 100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  (progress.tweetsArchived / progress.totalTweetsToArchive) *
                    100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Delete Tweets -->
      <template v-if="progress.currentJob == 'deleteTweets'">
        <p>
          {{
            t("progress.deletedTweets", {
              deleted: progress.tweetsDeleted.toLocaleString(),
              total: progress.totalTweetsToDelete.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
        </p>
        <div
          v-if="progress.totalTweetsToDelete"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${(progress.tweetsDeleted / progress.totalTweetsToDelete) * 100}%`,
              }"
              :aria-valuenow="
                (progress.tweetsDeleted / progress.totalTweetsToDelete) * 100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  (progress.tweetsDeleted / progress.totalTweetsToDelete) * 100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Delete Retweets -->
      <template v-if="progress.currentJob == 'deleteRetweets'">
        <p>
          {{
            t("progress.deletedRetweets", {
              deleted: progress.retweetsDeleted.toLocaleString(),
              total: progress.totalRetweetsToDelete.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
        </p>
        <div
          v-if="progress.totalRetweetsToDelete"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${(progress.retweetsDeleted / progress.totalRetweetsToDelete) * 100}%`,
              }"
              :aria-valuenow="
                (progress.retweetsDeleted / progress.totalRetweetsToDelete) *
                100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  (progress.retweetsDeleted / progress.totalRetweetsToDelete) *
                    100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Delete Likes -->
      <template v-if="progress.currentJob == 'deleteLikes'">
        <p>
          {{
            t("progress.deletedLikes", {
              deleted: progress.likesDeleted.toLocaleString(),
              total: progress.totalLikesToDelete.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
        </p>
        <div
          v-if="progress.totalLikesToDelete"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${(progress.likesDeleted / progress.totalLikesToDelete) * 100}%`,
              }"
              :aria-valuenow="
                (progress.likesDeleted / progress.totalLikesToDelete) * 100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  (progress.likesDeleted / progress.totalLikesToDelete) * 100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Delete Bookmarks -->
      <template v-if="progress.currentJob == 'deleteBookmarks'">
        <p>
          {{
            t("progress.deletedBookmarks", {
              deleted: progress.bookmarksDeleted.toLocaleString(),
              total: progress.totalBookmarksToDelete.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
        </p>
        <div
          v-if="progress.totalBookmarksToDelete"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${(progress.bookmarksDeleted / progress.totalBookmarksToDelete) * 100}%`,
              }"
              :aria-valuenow="
                (progress.bookmarksDeleted / progress.totalBookmarksToDelete) *
                100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  (progress.bookmarksDeleted /
                    progress.totalBookmarksToDelete) *
                    100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Delete DMs -->
      <template v-if="progress.currentJob == 'deleteDMs'">
        <p>
          {{
            t("progress.deletedConversations", {
              count: progress.conversationsDeleted.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isDeleteDMsFinished">
            {{ t("progress.finishedDeletingDMs") }}
          </template>
        </p>
      </template>

      <!-- Unfollow everyone -->
      <template v-if="progress.currentJob == 'unfollowEveryone'">
        <p>
          {{
            t("progress.unfollowedAccounts", {
              count: progress.accountsUnfollowed.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="progress.errorsOccured"
          />
          <template v-if="progress.isUnfollowEveryoneFinished">
            {{ t("progress.finishedUnfollowing") }}
          </template>
        </p>
      </template>

      <!-- Build archive -->
      <template v-if="progress.currentJob == 'archiveBuild'">
        <p>{{ t("progress.buildingArchive") }}</p>
      </template>

      <!-- Migrate to Bluesky -->
      <template v-if="progress.currentJob == 'migrateBluesky'">
        <p>
          {{
            t("progress.migratedTweets", {
              migrated: progress.migrateTweetsCount.toLocaleString(),
              total: progress.totalTweetsToMigrate.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="
              Object.keys(progress.migrateSkippedTweetsErrors).length
            "
          />
        </p>
        <div
          v-if="progress.totalTweetsToMigrate"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${((progress.migrateTweetsCount + Object.keys(progress.migrateSkippedTweetsErrors).length) / progress.totalTweetsToMigrate) * 100}%`,
              }"
              :aria-valuenow="
                ((progress.migrateTweetsCount +
                  Object.keys(progress.migrateSkippedTweetsErrors).length) /
                  progress.totalTweetsToMigrate) *
                100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  ((progress.migrateTweetsCount +
                    Object.keys(progress.migrateSkippedTweetsErrors).length) /
                    progress.totalTweetsToMigrate) *
                    100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Migrate to Bluesky (delete posts) -->
      <template v-if="progress.currentJob == 'migrateBlueskyDelete'">
        <p>
          {{
            t("progress.deletedPosts", {
              deleted: progress.migrateDeletePostsCount.toLocaleString(),
              total: progress.totalMigratedPostsToDelete.toLocaleString(),
            })
          }}
          <XProgressErrorsOccuredComponent
            :errors-occured="
              Object.keys(progress.migrateSkippedTweetsErrors).length
            "
          />
        </p>
        <div
          v-if="progress.totalMigratedPostsToDelete"
          class="d-flex align-items-center justify-content-between"
        >
          <div class="progress flex-grow-1 me-2">
            <div
              class="progress-bar"
              role="progressbar"
              :style="{
                width: `${((progress.migrateDeletePostsCount + Object.keys(progress.migrateSkippedTweetsErrors).length) / progress.totalMigratedPostsToDelete) * 100}%`,
              }"
              :aria-valuenow="
                ((progress.migrateDeletePostsCount +
                  Object.keys(progress.migrateSkippedTweetsErrors).length) /
                  progress.totalMigratedPostsToDelete) *
                100
              "
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {{
                Math.round(
                  ((progress.migrateDeletePostsCount +
                    Object.keys(progress.migrateSkippedTweetsErrors).length) /
                    progress.totalMigratedPostsToDelete) *
                    100,
                )
              }}%
            </div>
          </div>
        </div>
      </template>

      <!-- Tombstone update banner -->
      <template v-if="progress.currentJob == 'tombstoneUpdateBanner'">
        <p>{{ t("progress.updatingBanner") }}</p>
      </template>

      <!-- Tombstone update bio -->
      <template v-if="progress.currentJob == 'tombstoneUpdateBio'">
        <p>{{ t("progress.updatingBio") }}</p>
      </template>

      <!-- Tombstone lock account -->
      <template v-if="progress.currentJob == 'tombstoneLockAccount'">
        <p>{{ t("progress.lockingAccount") }}</p>
      </template>

      <!-- Rate Limit -->
      <p v-if="rateLimitInfo?.isRateLimited" class="rate-limit">
        {{ t("progress.rateLimitHit") }}
        <b>{{
          t("progress.rateLimitWaiting", {
            time: formatSeconds(rateLimitSecondsLeft),
          })
        }}</b>
      </p>
    </div>
  </template>
</template>

<style scoped>
.progress-wrapper {
  text-align: center;
  font-size: 0.8em;
  border-top: 1px solid #d0d0d0;
  margin-top: 5px;
  padding-top: 8px;
  margin-bottom: 10px;
}

.progress-wrapper p {
  margin: 0;
}

.progress {
  height: 20px;
}

.rate-limit {
  color: red;
}
</style>
