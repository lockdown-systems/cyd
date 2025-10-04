<script setup lang="ts">
/**
 * XView.vue - X Platform Wrapper
 *
 * Thin wrapper around PlatformView that handles X-specific logic:
 * - XViewModel instantiation
 * - X-specific state (rateLimitInfo, failure states, mediaPath)
 * - X-specific methods (archiveOnlyClicked, startJobs, etc.)
 * - X-specific event handlers
 */

import {
  Ref,
  ref,
  unref,
  watch,
  onMounted,
  onUnmounted,
  inject,
  getCurrentInstance,
  computed,
} from "vue";

import CydAPIClient from "../../../../cyd-api-client";

import type {
  Account,
  XProgress,
  XRateLimitInfo,
} from "../../../../shared_types";
import type { DeviceInfo } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import {
  XViewModel,
  State,
  FailureState,
  XViewModelState,
} from "../../view_models/XViewModel";
import {
  setAccountRunning,
  showQuestionOpenModePremiumFeature,
  setPremiumTasks,
  getJobsType,
  formatError,
} from "../../util";
import { xRequiresPremium, xPostProgress } from "../../util_x";
import { usePlatformView } from "../../composables/usePlatformView";
import { getPlatformConfig } from "../../config/platforms";
import PlatformView from "../PlatformView.vue";
import XProgressComponent from "./XProgressComponent.vue";
import XWizardTombstone from "./XWizardTombstone.vue";

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits(["onRefreshClicked", "onRemoveClicked"]);

const apiClient = inject("apiClient") as Ref<CydAPIClient>;
const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;

// X-specific state
const failureStateIndexTweets_FailedToRetryAfterRateLimit = ref(false);
const failureStateIndexLikes_FailedToRetryAfterRateLimit = ref(false);
const rateLimitInfo = ref<XRateLimitInfo | null>(null);
const mediaPath = ref("");

// The X view model
const model = ref<XViewModel>(new XViewModel(props.account, emitter));

// Template ref to PlatformView component
const platformViewRef = ref<InstanceType<typeof PlatformView> | null>(null);

// Use shared platform view composable
const {
  config,
  currentState,
  progress,
  currentJobs,
  isPaused,
  canStateLoopRun,
  clickingEnabled,
  userAuthenticated,
  userPremium,
  accountHeaderProps,
  speechBubbleProps,
  automationNoticeProps,
  webviewProps,
  updateAccount,
  updateUserAuthenticated,
  updateUserPremium,
  setState,
  startStateLoop,
  setupAuthListeners,
  setupPlatformEventHandlers,
  createAutomationHandlers,
  cleanup: platformCleanup,
  setupProviders,
  initializePlatformView,
} = usePlatformView(props.account, model, getPlatformConfig("X")!);

// Typed computed properties for template usage
const typedProgress = computed(() => progress.value as XProgress | null);

// X-specific state watcher for failure states
watch(
  () => model.value.state,
  async (newState) => {
    if (newState) {
      // Update X-specific failure states on state change
      failureStateIndexTweets_FailedToRetryAfterRateLimit.value =
        (await window.electron.X.getConfig(
          props.account.id,
          FailureState.indexTweets_FailedToRetryAfterRateLimit,
        )) == "true"
          ? true
          : false;
      failureStateIndexLikes_FailedToRetryAfterRateLimit.value =
        (await window.electron.X.getConfig(
          props.account.id,
          FailureState.indexLikes_FailedToRetryAfterRateLimit,
        )) == "true"
          ? true
          : false;
    }
  },
  { deep: true },
);

// Keep rateLimitInfo updated (X-specific)
watch(
  () => model.value.rateLimitInfo,
  (newRateLimitInfo) => {
    if (newRateLimitInfo) rateLimitInfo.value = newRateLimitInfo;
  },
  { deep: true },
);

// X-specific methods
const archiveOnlyClicked = async () => {
  model.value.cancelWaitForURL = true;
  await setState(State.WizardArchiveOnly.toString());
};

const onAutomationErrorRetry = async () => {
  console.log("Retrying automation after error");

  if (model.value.state == State.FinishedRunningJobsDisplay) {
    await setState(State.WizardReview.toString());
  } else {
    const state: XViewModelState | undefined = model.value.saveState();
    localStorage.setItem(
      `account-${props.account.id}-state`,
      JSON.stringify(state),
    );
    emit("onRefreshClicked");
  }
};

