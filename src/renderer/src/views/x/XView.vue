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
  provide,
} from "vue";
import Electron from "electron";

import CydAPIClient from "../../../../cyd-api-client";
import { UserPremiumAPIResponse } from "../../../../cyd-api-client";

import AccountHeader from "../shared_components/AccountHeader.vue";
import SpeechBubble from "../shared_components/SpeechBubble.vue";
import AutomationNotice from "../shared_components/AutomationNotice.vue";

import XProgressComponent from "./XProgressComponent.vue";
import XJobStatusComponent from "./XJobStatusComponent.vue";

import XWizardDashboard from "./XWizardDashboard.vue";
import XWizardDatabasePage from "./XWizardDatabasePage.vue";
import XWizardImportPage from "./XWizardImportPage.vue";
import XWizardImportingPage from "./XWizardImportingPage.vue";
import XWizardBuildOptionsPage from "./XWizardBuildOptionsPage.vue";
import XWizardArchiveOptionsPage from "./XWizardArchiveOptionsPage.vue";
import XWizardDeleteOptionsPage from "./XWizardDeleteOptionsPage.vue";
import XWizardReviewPage from "./XWizardReviewPage.vue";
import XWizardCheckPremium from "./XWizardCheckPremium.vue";
import XWizardMigrateBluesky from "./XWizardMigrateBluesky.vue";
import XWizardFinished from "./XWizardFinished.vue";
import XWizardSidebar from "./XWizardSidebar.vue";
import XWizardArchiveOnly from "./XWizardArchiveOnly.vue";

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

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits(["onRefreshClicked", "onRemoveClicked"]);

const apiClient = inject("apiClient") as Ref<CydAPIClient>;
const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;

const currentState = ref<State>(State.Login);
const failureStateIndexTweets_FailedToRetryAfterRateLimit = ref(false);
const failureStateIndexLikes_FailedToRetryAfterRateLimit = ref(false);

const progress = ref<XProgress | null>(null);
const rateLimitInfo = ref<XRateLimitInfo | null>(null);
const currentJobs = ref<XJob[]>([]);
const isPaused = ref<boolean>(false);

const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);
const canStateLoopRun = ref(true);

// The X view model
const model = ref<XViewModel>(new XViewModel(props.account, emitter));

