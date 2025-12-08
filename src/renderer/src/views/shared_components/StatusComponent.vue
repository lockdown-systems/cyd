<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { XJob } from "../../../../shared_types";
import RunningIcon from "./RunningIcon.vue";

const { t } = useI18n();

defineProps<{
  jobs: XJob[];
  isPaused: boolean;
  clickingEnabled: boolean;
  getJobTypeText: Function;
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
        <i class="fa-solid fa-pause" /> {{ t("status.pause") }}
      </button>
      <button
        v-if="isPaused"
        class="btn btn-primary btn-sm"
        @click="emit('onResume')"
      >
        <i class="fa-solid fa-play" /> {{ t("status.resume") }}
      </button>
      <button
        class="btn btn-outline-danger btn-sm btn-cancel"
        @click="emit('onCancel')"
      >
        <i class="fa-regular fa-circle-xmark" /> {{ t("status.cancel") }}
      </button>
    </div>
    <div class="d-flex justify-content-center">
      <button class="btn btn-link btn-sm" @click="emit('onReportBug')">
        {{ t("status.reportBug") }}
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
        {{
          clickingEnabled
            ? t("status.disableClicking")
            : t("status.enableClicking")
        }}
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
