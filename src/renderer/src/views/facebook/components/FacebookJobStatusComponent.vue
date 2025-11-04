<script setup lang="ts">
import type { FacebookJob } from "../../../../../shared_types";
import StatusComponent from "../../shared_components/StatusComponent.vue";

defineProps<{
  jobs: FacebookJob[];
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
    savePosts: "Saving posts",
    savePostsHTML: "Saving posts HTML",
    archiveBuild: "Building archive",
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
