<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="mb-3">
    <small class="form-text text-muted">
      {{ t("wizard.directMessagesWithdrawn") }}
    </small>
  </div>
</template>

<style scoped></style>