const onCancelAutomation = () => {
  console.log("Cancelling automation");
  emitter?.emit(`x-submit-progress-${props.account.id}`);
  emit("onRefreshClicked");
};

const automationHandlers = createAutomationHandlers(
  () => emit("onRefreshClicked"),
  onAutomationErrorRetry,
);

automationHandlers[`cancel-automation-${props.account.id}`] =
  onCancelAutomation;

const onReportBug = async () => {
  console.log("Report bug clicked");
  model.value.pause();
  await model.value.error(
    AutomationErrorType.X_manualBugReport,
    {
      message: "User is manually reporting a bug",
      state: model.value.saveState(),
    },
    {
      currentURL: model.value.webview?.getURL(),
    },
  );
};

const reloadMediaPath = async () => {
  mediaPath.value = await window.electron.X.getMediaPath(props.account.id);
  console.log("mediaPath", mediaPath.value);
};

const startJobs = async () => {
  if (model.value.account.xAccount == null) {
    console.error("startJobs", "Account is null");
    return;
  }

  if (model.value.account.xAccount.archiveOnly) {
    console.log("archiveOnly", model.value.account.xAccount.archiveOnly);
    await model.value.defineJobs();
    model.value.state = State.RunJobs;
    await startStateLoop();
    return;
  }

  if (
    model.value.account?.xAccount &&
    (await xRequiresPremium(
      model.value.account.id,
      model.value.account.xAccount,
    ))
  ) {
    if ((await window.electron.getMode()) == "open") {
      if (!(await showQuestionOpenModePremiumFeature())) {
        return;
      }
    } else {
      const jobsType = getJobsType(model.value.account.id);
      let premiumTasks: string[] = [];
      if (jobsType == "migrateBluesky") {
        premiumTasks = ["Migrate tweets to Bluesky"];
      }

      await updateUserAuthenticated();
      console.log("userAuthenticated", userAuthenticated.value);
      if (!userAuthenticated.value) {
        setPremiumTasks(model.value.account.id, premiumTasks);
        model.value.state = State.WizardCheckPremium;
        await startStateLoop();
        return;
      }

      await updateUserPremium();
      console.log("userPremium", userPremium.value);
      if (!userPremium.value) {
        setPremiumTasks(model.value.account.id, premiumTasks);
        model.value.state = State.WizardCheckPremium;
        await startStateLoop();
        return;
      }
    }
  }

  console.log("Starting jobs");
  await model.value.defineJobs();
  model.value.state = State.RunJobs;
  await startStateLoop();
};

const startJobsJustSave = async () => {
  if (model.value.account.xAccount == null) {
    console.error("startJobsJustSave", "Account is null");
    return;
  }

  const updatedAccount: Account = {
    ...model.value.account,
    xAccount: {
      ...model.value.account.xAccount,
      saveMyData: true,
      deleteMyData: false,
    },
  };

  await window.electron.database.saveAccount(JSON.stringify(updatedAccount));
  await updateAccount();

  model.value.state = State.WizardReview;
  await startStateLoop();
};

const finishedRunAgainClicked = async () => {
  model.value.state = State.WizardReview;
  await startStateLoop();
};

// Debug functions
const debugAutopauseEndOfStepChanged = async (value: boolean) => {
  model.value.debugAutopauseEndOfStep = value;
};

const debugModeTriggerError = async (count: number = 1) => {
  console.log("Debug mode error triggered", count);
  if (count == 1) {
    try {
      throw new Error("Debug mode error triggered");
    } catch (e) {
      await model.value.error(
        AutomationErrorType.x_unknownError,
        {
          error: formatError(e as Error),
        },
        {
          currentURL: model.value.webview?.getURL(),
        },
      );
    }
  } else {
    for (let i = 0; i < count; i++) {
      await model.value.error(
        AutomationErrorType.x_unknownError,
        {
          message: `Debug mode error triggered ${i + 1} of ${count}`,
        },
        {
          currentURL: model.value.webview?.getURL(),
        },
        true,
      );
    }
    await model.value.showErrorModal();
  }
};

const debugModeDisable = async () => {
  model.value.state = State.WizardPrestart;
};

