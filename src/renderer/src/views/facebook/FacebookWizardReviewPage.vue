<script setup lang="ts">
import { ref, onMounted } from "vue";
import { FacebookViewModel, State } from "../../view_models/FacebookViewModel";
import { getJobsType } from "../../util";
import LoadingComponent from "../shared_components/LoadingComponent.vue";
import AlertStayAwake from "../shared_components/AlertStayAwake.vue";

// Props
const props = defineProps<{
  model: FacebookViewModel;
}>();

// Emits
const emit = defineEmits<{
  updateAccount: [];
  setState: [value: State];
  startJobs: [];
}>();

// Buttons
const nextClicked = async () => {
  emit("startJobs");
};

const loading = ref(true);
const jobsType = ref("");

const backClicked = async () => {
  if (jobsType.value == "save") {
    emit("setState", State.WizardBuildOptions);
  } else {
    // Display error
    console.error("Unknown review type:", jobsType.value);
    await window.electron.showError(
      "Oops, this is awkward. You clicked back, but I'm not sure where to go.",
    );
  }
};

onMounted(async () => {
  loading.value = true;

  jobsType.value = getJobsType(props.model.account.id) || "";

  loading.value = false;
});
</script>

<template>
  <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
    <div class="mb-4">
      <h2>Review your choices</h2>
    </div>

    <template v-if="loading">
      <LoadingComponent />
    </template>
    <template v-else>
      <form @submit.prevent>
        <div v-if="jobsType == 'save'">
          <h3>
            <i class="fa-solid fa-floppy-disk me-1" />
            Build a local database
          </h3>
          <ul>
            <li v-if="model.account?.facebookAccount?.savePosts">
              Save posts
              <ul>
                <li v-if="model.account?.facebookAccount?.savePostsHTML">
                  Save HTML versions of posts
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <div class="buttons">
          <button
            type="submit"
            class="btn btn-outline-secondary text-nowrap m-1"
            @click="backClicked"
          >
            <i class="fa-solid fa-backward" />
            <template v-if="jobsType == 'save'">
              Back to Build Options
            </template>
          </button>

          <button
            type="submit"
            class="btn btn-primary text-nowrap m-1"
            :disabled="!model.account?.facebookAccount?.savePosts"
            @click="nextClicked"
          >
            <i class="fa-solid fa-forward" />
            <template v-if="jobsType == 'save'"> Build Database </template>
          </button>
        </div>
      </form>

      <AlertStayAwake />
    </template>
  </div>
</template>

<style scoped></style>
