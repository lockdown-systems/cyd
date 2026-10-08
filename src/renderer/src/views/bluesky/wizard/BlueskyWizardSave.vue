<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { blueskyPublicCategories } from "../../../../../shared_types";
import type { BlueskyCategory } from "../../../../../shared_types";
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
 * Choosing what to save. Every category is independent, and a category turned
 * off keeps everything Cyd already saved for it.
 */
const categories = computed(() =>
  blueskyPublicCategories.map((category) => ({
    category,
    title: t(`bluesky.save.categories.${category}`),
    description: t(`bluesky.save.categories.${category}Description`),
    enabled: props.model.categorySettings[category],
  })),
);

const toggle = async (category: BlueskyCategory, enabled: boolean) => {
  await props.model.setCategoryEnabled(category, enabled);
  await props.model.refreshPreflight();
};

const nothingChosen = computed(
  () => props.model.enabledCategories.length === 0,
);

/**
 * Free space is reported in whole units, because a byte count implies a
 * precision this estimate does not have.
 */
const humanBytes = (bytes: number): string => {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};
</script>

<template>
  <div class="wizard-content bluesky-save">
    <div class="wizard-scroll-content">
      <button
        class="btn btn-sm btn-outline-secondary back-to-dashboard mb-3"
        @click="emit('setState', State.BlueskyWizardDashboard)"
      >
        <i class="fa-solid fa-arrow-left me-2" />{{
          t("bluesky.save.backToDashboard")
        }}
      </button>

      <h2>{{ t("bluesky.save.title") }}</h2>
      <p class="text-muted small">{{ t("bluesky.save.description") }}</p>

      <div class="categories mb-4">
        <div
          v-for="category in categories"
          :key="category.category"
          class="form-check mb-2"
        >
          <input
            :id="`bluesky-category-${category.category}`"
            class="form-check-input"
            type="checkbox"
            :checked="category.enabled"
            @change="
              toggle(
                category.category,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <label
            class="form-check-label"
            :for="`bluesky-category-${category.category}`"
          >
            <span class="category-title">{{ category.title }}</span>
            <span class="d-block text-muted small">{{
              category.description
            }}</span>
          </label>
        </div>
      </div>

      <div v-if="model.preflight" class="storage card mb-3">
        <div class="card-body">
          <h3 class="h6">{{ t("bluesky.save.storage.title") }}</h3>
          <p class="mb-1 small">
            {{
              t("bluesky.save.storage.estimated", {
                estimated: humanBytes(model.preflight.estimatedBytes),
              })
            }}
          </p>
          <p class="mb-1 small">
            {{
              t("bluesky.save.storage.certain", {
                certain: humanBytes(model.preflight.certainBytes),
              })
            }}
          </p>
          <p class="mb-1 small">
            {{
              t("bluesky.save.storage.available", {
                available: humanBytes(model.preflight.availableBytes),
              })
            }}
          </p>

          <ul class="counts list-unstyled small text-muted mb-0 mt-2">
            <li
              v-for="each in model.preflight.categories"
              :key="each.category"
              class="category-count"
            >
              {{
                each.recordCount === null
                  ? t("bluesky.save.storage.unknownCount", {
                      category: t(`bluesky.save.categories.${each.category}`),
                    })
                  : t("bluesky.save.storage.recordCount", {
                      category: t(`bluesky.save.categories.${each.category}`),
                      count: each.recordCount,
                    })
              }}
            </li>
          </ul>

          <p
            v-if="model.preflight.uncertain && !model.storageIsInsufficient"
            class="uncertain text-muted small mt-2 mb-0"
          >
            <i class="fa-solid fa-circle-info me-2" />{{
              t("bluesky.save.storage.uncertain")
            }}
          </p>
          <p
            v-if="model.storageIsInsufficient"
            class="insufficient text-danger small mt-2 mb-0"
          >
            <i class="fa-solid fa-triangle-exclamation me-2" />{{
              t("bluesky.save.storage.insufficient")
            }}
          </p>
        </div>
      </div>

      <p v-if="nothingChosen" class="nothing-chosen text-muted small">
        {{ t("bluesky.save.nothingChosen") }}
      </p>

      <button
        class="btn btn-primary start-saving"
        :disabled="nothingChosen || model.storageIsInsufficient"
        @click="model.startSaving()"
      >
        {{ t("bluesky.save.start") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.category-title {
  font-weight: 600;
}
</style>
