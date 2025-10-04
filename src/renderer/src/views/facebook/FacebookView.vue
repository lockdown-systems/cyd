<script setup lang="ts">
/**
 * FacebookView.vue - Facebook Platform Wrapper
 *
 * Thin wrapper around PlatformView that handles Facebook-specific logic:
 * - FacebookViewModel instantiation
 * - Facebook-specific state and event handlers
 */

import {
  Ref,
  ref,
  onMounted,
  onUnmounted,
  inject,
  getCurrentInstance,
  nextTick,
} from "vue";

import CydAPIClient from "../../../../cyd-api-client";

import type { WebviewTag } from "electron";
import type { Account } from "../../../../shared_types";
import type { DeviceInfo } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import {
  FacebookViewModel,
  State,
  FacebookViewModelState,
} from "../../view_models/FacebookViewModel";
import { setAccountRunning } from "../../util";
import { facebookPostProgress } from "../../util_facebook";
import { usePlatformView } from "../../composables/usePlatformView";
import { getPlatformConfig } from "../../config/platforms";
import PlatformView from "../PlatformView.vue";

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits(["onRefreshClicked", "onRemoveClicked"]);

const apiClient = inject("apiClient") as Ref<CydAPIClient>;
const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;

// The Facebook view model
const model = ref<FacebookViewModel>(
  new FacebookViewModel(props.account, emitter),
);

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
  setState,
  startStateLoop,
  setupAuthListeners,
  setupPlatformEventHandlers,
  createAutomationHandlers,
  cleanup: platformCleanup,
  setupProviders,
  initializePlatformView,
} = usePlatformView(props.account, model, getPlatformConfig("Facebook")!);

// Facebook-specific methods
const onAutomationErrorRetry = async () => {
  console.log("Retrying automation after error");

  if (model.value.state == State.FinishedRunningJobsDisplay) {
    await setState(State.WizardReview.toString());
  } else {
    const state: FacebookViewModelState | undefined = model.value.saveState();
    localStorage.setItem(
      `account-${props.account.id}-state`,
      JSON.stringify(state),
    );
    emit("onRefreshClicked");
  }
};

const onCancelAutomation = () => {
  console.log("Cancelling automation");
  emitter?.emit(`facebook-submit-progress-${props.account.id}`);
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
    AutomationErrorType.facebook_manualBugReport,
    {
      message: "User is manually reporting a bug",
      state: model.value.saveState(),
    },
    {
      currentURL: model.value.webview?.getURL(),
    },
  );
};

const startJobs = async () => {
  if (model.value.account.facebookAccount == null) {
    console.error("startJobs", "Account is null");
    return;
  }

  // Premium check
  // if (model.value.account?.facebookAccount && await facebookRequiresPremium(model.value.account?.facebookAccount)) {
  //     // In open mode, allow the user to continue
  //     if (await window.electron.getMode() == "open") {
  //         if (!await showQuestionOpenModePremiumFeature()) {
  //             return;
  //         }
  //     }
  //     // Otherwise, make sure the user is authenticated
  //     else {
  //         await updateUserAuthenticated();
  //         console.log("userAuthenticated", userAuthenticated.value);
  //         if (!userAuthenticated.value) {
  //             model.value.state = State.WizardCheckPremium;
  //             await startStateLoop();
  //             return;
  //         }

  //         await updateUserPremium();
  //         console.log("userPremium", userPremium.value);
  //         if (!userPremium.value) {
  //             model.value.state = State.WizardCheckPremium;
  //             await startStateLoop();
  //             return;
  //         }
  //     }
  // }

  console.log("Starting jobs");
  await model.value.defineJobs();
  model.value.state = State.RunJobs;
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
        AutomationErrorType.facebook_unknownError,
        {
          message: "Debug mode error triggered",
        },
        {
          currentURL: model.value.webview?.getURL(),
        },
      );
    }
  } else {
    for (let i = 0; i < count; i++) {
      await model.value.error(
        AutomationErrorType.facebook_unknownError,
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
  model.value.state = State.WizardStart;
};

// Lifecycle
onMounted(async () => {
  setupAuthListeners();
  setupProviders();

  // Wait for child components to mount
  await nextTick();

  if (
    platformViewRef.value?.webviewComponent !== null &&
    platformViewRef.value?.webviewComponent !== undefined
  ) {
    const webview = platformViewRef.value.webviewComponent as WebviewTag;

    if (props.account.facebookAccount !== null) {
      await initializePlatformView(webview);

      const savedState = localStorage.getItem(
        `account-${props.account.id}-state`,
      );
      if (savedState) {
        console.log("Restoring saved state", savedState);
        const savedStateObj: FacebookViewModelState = JSON.parse(savedState);

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

  // Facebook-specific event handlers
  setupPlatformEventHandlers({
    [`facebook-submit-progress-${props.account.id}`]: async () => {
      await facebookPostProgress(
        apiClient.value,
        deviceInfo.value,
        props.account.id,
      );
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
    @on-refresh-clicked="emit('onRefreshClicked')"
    @on-remove-clicked="emit('onRemoveClicked')"
    @set-state="setState($event)"
    @update-account="updateAccount"
    @start-jobs="startJobs"
    @on-pause="model.pause()"
    @on-resume="model.resume()"
    @on-cancel="emit('onRefreshClicked')"
    @on-report-bug="onReportBug"
    @on-clicking-enabled="clickingEnabled = true"
    @on-clicking-disabled="clickingEnabled = false"
    @set-debug-autopause-end-of-step="debugAutopauseEndOfStepChanged"
  >
    <!-- Facebook-specific wizard content: Debug -->
    <template #wizard-content-extra>
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
