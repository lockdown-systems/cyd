<script setup lang="ts">
import { ref, onMounted } from "vue";
import { formatDistanceToNow } from "date-fns";
import { State } from "../../view_models/XViewModel";
import { xGetLastImportArchive, xGetLastBuildDatabase } from "../../util_x";

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
      You last imported your X archive
      {{
        formatDistanceToNow(lastImportArchive, {
          addSuffix: true,
        })
      }}.
    </div>
    <div v-if="lastBuildDatabase">
      You last built your local database from scratch
      {{
        formatDistanceToNow(lastBuildDatabase, {
          addSuffix: true,
        })
      }}.
    </div>
    <div v-if="showNoDataWarning && !lastImportArchive && !lastBuildDatabase">
      <div class="d-flex align-items-center">
        <i class="fa-solid fa-triangle-exclamation fa-2x me-3" />
        <div>
          <template v-if="archiveOnly">
            You'll need to import your local database of tweets before you can
            migrate them to Bluesky.
          </template>
          <template v-else>
            You'll need to import your local database of tweets, or build it
            from scratch, before you can delete your tweets or likes, or migrate
            your tweets to Bluesky.
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
          Import X Archive
        </button>
      </template>
      <template v-else>
        <button
          type="submit"
          class="btn btn-sm btn-secondary mt-2"
          @click="emit('setState', State.WizardDatabase)"
        >
          <template v-if="lastImportArchive || lastBuildDatabase">
            Rebuild Your Local Database
          </template>
          <template v-else> Build Your Local Database </template>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped></style>
