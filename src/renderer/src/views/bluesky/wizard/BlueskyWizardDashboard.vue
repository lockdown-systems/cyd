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
 * What this account can do.
 *
 * Saving needs a Bluesky connection, because it reads from Bluesky. Browsing
 * does not: it reads what Cyd has already saved off this computer, so it stays
 * available after disconnecting.
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
    description: props.model.isConnected
      ? t("bluesky.dashboard.saveDescription")
      : t("bluesky.dashboard.connectFirst"),
    disabled: !props.model.isConnected,
    action: () => emit("setState", State.BlueskyWizardSave),
  },
  {
    icon: new URL("/assets/icon-import.png", import.meta.url).href,
    title: t("bluesky.dashboard.browseTitle"),
    description: t("bluesky.dashboard.browseDescription"),
    // Browsing reads local storage only, so it needs no connection: what it
    // needs is something saved to read.
    disabled: !props.model.hasSavedData,
    action: () => emit("setState", State.BlueskyWizardBrowse),
  },
]);

/** How much this account has saved, shown once there is anything to say. */
const savedRecords = computed(() =>
  (props.model.savedData?.categories ?? []).reduce(
    (total, each) => total + each.recordCount,
    0,
  ),
);

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

      <p
        v-if="savedRecords > 0"
        class="saved-records text-muted small text-center"
      >
        {{ t("bluesky.dashboard.savedRecords", { count: savedRecords }) }}
        <span v-if="model.savedData?.complete === false" class="incomplete">
          {{ t("bluesky.dashboard.incomplete") }}
        </span>
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
            @click="!card.disabled && card.action && card.action()"
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
</style>
