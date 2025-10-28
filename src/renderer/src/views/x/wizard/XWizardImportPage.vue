<script setup lang="ts">
import { computed } from "vue";
import { XViewModel, State } from "../../../view_models/XViewModel";

import { getBreadcrumbIcon, openURL } from "../../../util";

import XLastImportOrBuildComponent from "../components/XLastImportOrBuildComponent.vue";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";

// Props
const props = defineProps<{
  model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
  setState: [value: State];
}>();

// Buttons

const importClicked = async () => {
  emit("setState", State.WizardImporting);
};

const backClicked = async () => {
  emit("setState", State.WizardDatabase);
};

// Computed properties for button configuration
const breadcrumbProps = computed(() => ({
  buttons: [
    {
      label: "Dashboard",
      action: () => emit("setState", State.WizardDashboard),
      icon: getBreadcrumbIcon("dashboard"),
    },
    {
      label: "Local Database",
      action: backClicked,
      icon: getBreadcrumbIcon("database"),
    },
  ],
  label: "Import X Archive",
  icon: getBreadcrumbIcon("import"),
}));

const buttonProps = computed(() => ({
  backButtons: [{ label: "Back to Local Database", action: backClicked }],
  nextButtons: [
    {
      label: "I've Downloaded My Archive from X",
      action: importClicked,
      disabled: !(
        props.model.account?.xAccount?.archiveTweets ||
        props.model.account?.xAccount?.archiveLikes ||
        props.model.account?.xAccount?.archiveDMs
      ),
    },
  ],
}));
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="breadcrumbProps"
    :button-props="buttonProps"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>Import your X archive</h2>
          <p class="text-muted">
            Before you can import your X archive, you need to download it by
            following these steps:
          </p>
          <ul class="x-archive-steps">
            <li>
              <strong
                >Visit
                <a
                  href="#"
                  @click="openURL('https://x.com/settings/download_your_data')"
                >
                  https://x.com/settings/download_your_data</a
                >.</strong
              ><br />
              <small class="text-muted"
                >You might need to sign in to X first.</small
              >
            </li>
            <li>
              <strong>Prove your identity.</strong><br />
              <small class="text-muted"
                >You'll probably need to type your X password. You might also
                need to get a verification code sent to your email, or do other
                things to verify your identity.</small
              >
            </li>
            <li>
              <strong>Click the "Request archive" button.</strong>
            </li>
            <li>
              <strong>Be patient.</strong><br />
              <small class="text-muted"
                >After requesting your archive, you'll need to wait
                <strong>at least a day</strong>, and maybe longer. Sorry!</small
              >
            </li>
            <li>
              <strong>When it's ready, download the ZIP file from X.</strong
              ><br />
              <small class="text-muted"
                >After you've followed these steps and you have your archive ZIP
                file, click the button below.</small
              >
            </li>
          </ul>

          <XLastImportOrBuildComponent
            :account-i-d="model.account.id"
            :show-button="false"
            :show-no-data-warning="false"
            @set-state="emit('setState', $event)"
          />
        </div>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped>
ul.x-archive-steps {
  list-style-type: none;
  padding: 0 1em;
}

ul.x-archive-steps li {
  margin-bottom: 1em;
}
</style>
