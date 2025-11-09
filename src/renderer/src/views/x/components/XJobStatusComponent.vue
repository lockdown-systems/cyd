<script setup lang="ts">
import type { XJob } from "../../../../../shared_types";
import StatusComponent from "../../shared_components/StatusComponent.vue";

defineProps<{
  jobs: XJob[];
  isPaused: boolean;
  clickingEnabled: boolean;
}>();

const emit = defineEmits([
  "onPause",
  "onResume",
  "onCancel",
  "onReportBug",
  "onClickingDisabled",
  "onClickingEnabled",
]);

const getJobTypeText = (jobType: string) => {
  const jobTypeTexts: { [key: string]: string } = {
    login: "Logging in",
    indexTweets: "Saving tweets",
    indexLikes: "Saving likes",
    indexBookmarks: "Saving bookmarks",
    indexConversations: "Saving conversations",
    indexMessages: "Saving messages",
    archiveTweets: "Saving tweets HTML",
    archiveBuild: "Building archive",
    deleteTweets: "Deleting tweets",
    deleteRetweets: "Deleting retweets",
    deleteLikes: "Deleting likes",
    deleteBookmarks: "Deleting bookmarks",
    deleteDMs: "Deleting DMs",
    unfollowEveryone: "Unfollowing everyone",
    migrateBluesky: "Migrating to Bluesky",
    migrateBlueskyDelete: "Deleting from Bluesky",
    tombstoneUpdateBanner: "Updating banner",
    tombstoneUpdateBio: "Updating bio",
    tombstoneLockAccount: "Locking account",
  };
  return jobTypeTexts[jobType] || jobType;
};
</script>

<template>
  <StatusComponent
    :jobs="jobs"
    :get-job-type-text="getJobTypeText"
    :is-paused="isPaused"
    :clicking-enabled="clickingEnabled"
    @on-pause="emit('onPause')"
    @on-resume="emit('onResume')"
    @on-cancel="emit('onCancel')"
    @on-report-bug="emit('onReportBug')"
    @on-clicking-enabled="emit('onClickingEnabled')"
    @on-clicking-disabled="emit('onClickingDisabled')"
  />
</template>
