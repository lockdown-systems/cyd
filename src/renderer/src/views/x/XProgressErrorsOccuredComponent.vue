<script setup lang="ts">
defineProps<{
  errorsOccured: number;
}>();
</script>

<template>
  <span v-if="errorsOccured > 0" class="text-muted">
    {{ errorsOccured.toLocaleString() }}
    <span v-if="errorsOccured == 1">error</span>
    <span v-else>errors</span>
    occured.
  </span>
</template>

<style scoped></style>
