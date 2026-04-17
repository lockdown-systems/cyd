<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { marked } from "marked";
import type { FacebookProgress } from "../../../view_models/FacebookViewModel/types";

const { t } = useI18n();

const props = defineProps<{
  progress: FacebookProgress | null;
}>();

const wallPostsProgressHtml = computed(() => {
  if (!props.progress) return "";
  return marked.parse(
    t("viewModels.facebook.progress.wallPostsProgress", {
      deleteCount: props.progress.wallPostsDeleted.toLocaleString(),
      untagCount: props.progress.wallPostsUntagged.toLocaleString(),
      hideCount: props.progress.wallPostsHidden.toLocaleString(),
    })
  );
});
</script>

<template>
  <template v-if="progress">
    <div class="progress-wrapper">
      <!-- Delete wall posts -->
      <template v-if="progress.currentJob == 'deleteWallPosts'">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-html="wallPostsProgressHtml" />
        <p v-if="progress.isDeleteWallPostsFinished">
          {{ t("progress.savingComplete") }}
        </p>
      </template>
    </div>
  </template>
</template>

<style scoped src="../../shared_components/progress-styles.css"></style>
