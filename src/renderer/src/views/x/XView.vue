<script setup lang="ts">
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

import AccountHeader from "../shared_components/AccountHeader.vue";
import SpeechBubble from "../shared_components/SpeechBubble.vue";
import AutomationNotice from "../shared_components/AutomationNotice.vue";

import XProgressComponent from "./XProgressComponent.vue";
import XJobStatusComponent from "./XJobStatusComponent.vue";

import XDisplayTweet from "./XDisplayTweet.vue";

import type {
  Account,
  XProgress,
  XJob,
  XRateLimitInfo,
} from "../../../../shared_types";
import type { DeviceInfo } from "../../types";
import { AutomationErrorType } from "../../automation_errors";
import {
  XViewModel,
  State,
  RunJobsState,
  FailureState,
  XViewModelState,
} from "../../view_models/XViewModel";
import {
  setAccountRunning,
  showQuestionOpenModePremiumFeature,
  openURL,
  setPremiumTasks,
  getJobsType,
  formatError,
} from "../../util";
import { xRequiresPremium, xPostProgress } from "../../util_x";
import LoadingComponent from "../shared_components/LoadingComponent.vue";
import { usePlatformView } from "../../composables/usePlatformView";
import { getPlatformConfig } from "../../config/platforms";

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits(["onRefreshClicked", "onRemoveClicked"]);

const apiClient = inject("apiClient") as Ref<CydAPIClient>;
const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;

const failureStateIndexTweets_FailedToRetryAfterRateLimit = ref(false);
const failureStateIndexLikes_FailedToRetryAfterRateLimit = ref(false);

const rateLimitInfo = ref<XRateLimitInfo | null>(null);

// The X view model
const model = ref<XViewModel>(new XViewModel(props.account, emitter));

// Use shared platform view composable for authentication and common state
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
  speechBubbleComponent,
  webviewComponent,
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
const typedCurrentJobs = computed(() => currentJobs.value as XJob[]);

// X-specific state watcher for failure states (composable handles basic state sync)
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

const archiveOnlyClicked = async () => {
  // Cancel any ongoing wait for URL
  model.value.cancelWaitForURL = true;
  await setState(State.WizardArchiveOnly.toString());
};

