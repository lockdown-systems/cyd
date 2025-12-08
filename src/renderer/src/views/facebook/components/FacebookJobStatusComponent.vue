<script setup lang="ts">
defineProps<{ jobs?: unknown[] }>();
</script>

<template>
  <div v-if="jobs && jobs.length > 0" class="facebook-job-status text-muted">
    <!-- Placeholder for future Facebook job status details -->
  </div>
</template>
