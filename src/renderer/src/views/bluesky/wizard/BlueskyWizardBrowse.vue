<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { blueskyPublicCategories } from "../../../../../shared_types";
import type { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import { State } from "../../../view_models/BlueskyViewModel";
import BlueskyDisplayRecord from "../components/BlueskyDisplayRecord.vue";

const { t } = useI18n();

const props = defineProps<{
  model: BlueskyViewModel;
}>();

const emit = defineEmits<{
  setState: [value: string];
}>();

/**
 * Browsing Bluesky saved data.
 *
 * Each category has its own chronological view, and every one of them reads
 * only this computer: there is nothing here that needs a Bluesky connection or
 * the network.
 */
const tabs = computed(() =>
  blueskyPublicCategories.map((category) => {
    const saved = props.model.savedData?.categories.find(
      (each) => each.category === category,
    );
    return {
      category,
      title: t(`bluesky.save.categories.${category}`),
      recordCount: saved?.recordCount ?? 0,
      assetsExpected: saved?.assetsExpected ?? 0,
      assetsAvailable: saved?.assetsAvailable ?? 0,
    };
  }),
);

const openTab = computed(() =>
  tabs.value.find((tab) => tab.category === props.model.browseCategory),
);

const categoryTitle = computed(
  () => openTab.value?.title ?? props.model.browseCategory,
);
</script>

<template>
  <div class="wizard-content bluesky-browse">
    <div class="wizard-scroll-content">
      <button
        class="btn btn-sm btn-outline-secondary back-to-dashboard mb-3"
        @click="emit('setState', State.BlueskyWizardDashboard)"
      >
        <i class="fa-solid fa-arrow-left me-2" />{{
          t("bluesky.browse.backToDashboard")
        }}
      </button>

      <h2>{{ t("bluesky.browse.title") }}</h2>
      <p class="text-muted small">{{ t("bluesky.browse.description") }}</p>

      <ul class="nav nav-tabs category-tabs mb-3">
        <li v-for="tab in tabs" :key="tab.category" class="nav-item">
          <button
            class="nav-link category-tab"
            :class="{ active: tab.category === model.browseCategory }"
            @click="model.browse(tab.category)"
          >
            {{ tab.title }}
            <span class="badge bg-secondary ms-2">{{ tab.recordCount }}</span>
          </button>
        </li>
      </ul>

      <p
        v-if="
          openTab &&
          openTab.assetsExpected > 0 &&
          openTab.assetsAvailable < openTab.assetsExpected
        "
        class="incomplete text-muted small"
      >
        <i class="fa-solid fa-circle-info me-2" />{{
          t("bluesky.browse.incomplete", {
            available: openTab.assetsAvailable,
            expected: openTab.assetsExpected,
          })
        }}
      </p>

      <p
        v-if="!model.hasSavedData"
        class="nothing-saved text-muted small text-center"
      >
        {{ t("bluesky.browse.nothingSavedAtAll") }}
      </p>
      <p
        v-else-if="!model.browsePage?.records.length"
        class="empty-category text-muted small text-center"
      >
        {{ t("bluesky.browse.empty", { category: categoryTitle }) }}
      </p>

      <BlueskyDisplayRecord
        v-for="record in model.browsePage?.records ?? []"
        :key="record.uri"
        :record="record"
        :media-paths="model.browseMediaPaths"
      />

      <div class="pagination-controls d-flex gap-2">
        <button
          v-if="!model.isBrowsingNewest"
          class="btn btn-sm btn-outline-secondary browse-newest"
          @click="model.browseNewest()"
        >
          {{ t("bluesky.browse.newest") }}
        </button>
        <button
          v-if="model.browsePage?.nextCursor"
          class="btn btn-sm btn-outline-secondary browse-older"
          @click="model.browseOlder()"
        >
          {{ t("bluesky.browse.older") }}
        </button>
      </div>
    </div>
  </div>
</template>
