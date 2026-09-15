<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();

/**
 * What a save has put on this computer so far.
 *
 * Shown while a run is going and again once it has stopped, so both read the
 * same way and neither can drift into counting something different. Counts only:
 * nothing here identifies a person or quotes their data.
 *
 * See docs/adr/0029-minimize-bluesky-diagnostics.md.
 */
defineProps<{
  recordsSaved: number;
  mediaSaved: number;
  mediaFailed: number;
  /** Media still to fetch, when a run is in flight. */
  mediaPending?: number;
}>();
</script>

<template>
  <ul class="save-totals list-unstyled small mb-0">
    <li class="records-saved">
      {{ t("bluesky.progress.recordsSaved", { count: recordsSaved }) }}
    </li>
    <li class="media-saved">
      {{ t("bluesky.progress.mediaSaved", { count: mediaSaved }) }}
    </li>
    <li v-if="mediaPending" class="media-pending">
      {{ t("bluesky.progress.mediaPending", { count: mediaPending }) }}
    </li>
    <li v-if="mediaFailed > 0" class="media-failed">
      {{ t("bluesky.progress.mediaFailed", { count: mediaFailed }) }}
    </li>
  </ul>
</template>
