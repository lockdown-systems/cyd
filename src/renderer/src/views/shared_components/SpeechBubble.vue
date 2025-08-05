<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";

import CydAvatarComponent from "./CydAvatarComponent.vue";
import RunningIcon from "./RunningIcon.vue";

const props = defineProps<{
  message: string;
}>();

const parsedMessage = computed(() => marked.parse(props.message));
</script>

<template>
  <div class="row pt-2 g-1">
    <div class="col-auto">
      <CydAvatarComponent :height="140" />
    </div>
    <div class="col">
      <div class="bubble p-3 text-black">
        <div v-if="message != ''" class="bubble-inner" v-html="parsedMessage" />
        <div v-else class="bubble-inner fs-1">
          <RunningIcon />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bubble {
  background-color: #fef3de;
  border: 1px solid #f8a712;
  border-top-right-radius: 2rem;
  border-bottom-left-radius: 2rem;
  border-bottom-right-radius: 2rem;
  border-top-left-radius: 0;
  min-height: 140px;
  display: flex;
  align-items: center;
}

.bubble-inner {
  margin: 0 0.5rem;
}

:deep(.bubble-inner p:last-child) {
  margin-bottom: 0 !important;
}
</style>
