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
    <div class="wizard-scroll-content">
      <div class="dashboard row align-items-stretch g-3 justify-content-center">
        <div
          v-if="!props.model.account?.xAccount?.archiveOnly"
          class="col-12 col-md-6 col-lg-5"
        >
          <div
            class="card h-100"
            @click="emit('setState', State.WizardDatabase)"
          >
            <span v-if="!hasSomeData" class="start-here-badge badge bg-primary"
              >{{ t('dashboard.startHere') }}</span
            >
            <div class="card-body align-items-center">
              <img src="/assets/icon-database.png" :alt="t('dashboard.localDatabase')" />
              <h2>{{ t('dashboard.localDatabase') }}</h2>
              <p class="small mt-3">
                {{ t('dashboard.localDatabaseDescription') }}
              </p>
              <p v-if="lastDatabase" class="mt-3 small text-muted text-center">
                {{ t('dashboard.lastRan', { timeAgo: lastDatabaseTimeAgo }) }}
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
              <img src="/assets/icon-delete.png" :alt="t('dashboard.deleteFromX')" />
              <h2>{{ t('dashboard.deleteFromX') }}</h2>
              <p class="small mt-3">
                {{ t('dashboard.deleteFromXDescription') }}
              </p>
              <p v-if="lastDelete" class="mt-3 small text-muted text-center">
                {{ t('dashboard.lastRan', { timeAgo: lastDeleteTimeAgo }) }}
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
            <span v-if="!hasSomeData" class="start-here-badge badge bg-primary"
              >{{ t('dashboard.startHere') }}</span
            >
            <div class="card-body align-items-center">
              <img src="/assets/icon-import.png" :alt="t('dashboard.importXArchive')" />
              <h2>{{ t('dashboard.importXArchive') }}</h2>
              <p class="small mt-3">
                {{ t('dashboard.importXArchiveDescription') }}
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
              <img src="/assets/icon-bluesky.png" :alt="t('dashboard.migrateToBluesky')" />
              <h2>{{ t('dashboard.migrateToBluesky') }}</h2>
              <p class="small mt-3">
                {{ t('dashboard.migrateToBlueskyDescription') }}
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
              <img src="/assets/icon-tombstone.png" :alt="t('dashboard.tombstone')" />
              <h2>{{ t('dashboard.tombstone') }}</h2>
              <p class="small mt-3">
                {{ t('dashboard.tombstoneDescription') }}
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
}

.dashboard {
  width: 100%;
}

.dashboard {
  padding: 1rem 2rem;
}

.dashboard .card {
  padding: 0.5rem;
  text-align: center;
  cursor: pointer;
  transition:
    box-shadow 0.2s,
    transform 0.2s,
    border-color 0.2s;
  position: relative;
}

.start-here-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  transform: rotate(18deg);
  font-size: 0.85rem;
  padding: 0.5em 1.1em;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  font-weight: 600;
  letter-spacing: 0.03em;
}

.dashboard .card:hover,
.dashboard .card:focus {
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.1),
    0 1.5px 6px rgba(0, 0, 0, 0.08);
  border-color: #0d6efd;
  transform: translateY(-4px) scale(1.02);
  background-color: #f8fafd;
}

.dashboard .card img {
  width: 96px;
  height: 96px;
  margin-bottom: 1rem;
}

.dashboard .card p {
  margin-bottom: 0;
  text-align: left;
}
</style>
