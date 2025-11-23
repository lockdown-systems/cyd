<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="loading text-center">
    <img src="/assets/cyd-loading.gif" :alt="t('common.loadingAlt')" />
    <p class="text-muted">{{ t('common.loading') }}</p>
  </div>
</template>

<style scoped>
.loading img {
  width: 337px;
  height: 373px;
}
</style>
