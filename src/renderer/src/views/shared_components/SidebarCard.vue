<script setup lang="ts">
// Props
defineProps<{
  header: string;
  stat: number;
}>();

// Util
function formatStatsNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}
</script>

<template>
  <div class="col-12">
    <div class="card text-center">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="card-header" v-html="header"></div>
      <div class="card-body">{{ formatStatsNumber(stat) }}</div>
    </div>
  </div>
</template>
