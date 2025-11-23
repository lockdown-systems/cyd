<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { XViewModel, State } from "../../../view_models/XViewModel";
import { getBreadcrumbIcon, openURL } from "../../../util";
import { xHasSomeData } from "../../../util_x";

import XLastImportOrBuildComponent from "../components/XLastImportOrBuildComponent.vue";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";

const { t } = useI18n();

// Props
const props = defineProps<{
  model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
  setState: [value: State];
}>();

// Buttons
const nextClicked = async () => {
  if (buildDatabaseStrategy.value == "importArchive") {
    emit("setState", State.WizardImportStart);
  } else if (buildDatabaseStrategy.value == "buildFromScratch") {
    emit("setState", State.WizardBuildOptions);
  } else {
    emit("setState", State.WizardArchiveOptions);
  }
};

// Settings
const buildDatabaseStrategy = ref("importArchive");

enum RecommendedState {
  ImportArchive,
  BuildFromScratch,
  Unknown,
}
const recommendedState = ref(RecommendedState.Unknown);

const hasSomeData = ref(false);

onMounted(async () => {
  hasSomeData.value = await xHasSomeData(props.model.account.id);

  // If the user has a lot of data, recommend importing the archive
  if (props.model.account && props.model.account.xAccount) {
    if (
      props.model.account.xAccount.tweetsCount == -1 ||
      props.model.account.xAccount.likesCount == -1
    ) {
      recommendedState.value = RecommendedState.Unknown;
    } else if (
      props.model.account.xAccount.tweetsCount >= 2000 ||
      props.model.account.xAccount.likesCount >= 2000
    ) {
      recommendedState.value = RecommendedState.ImportArchive;
    } else {
      recommendedState.value = RecommendedState.BuildFromScratch;
    }
  }

  if (
    recommendedState.value == RecommendedState.ImportArchive ||
    recommendedState.value == RecommendedState.Unknown
  ) {
    buildDatabaseStrategy.value = "importArchive";
  } else {
    buildDatabaseStrategy.value = "buildFromScratch";
  }
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [
        {
          label: t('wizard.dashboard'),
          action: () => emit('setState', State.WizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
      ],
      label: t('review.localDatabase'),
      icon: getBreadcrumbIcon('database'),
    }"
    :button-props="{
      backButtons: [
        {
          label: t('wizard.backToDashboard'),
          action: () => emit('setState', State.WizardDashboard),
        },
      ],
      nextButtons: [
        {
          label:
            buildDatabaseStrategy == 'importArchive'
              ? t('wizard.continueToImportArchive')
              : buildDatabaseStrategy == 'buildFromScratch'
                ? t('wizard.continueToBuildOptions')
                : t('wizard.continueToArchiveOptions'),
          action: nextClicked,
        },
      ],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content">
        <h2>{{ t('wizard.buildYourLocalDatabase') }}</h2>
        <p class="text-muted">
          {{ t('wizard.buildYourLocalDatabaseDescription') }}
        </p>

        <XLastImportOrBuildComponent
          :account-i-d="model.account.id"
          :show-button="false"
          :show-no-data-warning="false"
          @set-state="emit('setState', $event)"
        />

        <!-- import archive recommended -->
        <template v-if="recommendedState == RecommendedState.ImportArchive">
          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'importArchive' }"
            @click="buildDatabaseStrategy = 'importArchive'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>
                  {{ t('wizard.importXArchiveRecommended') }}
                  <span class="ms-2 text-muted">{{ t('wizard.recommended') }}</span>
                </div>
                <small class="info text-muted">
                  {{ t('wizard.importXArchiveRecommendedDescription') }}
                </small>
              </div>
            </div>
          </div>

          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'buildFromScratch' }"
            @click="buildDatabaseStrategy = 'buildFromScratch'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>{{ t('wizard.buildFromScratch') }}</div>
                <small class="info text-muted">
                  {{ t('wizard.buildFromScratchDescription') }}
                  <a
                    href="#"
                    @click="
                      openURL(
                        'https://docs.cyd.social/docs/x/local-database/build',
                      )
                    "
                  >
                    {{ t('wizard.readMore') }}</a
                  >.
                </small>
              </div>
            </div>
          </div>

          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'archiveData' }"
            @click="buildDatabaseStrategy = 'archiveData'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>{{ t('wizard.saveHTMLTweetsDMsBookmarks') }}</div>
                <small class="info text-muted">
                  {{ t('wizard.saveHTMLTweetsDMsBookmarksDescription') }}
                </small>
              </div>
            </div>
          </div>
        </template>

        <!-- build from scratch recommended -->
        <template
          v-else-if="recommendedState == RecommendedState.BuildFromScratch"
        >
          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'buildFromScratch' }"
            @click="buildDatabaseStrategy = 'buildFromScratch'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>
                  {{ t('wizard.buildFromScratch') }}
                  <span class="ms-2 text-muted">{{ t('wizard.recommended') }}</span>
                </div>
                <small class="info text-muted">
                  {{ t('wizard.buildFromScratchRecommended') }}
                  <a
                    href="#"
                    @click="
                      openURL(
                        'https://docs.cyd.social/docs/x/local-database/build',
                      )
                    "
                  >
                    {{ t('wizard.readMore') }}</a
                  >.
                </small>
              </div>
            </div>
          </div>

          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'importArchive' }"
            @click="buildDatabaseStrategy = 'importArchive'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>{{ t('wizard.importXArchiveRecommended') }}</div>
                <small class="info text-muted">
                  {{ t('wizard.importArchiveDescription') }}
                </small>
              </div>
            </div>
          </div>

          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'archiveData' }"
            @click="buildDatabaseStrategy = 'archiveData'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>{{ t('wizard.saveHTMLTweetsDMsBookmarks') }}</div>
                <small class="info text-muted">
                  {{ t('wizard.saveHTMLTweetsDMsBookmarksDescription') }}
                </small>
              </div>
            </div>
          </div>
        </template>

        <!-- unknown which is better -->
        <template v-else>
          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'importArchive' }"
            @click="buildDatabaseStrategy = 'importArchive'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>
                  {{ t('wizard.importXArchiveRecommended') }}
                  <span class="ms-2 text-muted">{{ t('wizard.recommended') }}</span>
                </div>
                <small class="info text-muted">
                  {{ t('wizard.importArchiveUnknown') }}
                </small>
              </div>
            </div>
          </div>

          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'buildFromScratch' }"
            @click="buildDatabaseStrategy = 'buildFromScratch'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>{{ t('wizard.buildFromScratch') }}</div>
                <small class="info text-muted">
                  {{ t('wizard.buildFromScratchDescription') }}
                  <a
                    href="#"
                    @click="
                      openURL(
                        'https://docs.cyd.social/docs/x/local-database/build',
                      )
                    "
                  >
                    {{ t('wizard.readMore') }}</a
                  >.
                </small>
              </div>
            </div>
          </div>

          <div
            class="option-card card mb-3"
            :class="{ selected: buildDatabaseStrategy === 'archiveData' }"
            @click="buildDatabaseStrategy = 'archiveData'"
          >
            <div class="card-body d-flex align-items-center">
              <div>
                <div>{{ t('wizard.saveHTMLTweetsDMsBookmarks') }}</div>
                <small class="info text-muted">
                  {{ t('wizard.saveHTMLTweetsDMsBookmarksDescription') }}
                </small>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </BaseWizardPage>
</template>

<style scoped></style>
