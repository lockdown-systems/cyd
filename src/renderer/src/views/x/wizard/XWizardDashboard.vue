<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { XViewModel, State } from "../../../view_models/XViewModel";
import {
  xHasSomeData,
  xGetLastImportArchive,
  xGetLastBuildDatabase,
  xGetLastDelete,
} from "../../../util_x";
import { formatDistanceToNow } from "date-fns";

const { t } = useI18n();

// Props
const props = defineProps<{
  model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
  setState: [value: State];
}>();

// Feature flags
const featureXTombstone = ref(false);

const hasSomeData = ref(false);
const lastDatabase = ref<Date | null>(null);
const lastDelete = ref<Date | null>(null);

const lastDatabaseTimeAgo = computed(() => {
  if (!lastDatabase.value) return "";
  return formatDistanceToNow(lastDatabase.value, { addSuffix: true });
});

const lastDeleteTimeAgo = computed(() => {
  if (!lastDelete.value) return "";
  return formatDistanceToNow(lastDelete.value, { addSuffix: true });
});

onMounted(async () => {
  featureXTombstone.value =
    await window.electron.isFeatureEnabled("x_tombstone");

  hasSomeData.value = await xHasSomeData(props.model.account.id);

  const lastImportArchive = await xGetLastImportArchive(props.model.account.id);
  const lastBuildDatabase = await xGetLastBuildDatabase(props.model.account.id);
  lastDatabase.value =
    lastImportArchive && lastBuildDatabase
      ? lastImportArchive > lastBuildDatabase
        ? lastImportArchive
        : lastBuildDatabase
      : lastImportArchive || lastBuildDatabase;
  lastDelete.value = await xGetLastDelete(props.model.account.id);
});
</script>

<template>
  <div class="wizard-content">
    <div class="wizard-scroll-content dashboard-center">
      <div class="dashboard row align-items-stretch g-3 justify-content-center">
        <div
          v-if="!props.model.account?.xAccount?.archiveOnly"
          class="col-12 col-md-6 col-lg-5"
        >
          <div
            class="card h-100"
            @click="emit('setState', State.WizardDatabase)"
          >
            <span
              v-if="!hasSomeData"
              class="start-here-badge badge bg-primary"
              >{{ t("dashboard.startHere") }}</span
            >
            <div class="card-body align-items-center">
              <img
                src="/assets/icon-database.png"
                :alt="t('dashboard.localDatabase')"
              />
              <h2>{{ t("dashboard.localDatabase") }}</h2>
              <p class="small mt-3">
                {{ t("dashboard.localDatabaseDescription") }}
              </p>
              <p v-if="lastDatabase" class="mt-3 small text-muted text-center">
                {{ t("dashboard.lastRan", { timeAgo: lastDatabaseTimeAgo }) }}
              </p>
            </div>
          </div>
        </div>
        <div
          v-if="!props.model.account?.xAccount?.archiveOnly"
          class="col-12 col-md-6 col-lg-5"
        >
          <div
            class="card h-100"
            @click="emit('setState', State.WizardDeleteOptions)"
          >
            <div class="card-body align-items-center">
              <img
                src="/assets/icon-delete.png"
                :alt="t('dashboard.deleteFromX')"
              />
              <h2>{{ t("dashboard.deleteFromX") }}</h2>
              <p class="small mt-3">
                {{ t("dashboard.deleteFromXDescription") }}
              </p>
              <p v-if="lastDelete" class="mt-3 small text-muted text-center">
                {{ t("dashboard.lastRan", { timeAgo: lastDeleteTimeAgo }) }}
              </p>
            </div>
          </div>
        </div>
        <div
          v-if="props.model.account?.xAccount?.archiveOnly"
          class="col-12 col-md-6 col-lg-5"
        >
          <div
            class="card h-100"
            @click="emit('setState', State.WizardArchiveOnly)"
          >
            <span
              v-if="!hasSomeData"
              class="start-here-badge badge bg-primary"
              >{{ t("dashboard.startHere") }}</span
            >
            <div class="card-body align-items-center">
              <img
                src="/assets/icon-import.png"
                :alt="t('dashboard.importXArchive')"
              />
              <h2>{{ t("dashboard.importXArchive") }}</h2>
              <p class="small mt-3">
                {{ t("dashboard.importXArchiveDescription") }}
              </p>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-5">
          <div
            class="card h-100"
            @click="emit('setState', State.WizardMigrateToBluesky)"
          >
            <div class="card-body align-items-center">
              <img
                src="/assets/icon-bluesky.png"
                :alt="t('dashboard.migrateToBluesky')"
              />
              <h2>{{ t("dashboard.migrateToBluesky") }}</h2>
              <p class="small mt-3">
                {{ t("dashboard.migrateToBlueskyDescription") }}
              </p>
            </div>
          </div>
        </div>
        <div
          v-if="
            featureXTombstone && !props.model.account?.xAccount?.archiveOnly
          "
          class="col-12 col-md-6 col-lg-5"
        >
          <div
            class="card h-100"
            @click="emit('setState', State.WizardTombstone)"
          >
            <div class="card-body align-items-center">
              <img
                src="/assets/icon-tombstone.png"
                :alt="t('dashboard.tombstone')"
              />
              <h2>{{ t("dashboard.tombstone") }}</h2>
              <p class="small mt-3">
                {{ t("dashboard.tombstoneDescription") }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
