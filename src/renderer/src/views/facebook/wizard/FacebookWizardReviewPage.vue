<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  FacebookViewModel,
  State,
} from "../../../view_models/FacebookViewModel";
import { getBreadcrumbIcon, getJobsType } from "../../../util";
import type { StandardWizardPageProps } from "../../../types/WizardPage";
import { useWizardPage } from "../../../composables/useWizardPage";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";
import LoadingComponent from "../../shared_components/LoadingComponent.vue";
import AlertStayAwake from "../../shared_components/AlertStayAwake.vue";

const { t } = useI18n();

// Props
interface Props extends StandardWizardPageProps {
  model: FacebookViewModel;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits([
  "set-state",
  "update-account",
  "start-jobs",
  "start-jobs-just-save",
  "update-user-premium",
  "finished-run-again-clicked",
  "on-refresh-clicked",
  "next-clicked",
  "back-clicked",
  "cancel-clicked",
  "updateAccount",
  "setState",
  "startJobs",
]);

// Use wizard page composable
const { isLoading, setLoading } = useWizardPage();

const jobsType = ref("");

// Custom next handler
const nextClicked = async () => {
  emit("startJobs");
};

// Custom back handler
const backClicked = async () => {
  if (jobsType.value == "save") {
    emit("setState", State.WizardBuildOptions);
  } else {
    console.error("Unknown review type:", jobsType.value);
    await window.electron.showError(
      t("facebook.unknownReviewType"),
    );
  }
};

// Dynamic button labels
const backButtonLabel = computed(() => {
  if (jobsType.value == "save") return t("facebook.backToBuildOptions");
  return "";
});

const nextButtonLabel = computed(() => {
  if (jobsType.value == "save") return t("facebook.buildDatabase");
  return "";
});

// Dynamic breadcrumb buttons
const breadcrumbButtons = computed(() => {
  const buttons = [];
  if (jobsType.value == "save") {
    buttons.push({
      label: t("facebook.buildOptions"),
      action: () => emit("setState", State.WizardBuildOptions),
      icon: getBreadcrumbIcon("build"),
    });
  }
  return buttons;
});

// Next button disabled state
const isNextDisabled = computed(() => {
  return !props.model.account?.facebookAccount?.savePosts;
});

onMounted(async () => {
  setLoading(true);
  jobsType.value = getJobsType(props.model.account.id) || "";
  setLoading(false);
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: breadcrumbButtons,
      label: t('wizard.review'),
      icon: getBreadcrumbIcon('review'),
    }"
    :button-props="{
      backButtons: [
        {
          label: backButtonLabel,
          action: backClicked,
          disabled: isLoading,
        },
      ],
      nextButtons: [
        {
          label: nextButtonLabel,
          action: nextClicked,
          disabled: isLoading || isNextDisabled,
        },
      ],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <div class="mb-4">
          <h2>{{ t('facebook.reviewChoices') }}</h2>
        </div>

        <template v-if="isLoading">
          <LoadingComponent />
        </template>
        <template v-else>
          <form @submit.prevent>
            <div v-if="jobsType == 'save'">
              <h3>
                <i class="fa-solid fa-floppy-disk me-1" />
                {{ t('facebook.buildLocalDatabase') }}
              </h3>
              <ul>
                <li v-if="model.account?.facebookAccount?.savePosts">
                  {{ t('facebook.savePosts') }}
                  <ul>
                    <li v-if="model.account?.facebookAccount?.savePostsHTML">
                      {{ t('facebook.savePostsHTML') }}
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </form>

          <AlertStayAwake />
        </template>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped></style>
