<script setup lang="ts">
import { useI18n } from "vue-i18n";
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

const { t } = useI18n();

const getJobTypeText = (jobType: string) => {
  const translationKey = `jobs.${jobType}`;
  const translated = t(translationKey);
  // If translation key doesn't exist, vue-i18n returns the key, so fallback to jobType
  return translated !== translationKey ? translated : jobType;
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
