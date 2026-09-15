<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import BlueskySaveTotals from "./BlueskySaveTotals.vue";

const { t } = useI18n();

const props = defineProps<{
  model: BlueskyViewModel;
}>();

/**
 * What a save is doing right now.
 *
 * A rate-limited run is waiting rather than stuck, so it says what it is
 * waiting for and when it resumes. Everything shown here is operational
 * metadata — category, stage, counts, and a time — and never a record, a
 * handle, or a path.
 *
 * See docs/adr/0029-minimize-bluesky-diagnostics.md.
 */
const collection = computed(() => props.model.progress.collection);

const categoryTitle = computed(() =>
  collection.value
    ? t(`bluesky.save.categories.${collection.value.category}`)
    : "",
);

const stageMessage = computed(() => {
  if (!collection.value) {
    return "";
  }
  const category = categoryTitle.value;
  switch (collection.value.stage) {
    case "listing":
      return t("bluesky.progress.stageListing", { category });
    case "media":
      return t("bluesky.progress.stageMedia", { category });
    default:
      return t("bluesky.progress.stageDone", { category });
  }
});

const rateLimitedUntil = computed(() =>
  collection.value?.rateLimitedUntil
    ? new Date(collection.value.rateLimitedUntil).toLocaleTimeString()
    : null,
);
</script>

<template>
  <div class="bluesky-progress">
    <p v-if="stageMessage" class="stage">{{ stageMessage }}</p>

    <p
      v-if="rateLimitedUntil"
      class="rate-limited text-warning small"
      role="status"
    >
      <i class="fa-solid fa-hourglass-half me-2" />{{
        t("bluesky.progress.rateLimited", { time: rateLimitedUntil })
      }}
    </p>

    <BlueskySaveTotals
      class="text-muted"
      :records-saved="model.progress.recordsSaved"
      :media-saved="model.progress.mediaSaved"
      :media-failed="model.progress.mediaFailed"
      :media-pending="collection?.mediaPending"
    />
  </div>
</template>
