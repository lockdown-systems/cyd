<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';

const props = defineProps<{
    message: string;
}>();

const parsedMessage = computed(() => marked.parse(props.message));
</script>

<template>
  <div class="row align-items-center">
    <div class="col-auto">
      <img
        src="/logo.png"
        class="bird img-fluid"
        alt="Semiphemeral Bird"
      >
    </div>
    <div class="col">
      <div class="bubble p-3 text-black rounded-5">
        <div
          class="bubble-inner"
          v-html="parsedMessage"
        />
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
}

.bubble-inner {
    margin: 0 0.5rem;
}

::v-deep .bubble-inner p:last-child {
    margin-bottom: 0 !important;
}
</style>