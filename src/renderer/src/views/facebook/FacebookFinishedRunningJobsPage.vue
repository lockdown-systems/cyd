<script setup lang="ts">
import { ref, onMounted } from "vue";
import { FacebookViewModel, State } from "../../view_models/FacebookViewModel";
import { getJobsType } from "../../util";
import UpsellComponent from "../shared_components/UpsellComponent.vue";

// Props
const props = defineProps<{
  model: FacebookViewModel;
}>();

// Emits
const emit = defineEmits<{
  setState: [value: State];
  onRefreshClicked: [];
}>();

// Buttons
const nextClicked = async () => {
  emit("setState", State.WizardStart);
};

// Settings
const archivePath = ref("");

const updateArchivePath = async () => {
  const path = await window.electron.getAccountDataPath(
    props.model.account.id,
    "",
  );
  archivePath.value = path ? path : "";
};

const jobsType = ref("");

onMounted(async () => {
  jobsType.value = getJobsType(props.model.account.id) || "";
  console.log(jobsType.value);

  await props.model.reloadAccount();
  await updateArchivePath();
});
</script>

<template>
  <div class="finished">
    <div v-if="jobsType == 'save'" class="container mt-3">
      <div class="finished">
        <h2>You just saved:</h2>
        <ul>
          <li v-if="(model.progress.storiesSaved ?? 0) > 0">
            <i class="fa-solid fa-floppy-disk archive-bullet" />
            <strong>{{ model.progress.storiesSaved.toLocaleString() }}</strong>
            posts
          </li>
        </ul>

        <p>
          Your Facebook archive is stored locally on your computer at
          <code>{{ archivePath }}</code
          >.
        </p>
      </div>
    </div>

    <div class="buttons">
      <button class="btn btn-primary" @click="nextClicked">
        <i class="fa-solid fa-forward" />
        Continue
      </button>
    </div>

    <UpsellComponent class="mt-4" />
  </div>
</template>

<style scoped></style>
