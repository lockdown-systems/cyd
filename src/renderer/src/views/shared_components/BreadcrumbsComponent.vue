<script setup lang="ts">
import type { ButtonInfo } from "../../types";

defineProps<{
  buttons: ButtonInfo[];
  label: string;
  icon?: string;
}>();
</script>

<template>
  <nav class="breadcrumbs d-flex align-items-center mt-2 mb-3">
    <div class="d-flex gap-2">
      <div v-for="(button, index) in buttons" :key="index">
        <button class="btn btn-sm btn-link text-nowrap" @click="button.action">
          <i v-if="button.icon" :class="button.icon" />
          {{ button.label }}
        </button>
        <span class="divider small">
          <i v-if="icon" class="fa-solid fa-right-long" />
        </span>
      </div>
      <div class="small text-nowrap">
        <div class="current">
          <i v-if="icon" :class="icon" />
          {{ label }}
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.divider {
  margin: 0 0.5rem;
  color: #d0d0d0;
}

.btn-link {
  color: var(--bs-secondary);
  text-decoration: none;
}

.btn-link:hover {
  color: black;
}

.current {
  padding: 0.25rem 0.5rem;
}
</style>
