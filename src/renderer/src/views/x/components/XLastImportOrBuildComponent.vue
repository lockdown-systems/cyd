<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { formatDistanceToNow } from "date-fns";
import { State } from "../../../view_models/XViewModel";
import { xGetLastImportArchive, xGetLastBuildDatabase } from "../../../util_x";

const { t } = useI18n();

const props = defineProps<{
  accountID: number;
  showButton: boolean;
  showNoDataWarning: boolean;
  archiveOnly?: boolean;
}>();

const emit = defineEmits<{
  setState: [value: State];
}>();

const lastImportArchive = ref<Date | null>(null);
const lastBuildDatabase = ref<Date | null>(null);

const lastImportArchiveTimeAgo = computed(() => {
  if (!lastImportArchive.value) return "";
  return formatDistanceToNow(lastImportArchive.value, { addSuffix: true });
});

const lastBuildDatabaseTimeAgo = computed(() => {
  if (!lastBuildDatabase.value) return "";
  return formatDistanceToNow(lastBuildDatabase.value, { addSuffix: true });
});

onMounted(async () => {
  lastImportArchive.value = await xGetLastImportArchive(props.accountID);
  lastBuildDatabase.value = await xGetLastBuildDatabase(props.accountID);
});
</script>

<template>
  <div
    v-if="
      lastImportArchive ||
      lastBuildDatabase ||
      (showNoDataWarning && !lastImportArchive && !lastBuildDatabase)
    "
    :class="{
      'alert-warning':
        showNoDataWarning && !lastImportArchive && !lastBuildDatabase,
      'alert-info': !(
        showNoDataWarning &&
        !lastImportArchive &&
        !lastBuildDatabase
      ),
      alert: true,
    }"
  >
    <div v-if="lastImportArchive">
      {{
        t("import.lastImportedArchive", { timeAgo: lastImportArchiveTimeAgo })
      }}
    </div>
    <div v-if="lastBuildDatabase">
      {{ t("import.lastBuiltDatabase", { timeAgo: lastBuildDatabaseTimeAgo }) }}
    </div>
    <div v-if="showNoDataWarning && !lastImportArchive && !lastBuildDatabase">
      <div class="d-flex align-items-center">
        <i class="fa-solid fa-triangle-exclamation fa-2x me-3" />
        <div>
          <template v-if="archiveOnly">
            {{ t("import.needImportForMigration") }}
          </template>
          <template v-else>
            {{ t("import.needImportOrBuild") }}
          </template>
        </div>
      </div>
    </div>
    <div v-if="showButton" class="text-center">
      <template v-if="archiveOnly">
        <button
          type="submit"
          class="btn btn-sm btn-primary mt-2"
          @click="emit('setState', State.WizardArchiveOnly)"
        >
          {{ t("import.importXArchive") }}
        </button>
      </template>
      <template v-else>
        <button
          type="submit"
          class="btn btn-sm btn-secondary mt-2"
          @click="emit('setState', State.WizardDatabase)"
        >
          <template v-if="lastImportArchive || lastBuildDatabase">
            {{ t("import.rebuildDatabase") }}
          </template>
          <template v-else> {{ t("import.buildDatabase") }} </template>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped></style>
