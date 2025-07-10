<script setup lang="ts">
import { defineProps, computed } from "vue";
import { Media } from "../types";

const props = defineProps<{
  media: Media;
}>();

const formattedTitle = computed(() => {
  let title = props.media.title ? props.media.title : "";
  title = title.replace(/(?:\r\n|\r|\n)/g, "<br>");
  return title.trim();
});

const filename = computed(() => {
  return props.media.filename ? `./media/images/${props.media.filename}` : "";
});
</script>

<template>
  <span class="badge bg-secondary text-light">Media</span>
  <div class="media-item p-1 border rounded text-center">
    <template
      v-if="
        media.mediaType == 'Photo' ||
        media.mediaType == 'GenericAttachmentMedia'
      "
    >
      <!-- image -->
      <a v-if="media.filename" :href="filename" target="_blank">
        <img
          :src="filename"
          :alt="media.accessibilityCaption"
          :title="media.accessibilityCaption"
        />
      </a>
      <p v-else class="text-muted small">ERROR: No filename specified</p>
    </template>
    <template v-else-if="media.mediaType == 'Video'">
      <!-- video -->
      <p v-if="media.needsVideoDownload" class="text-muted small">
        TODO: video is not supported yet
      </p>
      <div v-else>
        <p class="text-muted small">TODO: video is not supported yet</p>
      </div>
    </template>
    <template v-else>
      <!-- other media types -->
      <p class="text-muted small">
        ERROR: unknown media type: {{ media.mediaType }}
      </p>
    </template>
    <!-- eslint-disable vue/no-v-html -->
    <p
      v-if="media.title"
      class="text-muted small mt-1"
      v-html="formattedTitle"
    ></p>
    <!-- eslint-enable vue/no-v-html -->
  </div>
</template>

<style scoped>
.media-item {
  max-width: 100%;
}

.media-item img,
.media-item video {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
}
</style>
