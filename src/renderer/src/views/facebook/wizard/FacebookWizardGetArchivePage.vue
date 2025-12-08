<script setup lang="ts">
import { onMounted } from "vue";
import { openURL } from "../../../util";

// Emits
const emit = defineEmits<{
  setState: [value: string];
}>();

onMounted(async () => {
  // Open external documentation link
  await openURL("https://docs.cyd.social/docs/facebook/get-archive");

  // Return to dashboard
  emit("setState", "FacebookWizardDashboard");
});
</script>

<template>
  <!-- This page automatically redirects, so no UI needed -->
  <div />
</template>
