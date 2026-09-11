<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";

const { t } = useI18n();

const props = defineProps<{
  model: BlueskyViewModel;
}>();

/**
 * Every capability on this dashboard arrives in a later issue: connecting an
 * account (#674), saving data (#676 and #677), and browsing it offline (#676
 * and #677). They are shown as unavailable rather than hidden, so the
 * dashboard describes what this account will be able to do.
 *
 * Nothing here reads a Bluesky connection or the network, so the dashboard
 * renders for an account that has neither.
 */
const cards = computed(() => [
  {
    icon: new URL("/assets/icon-bluesky.png", import.meta.url).href,
    title: t("bluesky.dashboard.connectTitle"),
    description: t("bluesky.dashboard.connectDescription"),
    disabled: true,
  },
  {
    icon: new URL("/assets/icon-database.png", import.meta.url).href,
    title: t("bluesky.dashboard.saveTitle"),
    description: t("bluesky.dashboard.saveDescription"),
    disabled: true,
  },
  {
    icon: new URL("/assets/icon-import.png", import.meta.url).href,
    title: t("bluesky.dashboard.browseTitle"),
    description: t("bluesky.dashboard.browseDescription"),
    disabled: true,
  },
]);

/**
 * A Bluesky connection is authorization to act on an identity, which is not
 * built yet, so the most this dashboard can say is whether the local account
 * is linked to a Bluesky identity at all.
 */
const hasBlueskyIdentity = computed(() =>
  Boolean(props.model.localAccount?.did),
);
</script>

<template>
  <div class="wizard-content bluesky-dashboard">
    <div class="wizard-scroll-content dashboard-center">
      <p
        v-if="!hasBlueskyIdentity"
        class="no-identity text-muted small text-center"
      >
        {{ t("bluesky.dashboard.noIdentity") }}
      </p>

      <div class="dashboard row align-items-stretch g-3 justify-content-center">
        <div
          v-for="card in cards"
          :key="card.title"
          class="col-12 col-md-6 col-lg-4"
        >
          <div
            class="card h-100"
            :class="{ 'disabled-card': card.disabled }"
            :aria-disabled="card.disabled"
          >
            <span
              v-if="card.disabled"
              class="coming-soon-badge badge bg-secondary"
              >{{ t("bluesky.dashboard.comingSoon") }}</span
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

<style scoped>
.no-identity {
  margin-bottom: 0;
  padding: 0 2rem;
}

.coming-soon-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  font-size: 0.8rem;
  padding: 0.4em 0.9em;
  font-weight: 600;
  letter-spacing: 0.03em;
}
</style>
