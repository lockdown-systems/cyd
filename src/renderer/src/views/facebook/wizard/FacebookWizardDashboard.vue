<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { FacebookViewModel } from "../../../view_models/FacebookViewModel";

const { t } = useI18n();

const props = defineProps<{
  model: FacebookViewModel;
}>();

const facebookAccount = computed(() => props.model.account.facebookAccount);

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
    <div class="wizard-scroll-content">
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

<style scoped>
.wizard-scroll-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  height: 100%;
  padding: 1rem 2rem;
}

.dashboard {
  width: 100%;
}

.card img {
  height: 80px;
  width: auto;
}

.card h2 {
  margin-top: 1rem;
  font-size: 1.5rem;
}

.disabled-card {
  cursor: default;
  opacity: 0.9;
}
</style>