const onAutomationErrorRetry = async () => {
  console.log("Retrying automation after error");

  // If we're currently on the finished page, then move back to the review page
  if (model.value.state == State.FinishedRunningJobsDisplay) {
    await setState(State.WizardReview.toString());
  } else {
    // Store the state of the view model before the error
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

  // Submit progress to the API
  emitter?.emit(`x-submit-progress-${props.account.id}`);

  emit("onRefreshClicked");
};

// Create automation handlers using composable
const automationHandlers = createAutomationHandlers(
  () => emit("onRefreshClicked"), // onRefresh
  onAutomationErrorRetry, // onRetry (X-specific)
);

// Override the cancel handler to include X-specific logic
automationHandlers[`cancel-automation-${props.account.id}`] =
  onCancelAutomation;

const onReportBug = async () => {
  console.log("Report bug clicked");

  // Pause
  model.value.pause();

  // Submit error report
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

// Media path
const mediaPath = ref("");

const reloadMediaPath = async () => {
  mediaPath.value = await window.electron.X.getMediaPath(props.account.id);
  console.log("mediaPath", mediaPath.value);
};

const startJobs = async () => {
  if (model.value.account.xAccount == null) {
    console.error("startJobs", "Account is null");
    return;
  }

  // If in archive-only mode, skip authentication checks
  if (model.value.account.xAccount.archiveOnly) {
    // Log value of archiveOnly
    console.log("archiveOnly", model.value.account.xAccount.archiveOnly);
    await model.value.defineJobs();
    model.value.state = State.RunJobs;
    await startStateLoop();
    return;
  }

  // Premium check
  if (
    model.value.account?.xAccount &&
    (await xRequiresPremium(
      model.value.account.id,
      model.value.account.xAccount,
    ))
  ) {
    // In open mode, allow the user to continue
    if ((await window.electron.getMode()) == "open") {
      if (!(await showQuestionOpenModePremiumFeature())) {
        return;
      }
    }
    // Otherwise, make sure the user is authenticated
    else {
      // Determine the premium check reason and tasks -- defaults to deleting data
      const jobsType = getJobsType(model.value.account.id);
      let premiumTasks: string[] = [];
      if (jobsType == "migrateBluesky") {
        premiumTasks = ["Migrate tweets to Bluesky"];
      }

      // If the user is not authenticated, go to premium check
      await updateUserAuthenticated();
      console.log("userAuthenticated", userAuthenticated.value);
      if (!userAuthenticated.value) {
        setPremiumTasks(model.value.account.id, premiumTasks);
        model.value.state = State.WizardCheckPremium;
        await startStateLoop();
        return;
      }

      // If the user is authenticated but does not have a premium plan, go to premium check
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

  // All good, start the jobs
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

  if (webviewComponent.value !== null) {
    const webview = webviewComponent.value;

    // Start the state loop
    if (props.account.xAccount !== null) {
      await initializePlatformView(webview);

      // If there's a saved state from a retry, restore it
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

  // Setup automation event handlers using composable
  setupPlatformEventHandlers(automationHandlers);

  // Setup X-specific event handlers
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

  // Cleanup platform composable
  await platformCleanup();

  // Make sure the account isn't running and power save blocker is stopped
  await setAccountRunning(props.account.id, false);

  // Cleanup the view controller
  await model.value.cleanup();
});
</script>

<template>
  <div :class="['wrapper', `account-${account.id}`, 'd-flex', 'flex-column']">
    <AccountHeader
      v-bind="accountHeaderProps"
      @on-refresh-clicked="emit('onRefreshClicked')"
      @on-remove-clicked="emit('onRemoveClicked')"
    />

    <template v-if="model.state == State.WizardStart">
      <LoadingComponent />
    </template>

    <template v-if="model.state != State.WizardStart">
      <div class="d-flex ms-2">
        <div class="d-flex flex-column flex-grow-1">
          <!-- Speech bubble -->
          <SpeechBubble
            ref="speechBubbleComponent"
            v-bind="speechBubbleProps"
            class="mb-2"
            :class="{ 'w-100': currentJobs.length === 0 }"
          />

          <!-- Progress -->
          <XProgressComponent
            v-if="
              ((rateLimitInfo && rateLimitInfo.isRateLimited) || progress) &&
              model.state == State.RunJobs
            "
            :progress="typedProgress"
            :rate-limit-info="rateLimitInfo"
            :account-i-d="account.id"
          />
        </div>

        <div class="d-flex align-items-center">
          <!-- Job status -->
          <XJobStatusComponent
            v-if="currentJobs.length > 0 && model.state == State.RunJobs"
            :jobs="typedCurrentJobs"
            :is-paused="isPaused"
            :clicking-enabled="clickingEnabled"
            class="job-status-component"
            @on-pause="model.pause()"
            @on-resume="model.resume()"
            @on-cancel="emit('onRefreshClicked')"
            @on-report-bug="onReportBug"
            @on-clicking-enabled="clickingEnabled = true"
            @on-clicking-disabled="clickingEnabled = false"
          />
        </div>
      </div>

      <!-- U2F security key notice -->
      <p
        v-if="model.state == State.Login"
        class="u2f-info text-center text-muted small ms-2"
      >
        <i class="fa-solid fa-circle-info me-2" />
        If you use a U2F security key (like a Yubikey) for 2FA, press it when
        you see a white screen.
        <a href="#" @click="openURL('https://docs.cyd.social/docs/x/tips/u2f')"
          >Read more</a
        >.
      </p>

      <!-- Archive only option -->
      <div v-if="model.state == State.Login" class="text-center ms-2 mt-2 mb-4">
        <button class="btn btn-secondary" @click="archiveOnlyClicked">
          Import Archive Only (for deleted X accounts with an archive)
        </button>
      </div>

      <AutomationNotice v-bind="automationNoticeProps" />
    </template>

    <!-- Webview -->
    <webview ref="webviewComponent" v-bind="webviewProps" />

    <template v-if="model.state != State.WizardStart">
      <!-- RunJobs states -->
      <div
        :class="{
          hidden:
            model.showBrowser ||
            !(
              model.state == State.RunJobs &&
              model.runJobsState != RunJobsState.Default
            ),
          'run-jobs-state': true,
          'ms-2': true,
        }"
      >
        <div class="run-jobs-state-container d-flex">
          <div class="run-jobs-state-content flex-grow-1">
            <XDisplayTweet
              v-if="
                model.runJobsState == RunJobsState.DeleteTweets ||
                model.runJobsState == RunJobsState.DeleteRetweets ||
                model.runJobsState == RunJobsState.DeleteLikes ||
                model.runJobsState == RunJobsState.DeleteBookmarks ||
                model.runJobsState == RunJobsState.MigrateBluesky ||
                model.runJobsState == RunJobsState.MigrateBlueskyDelete
              "
              :model="unref(model)"
              :media-path="mediaPath"
            />
          </div>
        </div>
      </div>

      <!-- Wizard -->
      <div
        :class="{
          hidden: model.showBrowser || model.state == State.RunJobs,
          wizard: true,
          'ms-2': true,
        }"
      >
        <div class="wizard-container d-flex">
          <div class="wizard-content flex-grow-1">
            <!-- Dynamic wizard component rendering based on platform configuration -->
            <component
              :is="config.components.wizardPages[model.state]"
              v-if="config.components.wizardPages[model.state]"
              :model="unref(model)"
              :user-authenticated="userAuthenticated"
              :user-premium="userPremium"
              :failure-state-index-likes_-failed-to-retry-after-rate-limit="
                failureStateIndexLikes_FailedToRetryAfterRateLimit
              "
              :failure-state-index-tweets_-failed-to-retry-after-rate-limit="
                failureStateIndexTweets_FailedToRetryAfterRateLimit
              "
              @set-state="setState($event)"
              @update-account="updateAccount"
              @start-jobs="startJobs"
              @start-jobs-just-save="startJobsJustSave"
              @update-user-premium="updateUserPremium"
              @finished-run-again-clicked="finishedRunAgainClicked"
              @on-refresh-clicked="emit('onRefreshClicked')"
            />

            <!-- Debug state -->
            <div v-if="model.state == State.Debug">
              <p>Debug debug debug!!!</p>
              <p>
                <button
                  class="btn btn-danger"
                  @click="debugModeTriggerError(1)"
                >
                  Trigger Error
                </button>
              </p>
              <p>
                <button
                  class="btn btn-danger"
                  @click="debugModeTriggerError(3)"
                >
                  Trigger 3 Errors
                </button>
              </p>
              <p>
                <button class="btn btn-primary" @click="debugModeDisable">
                  Cancel Debug Mode
                </button>
              </p>
            </div>
          </div>

          <!-- Add the XWizardTombstone component -->
          <XWizardTombstone
            v-if="model.state == State.WizardTombstoneDisplay"
            :model="unref(model)"
            @set-state="setState($event)"
            @update-account="updateAccount"
          />

          <!-- Debug state -->
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

          <!-- wizard side bar, hide if archive only -->
          <component
            :is="config.components.wizardSidebar"
            v-if="
              model.state != State.WizardArchiveOnly &&
              config.components.wizardSidebar
            "
            :model="unref(model)"
            @set-state="setState($event)"
            @set-debug-autopause-end-of-step="debugAutopauseEndOfStepChanged"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.job-status-component {
  width: 220px;
}
</style>