// Lifecycle
onMounted(async () => {
  setupAuthListeners();
  setupProviders();

  await reloadMediaPath();

  if (platformViewRef.value?.webviewComponent !== null && platformViewRef.value?.webviewComponent !== undefined) {
    const webview = platformViewRef.value.webviewComponent;

    if (props.account.xAccount !== null) {
      await initializePlatformView(webview);

      const savedState = localStorage.getItem(
        `account-${props.account.id}-state`,
      );
      if (savedState) {
        console.log("Restoring saved state", savedState);
        const savedStateObj: XViewModelState = JSON.parse(savedState);

        model.value.restoreState(savedStateObj);
        currentState.value = savedStateObj.state as State;
        progress.value = savedStateObj.progress;
        currentJobs.value = savedStateObj.jobs;

        localStorage.removeItem(`account-${props.account.id}-state`);
      }

      await startStateLoop();
    }
  } else {
    console.error("Webview component not found");
  }

  setupPlatformEventHandlers(automationHandlers);

  // X-specific event handlers
  setupPlatformEventHandlers({
    [`x-submit-progress-${props.account.id}`]: async () => {
      await xPostProgress(apiClient.value, deviceInfo.value, props.account.id);
    },
    [`x-reload-media-path-${props.account.id}`]: async () => {
      await reloadMediaPath();
    },
  });
});

onUnmounted(async () => {
  canStateLoopRun.value = false;
  await platformCleanup();
  await setAccountRunning(props.account.id, false);
  await model.value.cleanup();
});
</script>

<template>
  <PlatformView
    ref="platformViewRef"
    :account="account"
    :config="config"
    :model="model"
    :current-state="currentState"
    :progress="progress"
    :current-jobs="currentJobs"
    :is-paused="isPaused"
    :clicking-enabled="clickingEnabled"
    :user-authenticated="userAuthenticated"
    :user-premium="userPremium"
    :account-header-props="accountHeaderProps"
    :speech-bubble-props="speechBubbleProps"
    :automation-notice-props="automationNoticeProps"
    :webview-props="webviewProps"
    :display-content-props="{ mediaPath }"
    :wizard-page-props="{
      failureStateIndexLikes_FailedToRetryAfterRateLimit:
        failureStateIndexLikes_FailedToRetryAfterRateLimit,
      failureStateIndexTweets_FailedToRetryAfterRateLimit:
        failureStateIndexTweets_FailedToRetryAfterRateLimit,
    }"
    @on-refresh-clicked="emit('onRefreshClicked')"
    @on-remove-clicked="emit('onRemoveClicked')"
    @set-state="setState($event)"
    @update-account="updateAccount"
    @start-jobs="startJobs"
    @start-jobs-just-save="startJobsJustSave"
    @finished-run-again-clicked="finishedRunAgainClicked"
    @update-user-premium="updateUserPremium"
    @archive-only-clicked="archiveOnlyClicked"
    @on-pause="model.pause()"
    @on-resume="model.resume()"
    @on-cancel="emit('onRefreshClicked')"
    @on-report-bug="onReportBug"
    @on-clicking-enabled="clickingEnabled = true"
    @on-clicking-disabled="clickingEnabled = false"
    @set-debug-autopause-end-of-step="debugAutopauseEndOfStepChanged"
  >
    <!-- X-specific progress extra: rate limit info -->
    <template #progress-extra>
      <XProgressComponent
        v-if="rateLimitInfo && rateLimitInfo.isRateLimited"
        :progress="typedProgress"
        :rate-limit-info="rateLimitInfo"
        :account-i-d="account.id"
      />
    </template>


    <!-- X-specific wizard content: Tombstone and Debug -->
    <template #wizard-content-extra>
      <XWizardTombstone
        v-if="model.state == State.WizardTombstoneDisplay"
        :model="unref(model)"
        @set-state="setState($event)"
        @update-account="updateAccount"
      />

      <div v-if="model.state == State.Debug">
        <p>Debug debug debug!!!</p>
        <p>
          <button class="btn btn-danger" @click="debugModeTriggerError(1)">
            Trigger Error
          </button>
        </p>
        <p>
          <button class="btn btn-danger" @click="debugModeTriggerError(3)">
            Trigger 3 Errors
          </button>
        </p>
        <p>
          <button class="btn btn-primary" @click="debugModeDisable">
            Cancel Debug Mode
          </button>
        </p>
      </div>
    </template>

  </PlatformView>
</template>
