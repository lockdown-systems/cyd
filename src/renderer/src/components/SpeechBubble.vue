<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
  message: string;
}>();

const parsedMessage = computed(() => marked.parse(props.message));
</script>

<template>
  <div class="row pt-2 g-1">
    <div class="col-auto">
      <img src="/logo.png" class="bird img-fluid" alt="Semiphemeral Bird">
    </div>
    <div class="col">
      <div class="bubble p-3 text-black">
        <div class="bubble-inner" v-html="parsedMessage" />
      </div>
    </div>
  </div>
</template>

<style scoped>
img.bird {
  max-width: 80px;
}

.bubble {
  background-color: #c1fac4;
  border: 1px solid #7ba57d;
  border-top-right-radius: 2rem;
  border-bottom-left-radius: 2rem;
  border-bottom-right-radius: 2rem;
  border-top-left-radius: 0;
}

.bubble-inner {
  margin: 0 0.5rem;
}

:deep(.bubble-inner p:last-child) {
  margin-bottom: 0 !important;
}
</style>