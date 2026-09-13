<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import { State } from "../../../view_models/BlueskyViewModel";

const { t } = useI18n();

const props = defineProps<{
  model: BlueskyViewModel;
}>();

const emit = defineEmits<{
  setState: [value: string];
}>();

/**
 * How a save ended.
 *
 * Stopping early is not losing anything: cancelling, running out of disk, and
 * failing all keep everything already committed, and saving again carries on
 * from there. So this says what happened and offers the way onward, rather than
 * treating an interrupted run as a lost one.
 */
const outcomeMessage = computed(() => {
  switch (props.model.saveError) {
    case "":
      return "";
    case "outOfSpace":
      return t("bluesky.progress.outOfSpace");
    default:
      return t("bluesky.progress.failed", {
        errorClass: props.model.saveError,
      });
  }
});

const incomplete = computed(() => props.model.savedData?.complete === false);
</script>

<template>
  <div class="wizard-content bluesky-finished">
    <div class="wizard-scroll-content">
      <ul class="totals list-unstyled">
        <li class="records-saved">
          {{
            t("bluesky.progress.recordsSaved", {
              count: model.progress.recordsSaved,
            })
          }}
        </li>
        <li class="media-saved">
          {{
            t("bluesky.progress.mediaSaved", {
              count: model.progress.mediaSaved,
            })
          }}
        </li>
        <li v-if="model.progress.mediaFailed > 0" class="media-failed">
          {{
            t("bluesky.progress.mediaFailed", {
              count: model.progress.mediaFailed,
            })
          }}
        </li>
      </ul>

      <p v-if="outcomeMessage" class="outcome text-warning small">
        {{ outcomeMessage }}
      </p>
      <p v-else-if="incomplete" class="incomplete text-muted small">
        {{ t("bluesky.dashboard.incomplete") }}
      </p>

      <div class="d-flex gap-2">
        <button
          class="btn btn-primary browse-saved-data"
          @click="emit('setState', State.BlueskyWizardBrowse)"
        >
          {{ t("bluesky.browse.title") }}
        </button>
        <button
          class="btn btn-outline-secondary back-to-dashboard"
          @click="emit('setState', State.BlueskyWizardDashboard)"
        >
          {{ t("bluesky.browse.backToDashboard") }}
        </button>
      </div>
    </div>
  </div>
</template>
