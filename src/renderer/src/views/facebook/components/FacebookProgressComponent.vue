<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { FacebookProgress } from "../../../view_models/FacebookViewModel/types";

const { t } = useI18n();

defineProps<{
  progress: FacebookProgress | null;
}>();
</script>

<template>
  <template v-if="progress">
    <div class="progress-wrapper">
      <!-- Delete wall posts -->
      <template v-if="progress.currentJob == 'deleteWallPosts'">
        <p v-if="progress.wallPostsDeleted > 0">
          {{
            t("viewModels.facebook.progress.wallPostsDeleted", {
              count: progress.wallPostsDeleted.toLocaleString(),
            })
          }}
        </p>
        <p v-if="progress.wallPostsUntagged > 0">
          {{
            t("viewModels.facebook.progress.wallPostsUntagged", {
              count: progress.wallPostsUntagged.toLocaleString(),
            })
          }}
        </p>
        <p v-if="progress.wallPostsHidden > 0">
          {{
            t("viewModels.facebook.progress.wallPostsHidden", {
              count: progress.wallPostsHidden.toLocaleString(),
            })
          }}
        </p>
        <p v-if="progress.isDeleteWallPostsFinished">
          {{ t("progress.savingComplete") }}
        </p>
      </template>
    </div>
  </template>
</template>

<style scoped src="../../shared_components/progress-styles.css"></style>