// Keep currentState in sync
watch(
  () => model.value.state,
  async (newState) => {
    if (newState) {
      currentState.value = newState as State;
      // Update failure states on state change
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

// Keep progress updated
watch(
  () => model.value.progress,
  (newProgress) => {
    if (newProgress) progress.value = newProgress;
  },
  { deep: true },
);

// Keep rateLimitInfo updated
watch(
  () => model.value.rateLimitInfo,
  (newRateLimitInfo) => {
    if (newRateLimitInfo) rateLimitInfo.value = newRateLimitInfo;
  },
  { deep: true },
);

// Keep jobs status updated
watch(
  () => model.value.jobs,
  (newJobs) => {
    if (newJobs) currentJobs.value = newJobs;
  },
  { deep: true },
);

// Keep isPaused updated
watch(
  () => model.value.isPaused,
  (newIsPaused) => {
    if (newIsPaused !== undefined) isPaused.value = newIsPaused;
  },
  { deep: true },
);

const updateAccount = async () => {
  await model.value.reloadAccount();
  emitter?.emit("account-updated");
};

const setState = async (state: State) => {
  console.log("Setting state", state);
  model.value.state = state;
  await startStateLoop();
};

const archiveOnlyClicked = async () => {
  // Cancel any ongoing wait for URL
  model.value.cancelWaitForURL = true;
  await setState(State.WizardArchiveOnly);
};

const startStateLoop = async () => {
  console.log("State loop started");
  await setAccountRunning(props.account.id, true);

  while (canStateLoopRun.value) {
    // Run next state
    await model.value.run();

    // Break out of the state loop if the view model is in a display state
    if ((model.value.state as string).endsWith("Display")) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await setAccountRunning(props.account.id, false);
  console.log("State loop ended");
};

const onAutomationErrorRetry = async () => {
  console.log("Retrying automation after error");

  // If we're currently on the finished page, then move back to the review page
  if (model.value.state == State.FinishedRunningJobsDisplay) {
    await setState(State.WizardReview);
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

const onAutomationErrorCancel = () => {
  console.log("Cancelling automation after error");
  emit("onRefreshClicked");
};

const onAutomationErrorResume = () => {
  console.log("Resuming after after error");
  model.value.resume();
};

const onCancelAutomation = () => {
  console.log("Cancelling automation");

  // Submit progress to the API
  emitter.value.emit(`x-submit-progress-${props.account.id}`);

  emit("onRefreshClicked");
};

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

// Enable/disable clicking in the webview
const clickingEnabled = ref(false);

// User variables
const userAuthenticated = ref(false);
const userPremium = ref(false);

const updateUserAuthenticated = async () => {
  userAuthenticated.value =
    (await apiClient.value.ping()) && deviceInfo.value?.valid ? true : false;
  console.log(
    "updateUserAuthenticated",
    "User authenticated",
    userAuthenticated.value,
  );
};
provide("xUpdateUserAuthenticated", updateUserAuthenticated);

const updateUserPremium = async () => {
  if (!userAuthenticated.value) {
    return;
  }

  // Check if the user has premium
  let userPremiumResp: UserPremiumAPIResponse;
  const resp = await apiClient.value.getUserPremium();
  if (resp && "error" in resp === false) {
    userPremiumResp = resp;
  } else {
    await window.electron.showMessage(
      "Failed to check if you have Premium access.",
      "Please try again later.",
    );
    return;
  }
  userPremium.value = userPremiumResp.premium_access;

  if (!userPremium.value) {
    console.log("User does not have Premium access");
    emitter?.emit(`x-premium-check-failed-${props.account.id}`);
  }

  console.log("updateUserPremium", "User premium", userPremiumResp);
};
provide("xUpdateUserPremium", updateUserPremium);

emitter?.on("signed-in", async () => {
  console.log("XView: User signed in");
  await updateUserAuthenticated();
  await updateUserPremium();
});

emitter?.on("signed-out", async () => {
  console.log("XView: User signed out");
  userAuthenticated.value = false;
  userPremium.value = false;
});

emitter?.on(`x-submit-progress-${props.account.id}`, async () => {
  await xPostProgress(apiClient.value, deviceInfo.value, props.account.id);
});

emitter?.on(`x-reload-media-path-${props.account.id}`, async () => {
  await reloadMediaPath();
});

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
  await reloadMediaPath();

  if (webviewComponent.value !== null) {
    const webview = webviewComponent.value;

    // Start the state loop
    if (props.account.xAccount !== null) {
      await model.value.init(webview);

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

  // Emitter for the view model to cancel automation
  emitter?.on(`cancel-automation-${props.account.id}`, onCancelAutomation);

  // Define automation error handlers on the global emitter for this account
  emitter?.on(
    `automation-error-${props.account.id}-retry`,
    onAutomationErrorRetry,
  );
  emitter?.on(
    `automation-error-${props.account.id}-cancel`,
    onAutomationErrorCancel,
  );
  emitter?.on(
    `automation-error-${props.account.id}-resume`,
    onAutomationErrorResume,
  );
});

onUnmounted(async () => {
  canStateLoopRun.value = false;

  // Make sure the account isn't running and power save blocker is stopped
  await setAccountRunning(props.account.id, false);

  // Remove cancel automation handler
  emitter?.off(`cancel-automation-${props.account.id}`, onCancelAutomation);

  // Remove automation error handlers
  emitter?.off(
    `automation-error-${props.account.id}-retry`,
    onAutomationErrorRetry,
  );
  emitter?.off(
    `automation-error-${props.account.id}-cancel`,
    onAutomationErrorCancel,
  );
  emitter?.off(
    `automation-error-${props.account.id}-resume`,
    onAutomationErrorResume,
  );

  // Cleanup the view controller
  await model.value.cleanup();
});
</script>

<template>
  <div :class="['wrapper', `account-${account.id}`, 'd-flex', 'flex-column']">
    <AccountHeader
      :account="account"
      :show-refresh-button="true"
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
            :message="model.instructions || ''"
            class="mb-2"
            :class="{ 'w-100': currentJobs.length === 0 }"
          />

          <!-- Progress -->
          <XProgressComponent
            v-if="
              ((rateLimitInfo && rateLimitInfo.isRateLimited) || progress) &&
              model.state == State.RunJobs
            "
            :progress="progress"
            :rate-limit-info="rateLimitInfo"
            :account-i-d="account.id"
          />
        </div>

        <div class="d-flex align-items-center">
          <!-- Job status -->
          <XJobStatusComponent
            v-if="currentJobs.length > 0 && model.state == State.RunJobs"
            :jobs="currentJobs"
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

      <AutomationNotice
        :show-browser="model.showBrowser"
        :show-automation-notice="model.showAutomationNotice"
      />
    </template>

    <!-- Webview -->
    <webview
      ref="webviewComponent"
      src="about:blank"
      class="webview"
      :partition="`persist:account-${account.id}`"
      :class="{
        hidden: !model.showBrowser,
        'webview-automation-border': model.showAutomationNotice,
        'webview-input-border': !model.showAutomationNotice,
        'webview-clickable': clickingEnabled,
      }"
    />

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
            <XWizardDashboard
              v-if="model.state == State.WizardDashboardDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
            />

            <XWizardDatabasePage
              v-if="model.state == State.WizardDatabaseDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
            />

            <XWizardImportPage
              v-if="model.state == State.WizardImportStartDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
            />

            <XWizardImportingPage
              v-if="model.state == State.WizardImportingDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
            />

            <XWizardBuildOptionsPage
              v-if="model.state == State.WizardBuildOptionsDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
              @update-account="updateAccount"
            />

            <XWizardArchiveOptionsPage
              v-if="model.state == State.WizardArchiveOptionsDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
              @update-account="updateAccount"
            />

            <XWizardDeleteOptionsPage
              v-if="model.state == State.WizardDeleteOptionsDisplay"
              :model="unref(model)"
              :user-authenticated="userAuthenticated"
              :user-premium="userPremium"
              @update-account="updateAccount"
              @set-state="setState($event)"
            />

            <XWizardReviewPage
              v-if="model.state == State.WizardReviewDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
              @update-account="updateAccount"
              @start-jobs="startJobs"
            />

            <XWizardCheckPremium
              v-if="model.state == State.WizardCheckPremiumDisplay"
              :model="unref(model)"
              :user-authenticated="userAuthenticated"
              :user-premium="userPremium"
              @set-state="setState($event)"
              @update-account="updateAccount"
              @start-jobs-just-save="startJobsJustSave"
              @update-user-premium="updateUserPremium"
            />

            <XWizardMigrateBluesky
              v-if="model.state == State.WizardMigrateToBlueskyDisplay"
              :model="unref(model)"
              :user-authenticated="userAuthenticated"
              :user-premium="userPremium"
              @set-state="setState($event)"
            />

            <XWizardFinished
              v-if="model.state == State.FinishedRunningJobsDisplay"
              :model="unref(model)"
              :failure-state-index-likes_-failed-to-retry-after-rate-limit="
                failureStateIndexLikes_FailedToRetryAfterRateLimit
              "
              :failure-state-index-tweets_-failed-to-retry-after-rate-limit="
                failureStateIndexTweets_FailedToRetryAfterRateLimit
              "
              @set-state="setState($event)"
              @finished-run-again-clicked="finishedRunAgainClicked"
              @on-refresh-clicked="emit('onRefreshClicked')"
            />

            <XWizardArchiveOnly
              v-if="model.state == State.WizardArchiveOnlyDisplay"
              :model="unref(model)"
              @set-state="setState($event)"
              @update-account="updateAccount"
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

          <!-- wizard side bar, hide if archive only -->
          <XWizardSidebar
            v-if="model.state != State.WizardArchiveOnly"
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
