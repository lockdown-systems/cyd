<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <div class="facebook-dashboard card">
    <div class="card-body text-center text-muted">
      {{ t("common.morePlatformsComingSoon") }}
    </div>
  </div>
</template>
