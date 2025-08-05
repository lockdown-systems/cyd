<script setup lang="ts">
import { ref, onMounted } from "vue";
import { FacebookViewModel, State } from "../../view_models/FacebookViewModel";
import { setJobsType } from "../../util";

// Props
const props = defineProps<{
  model: FacebookViewModel;
}>();

// Emits
const emit = defineEmits<{
  updateAccount: [];
  setState: [value: State];
}>();

// Buttons
const nextClicked = async () => {
  await saveSettings();
  setJobsType(props.model.account.id, "save");
  emit("setState", State.WizardReview);
};

// Settings
const savePosts = ref(false);
const savePostsHTML = ref(false);

const loadSettings = async () => {
  console.log("FacebookWizardBuildOptionsPage", "loadSettings");
  const account = await window.electron.database.getAccount(
    props.model.account?.id,
  );
  if (account && account.facebookAccount) {
    savePosts.value = account.facebookAccount.savePosts;
    savePostsHTML.value = account.facebookAccount.savePostsHTML;
  }
};

const saveSettings = async () => {
  console.log("FacebookWizardBuildOptionsPage", "saveSettings");
  if (!props.model.account) {
    console.error(
      "FacebookWizardBuildOptionsPage",
      "saveSettings",
      "account is null",
    );
    return;
  }
  const account = await window.electron.database.getAccount(
    props.model.account?.id,
  );
  if (account && account.facebookAccount) {
    account.facebookAccount.savePosts = savePosts.value;
    account.facebookAccount.savePostsHTML = savePostsHTML.value;
    await window.electron.database.saveAccount(JSON.stringify(account));
    emit("updateAccount");
  }
};

onMounted(async () => {
  await loadSettings();
});
</script>

<template>
  <div class="wizard-content container mb-4 mt-3 mx-auto">
    <div class="mb-4">
      <h2>Build your local database</h2>
      <p class="text-muted">You can save posts.</p>
    </div>

    <form @submit.prevent>
      <div class="mb-3">
        <div class="form-check">
          <input
            id="savePosts"
            v-model="savePosts"
            type="checkbox"
            class="form-check-input"
          />
          <label class="form-check-label" for="savePosts">Save my posts</label>
        </div>
      </div>
      <div class="indent">
        <div class="mb-3">
          <div class="form-check">
            <input
              id="savePostsHTML"
              v-model="savePostsHTML"
              type="checkbox"
              class="form-check-input"
              :disabled="!savePosts"
            />
            <label class="form-check-label" for="savePostsHTML">
              Save an HTML version of each post
            </label>
          </div>
          <div class="indent">
            <small class="form-text text-muted">
              Make an HTML archive of each post, including its comments, which
              is good for taking screenshots
              <em>(takes longer)</em>
            </small>
          </div>
        </div>
      </div>

      <div class="buttons">
        <button
          type="submit"
          class="btn btn-primary text-nowrap m-1"
          :disabled="!savePosts"
          @click="nextClicked"
        >
          <i class="fa-solid fa-forward" />
          Continue to Review
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
