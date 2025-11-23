<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { openPreventSleepURL } from "../../util";

const { t } = useI18n();
</script>

<template>
  <div class="alert alert-info mt-4" role="alert">
    <p class="fw-bold mb-0">{{ t('alertStayAwake.title') }}</p>
    <p class="alert-details mb-0">
      {{ t('alertStayAwake.description') }}
      <a href="#" @click="openPreventSleepURL">{{ t('alertStayAwake.learnMore') }}</a>
    </p>
  </div>
</template>

<style scoped></style>
