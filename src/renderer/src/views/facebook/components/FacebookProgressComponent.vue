<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { FacebookProgress } from "../../../view_models/FacebookViewModel/types";
import { FACEBOOK_DELETE_CATEGORIES } from "../../../view_models/FacebookViewModel/categories";

const { t } = useI18n();

const props = defineProps<{
  progress: FacebookProgress | null;
}>();

// One line per category that has had at least one item deleted.
const deletedCounts = computed(() => {
  if (!props.progress) return [];
  return FACEBOOK_DELETE_CATEGORIES.map((category) => ({
    setting: category.setting,
    count: props.progress ? props.progress[category.counter] : 0,
    label: t(`facebook.finished.${category.counter}`),
  })).filter((entry) => entry.count > 0);
});
</script>

<template>
  <template v-if="progress">
    <div class="progress-wrapper">
      <!-- Delete activity -->
      <template v-if="progress.currentJob == 'deleteActivity'">
        <ul>
          <li v-for="entry in deletedCounts" :key="entry.setting">
            {{ entry.count.toLocaleString() }} {{ entry.label }}
          </li>
        </ul>
        <p v-if="progress.isDeleteActivityFinished">
          {{ t("progress.savingComplete") }}
        </p>
      </template>
    </div>
  </template>
</template>

<style scoped src="../../shared_components/progress-styles.css"></style>
