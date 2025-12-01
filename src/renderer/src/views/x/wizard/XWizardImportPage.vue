<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { XViewModel, State } from "../../../view_models/XViewModel";

import { getBreadcrumbIcon, openURL } from "../../../util";

const { t } = useI18n();

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
      label: t("wizard.dashboard"),
      action: () => emit("setState", State.WizardDashboard),
      icon: getBreadcrumbIcon("dashboard"),
    },
    {
      label: t("review.localDatabase"),
      action: backClicked,
      icon: getBreadcrumbIcon("database"),
    },
  ],
  label: t("import.importXArchive"),
  icon: getBreadcrumbIcon("import"),
}));

const buttonProps = computed(() => ({
  backButtons: [
    { label: t("wizard.backToLocalDatabase"), action: backClicked },
  ],
  nextButtons: [
    {
      label: t("wizard.iveDownloadedMyArchive"),
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
          <h2>{{ t("import.importXArchiveTitle") }}</h2>
          <p class="text-muted">
            {{ t("import.beforeImportSteps") }}
          </p>
          <ul class="x-archive-steps">
            <li>
              <strong
                >{{ t("import.visitDownloadPage") }}
                <a
                  href="#"
                  @click="openURL('https://x.com/settings/download_your_data')"
                >
                  https://x.com/settings/download_your_data</a
                >.</strong
              ><br />
              <small class="text-muted">{{
                t("import.mightNeedToSignIn")
              }}</small>
            </li>
            <li>
              <strong>{{ t("import.proveYourIdentity") }}</strong
              ><br />
              <small class="text-muted">{{
                t("import.proveIdentityDescription")
              }}</small>
            </li>
            <li>
              <strong>{{ t("import.clickRequestArchive") }}</strong>
            </li>
            <li>
              <strong>{{ t("import.bePatient") }}</strong
              ><br />
              <small class="text-muted">{{ t("import.waitForArchive") }}</small>
            </li>
            <li>
              <strong>{{ t("import.downloadZipFile") }}</strong
              ><br />
              <small class="text-muted">{{
                t("import.afterFollowingSteps")
              }}</small>
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
