<script setup lang="ts">
import type { XJob } from "../../../../../shared_types";
import RunningIcon from "../../shared_components/RunningIcon.vue";

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

const getStatusIcon = (status: string) => {
  const statusIcons: { [key: string]: string } = {
    pending: "fa-solid fa-ellipsis text-primary",
    finished: "fa-solid fa-square-check text-success",
    canceled: "fa-solid fa-circle-exclamation text-danger",
  };
  return statusIcons[status] || "";
};

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
  <div class="job-status-list">
    <div
      v-for="job in jobs"
      :key="job.id ?? 0"
      class="job-status-item d-flex align-items-center"
    >
      <div class="status-icon me-2">
        <i v-if="job.status !== 'running'" :class="getStatusIcon(job.status)" />
        <i v-else-if="isPaused" class="fa-solid fa-pause" />
        <RunningIcon v-else />
      </div>
      <div class="job-type">
        {{ getJobTypeText(job.jobType) }}
      </div>
    </div>
    <div class="d-flex justify-content-center mt-2">
      <button
        v-if="!isPaused"
        class="btn btn-outline-secondary btn-sm"
        @click="emit('onPause')"
      >
        <i class="fa-solid fa-pause" /> Pause
      </button>
      <button
        v-if="isPaused"
        class="btn btn-primary btn-sm"
        @click="emit('onResume')"
      >
        <i class="fa-solid fa-play" /> Resume
      </button>
      <button
        class="btn btn-outline-danger btn-sm btn-cancel"
        @click="emit('onCancel')"
      >
        <i class="fa-regular fa-circle-xmark" /> Cancel
      </button>
    </div>
    <div class="d-flex justify-content-center">
      <button class="btn btn-link btn-sm" @click="emit('onReportBug')">
        Report a Bug
      </button>
    </div>
    <div class="d-flex justify-content-center">
      <button
        class="btn btn-link btn-sm"
        @click="
          clickingEnabled
            ? emit('onClickingDisabled')
            : emit('onClickingEnabled')
        "
      >
        {{ clickingEnabled ? "Disable" : "Enable" }} Clicking in Browser
      </button>
    </div>
  </div>
</template>

<style scoped>
.job-status-list {
  padding: 10px;
}

.job-status-item {
  display: flex;
  align-items: center;
}

.status-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.job-type {
  font-size: 16px;
}

.btn-cancel {
  margin-left: 5px;
}
</style>
