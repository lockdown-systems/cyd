<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
// import type { FacebookViewModel } from "../../../view_models/FacebookViewModel";

const { t } = useI18n();

// const props = defineProps<{
//   model: FacebookViewModel;
// }>();

const cards = computed(() => [
  {
    icon: "/assets/icon-database.png",
    title: t("facebook.dashboard.getArchiveTitle"),
    description: t("facebook.dashboard.getArchiveDescription"),
  },
  {
    icon: "/assets/icon-delete.png",
    title: t("facebook.dashboard.deleteWallTitle"),
    description: t("facebook.dashboard.deleteWallDescription"),
  },
]);
</script>

<template>
  <div class="wizard-content">
    <div class="wizard-scroll-content dashboard-center">
      <div class="dashboard row align-items-stretch g-3 justify-content-center">
        <div
          v-for="card in cards"
          :key="card.title"
          class="col-12 col-md-6 col-lg-5"
        >
          <div class="card h-100 disabled-card">
            <div class="card-body align-items-center">
              <img :src="card.icon" :alt="card.title" />
              <h2>{{ card.title }}</h2>
              <p class="small mt-3">
                {{ card.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
