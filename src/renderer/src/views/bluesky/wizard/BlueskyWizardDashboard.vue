<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import { State } from "../../../view_models/BlueskyViewModel";

const { t } = useI18n();

const props = defineProps<{
  model: BlueskyViewModel;
}>();

const emit = defineEmits<{
  setState: [value: string];
}>();

/**
 * Saving data and browsing it offline arrive in #676 and #677. They are shown
 * as unavailable rather than hidden, so the dashboard describes what this
 * account will be able to do.
 *
 * Nothing here reads the network, so the dashboard renders for an account with
 * no Bluesky connection and no saved data.
 */
const cards = computed(() => [
  {
    icon: new URL("/assets/icon-bluesky.png", import.meta.url).href,
    title: props.model.isConnected
      ? t("bluesky.dashboard.connectedTitle")
      : t("bluesky.dashboard.connectTitle"),
    description: props.model.isConnected
      ? t("bluesky.dashboard.connectedDescription")
      : t("bluesky.dashboard.connectDescription"),
    disabled: false,
    action: () => emit("setState", State.BlueskyWizardConnect),
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
 * A Bluesky connection is this installation's authorization to act on an
 * identity. An account can be linked to an identity without holding one, so
 * the dashboard says which.
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
      <p
        v-else-if="!model.isConnected"
        class="not-connected text-muted small text-center"
      >
        {{ t("bluesky.dashboard.notConnected") }}
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
            @click="card.action && card.action()"
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
.no-identity,
.not-connected {
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
