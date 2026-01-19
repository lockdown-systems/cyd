<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { PlatformStates } from "../../../types/PlatformStates";
import { openURL } from "../../../util";

const { t } = useI18n();

// Emits
const emit = defineEmits<{
  setState: [value: string];
}>();

const cards = computed(() => [
  {
    icon: "/assets/icon-database.png",
    title: t("facebook.dashboard.getArchiveTitle"),
    description: t("facebook.dashboard.getArchiveDescription"),
    url: "https://docs.cyd.social/docs/facebook/get-archive",
    disabled: false,
    startHere: true,
  },
  {
    icon: "/assets/icon-delete.png",
    title: t("facebook.dashboard.deleteWallTitle"),
    description: t("facebook.dashboard.deleteWallDescription"),
    state: PlatformStates.WizardDeleteOptions,
    disabled: false,
    startHere: false,
  },
]);

const handleCardClick = (card: (typeof cards.value)[0]) => {
  if (card.disabled) return;
  if (card.url) {
    openURL(card.url);
  } else if (card.state) {
    emit("setState", card.state);
  }
};
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
          <div
            class="card h-100"
            :class="{ 'disabled-card': card.disabled }"
            @click="handleCardClick(card)"
          >
            <span
              v-if="card.startHere"
              class="start-here-badge badge bg-primary"
              >{{ t("dashboard.startHere") }}</span
            >
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
