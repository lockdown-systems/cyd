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
} from 'vue'
import Electron from 'electron';

import CydAPIClient from '../../../../cyd-api-client';
import { UserPremiumAPIResponse } from "../../../../cyd-api-client";

import AccountHeader from '../shared_components/AccountHeader.vue';
import SpeechBubble from '../shared_components/SpeechBubble.vue';

import XProgressComponent from './XProgressComponent.vue';
import XJobStatusComponent from './XJobStatusComponent.vue';

import XWizardStartPage from './XWizardStartPage.vue';
import XWizardBuildDatabasePage from './XWizardBuildDatabasePage.vue';
import XWizardImportPage from './XWizardImportPage.vue';
import XWizardImportDownloadPage from './XWizardImportDownloadPage.vue';
import XWizardImportOptionsPage from './XWizardImportOptionsPage.vue';
import XWizardSaveOptionsPage from './XWizardSaveOptionsPage.vue';
import XWizardDeleteOptionsPage from './XWizardDeleteOptionsPage.vue';
import XWizardReviewPage from './XWizardReviewPage.vue';
import XWizardDeleteReviewPage from './XWizardDeleteReviewPage.vue';
import XWizardCheckPremium from './XWizardCheckPremium.vue';
import XFinishedRunningJobsPage from './XFinishedRunningJobsPage.vue';
import XWizardSidebar from './XWizardSidebar.vue';

import type {
    Account,
    XProgress,
    XJob,
    XRateLimitInfo,
} from '../../../../shared_types';
import type { DeviceInfo } from '../../types';
import { AutomationErrorType } from '../../automation_errors';
import { AccountXViewModel, State, FailureState, XViewModelState } from '../../view_models/AccountXViewModel'
import { setAccountRunning, openURL } from '../../util';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const props = defineProps<{
    account: Account;
}>();

const emit = defineEmits(['onRefreshClicked', 'onRemoveClicked']);

const apiClient = inject('apiClient') as Ref<CydAPIClient>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;

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
const model = ref<AccountXViewModel>(new AccountXViewModel(props.account, emitter));

// Keep currentState in sync
watch(
    () => model.value.state,
    async (newState) => {
        if (newState) {
            currentState.value = newState as State;
            // Update failure states on state change
            failureStateIndexTweets_FailedToRetryAfterRateLimit.value = await window.electron.X.getConfig(props.account.id, FailureState.indexTweets_FailedToRetryAfterRateLimit) == "true" ? true : false;
            failureStateIndexLikes_FailedToRetryAfterRateLimit.value = await window.electron.X.getConfig(props.account.id, FailureState.indexLikes_FailedToRetryAfterRateLimit) == "true" ? true : false;
        }
    },
    { deep: true, }
);

// Keep progress updated
watch(
    () => model.value.progress,
    (newProgress) => { if (newProgress) progress.value = newProgress; },
    { deep: true, }
);

// Keep rateLimitInfo updated
watch(
    () => model.value.rateLimitInfo,
    (newRateLimitInfo) => { if (newRateLimitInfo) rateLimitInfo.value = newRateLimitInfo; },
    { deep: true, }
);

// Keep jobs status updated
watch(
    () => model.value.jobs,
    (newJobs) => { if (newJobs) currentJobs.value = newJobs; },
    { deep: true, }
);

// Keep isPaused updated
watch(
    () => model.value.isPaused,
    (newIsPaused) => { if (newIsPaused !== undefined) isPaused.value = newIsPaused; },
    { deep: true, }
);

const updateAccount = async () => {
    await model.value.reloadAccount();
    emitter?.emit('account-updated');
};

const setState = async (state: State) => {
    model.value.state = state;
};

const startStateLoop = async () => {
    console.log('State loop started');
    await setAccountRunning(props.account.id, true);

    while (canStateLoopRun.value) {
        // Run next state
        await model.value.run();

        // Break out of the state loop if the view model is in a display state
        if ((model.value.state as string).endsWith('Display')) {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await setAccountRunning(props.account.id, false);
    console.log('State loop ended');
};

const onAutomationErrorRetry = () => {
    console.log('Retrying automation after error');

    // Store the state of the view model before the error
    const state: XViewModelState | undefined = model.value.saveState();
    localStorage.setItem(`account-${props.account.id}-state`, JSON.stringify(state));
    emit('onRefreshClicked');
};

const onAutomationErrorCancel = () => {
    console.log('Cancelling automation after error');
    emit('onRefreshClicked');
};

const onAutomationErrorResume = () => {
    console.log('Resuming after after error');
    model.value.resume();
};

const onCancelAutomation = () => {
    console.log('Cancelling automation');
    emit('onRefreshClicked');
};

const onReportBug = async () => {
    console.log('Report bug clicked');

    // Pause
    model.value.pause();

    // Submit error report
    await model.value.error(AutomationErrorType.X_manualBugReport, {
        message: 'User is manually reporting a bug',
        state: model.value.saveState()
    }, {
        currentURL: model.value.webview?.getURL()
    });
}

// User variables
const userAuthenticated = ref(false);
const userPremium = ref(false);

const updateUserAuthenticated = async () => {
    userAuthenticated.value = await apiClient.value.ping() && deviceInfo.value?.valid ? true : false;
};

const updateUserPremium = async () => {
    if (!userAuthenticated.value) {
        return;
    }

    // Check if the user has premium
    let userPremiumResp: UserPremiumAPIResponse;
    const resp = await apiClient.value.getUserPremium();
    if (resp && 'error' in resp === false) {
        userPremiumResp = resp;
    } else {
        await window.electron.showMessage("Failed to check if you have Premium access. Please try again later.");
        return;
    }
    userPremium.value = userPremiumResp.premium_access;
};

emitter?.on('signed-in', async () => {
    console.log('AccountXView: User signed in');
    await updateUserAuthenticated();
    await updateUserPremium();
    if (!userPremium.value) {
        emitter?.emit('show-manage-account');
    }
});

emitter?.on('signed-out', async () => {
    console.log('AccountXView: User signed out');
    userAuthenticated.value = false;
    userPremium.value = false;
});

emitter?.on(`x-submit-progress-${props.account.id}`, async () => {
    const progressInfo = await window.electron.X.getProgressInfo(props.account.id);
    console.log("AccountXView: submitting progress", "progressInfo", JSON.parse(JSON.stringify(progressInfo)));
    const postXProgresResp = await apiClient.value.postXProgress({
        account_uuid: progressInfo.accountUUID,
        total_tweets_indexed: progressInfo.totalTweetsIndexed,
        total_tweets_archived: progressInfo.totalTweetsArchived,
        total_retweets_indexed: progressInfo.totalRetweetsIndexed,
        total_likes_indexed: progressInfo.totalLikesIndexed,
        total_unknown_indexed: progressInfo.totalUnknownIndexed,
        total_tweets_deleted: progressInfo.totalTweetsDeleted,
        total_retweets_deleted: progressInfo.totalRetweetsDeleted,
        total_likes_deleted: progressInfo.totalLikesDeleted,
    }, deviceInfo.value?.valid ? true : false)
    if (postXProgresResp !== true && postXProgresResp !== false && postXProgresResp.error) {
        // Silently log the error and continue
        console.log("AccountXView: submitting progress", "failed to post progress to the API", postXProgresResp.message);
    }
});

const startJobs = async (deleteFromDatabase: boolean, chanceToReview: boolean) => {
    // Premium check
    if (model.value.account.xAccount?.deleteMyData) {
        await updateUserAuthenticated();
        console.log("userAuthenticated", userAuthenticated.value);
        if (!userAuthenticated.value) {
            model.value.state = State.WizardCheckPremium;
            await startStateLoop();
            return;
        }

        await updateUserPremium();
        console.log("userPremium", userPremium.value);
        if (!userPremium.value) {
            model.value.state = State.WizardCheckPremium;
            await startStateLoop();
            return;
        }
    }

    // If chance to review is checked, make isDeleteReview active
    model.value.isDeleteReviewActive = chanceToReview;

    // All good, start the jobs
    console.log('Starting jobs');
    await model.value.defineJobs();
    if (model.value.account.xAccount?.deleteMyData && deleteFromDatabase) {
        model.value.state = State.WizardDeleteReview;
    } else {
        model.value.state = State.RunJobs;
    }
    await startStateLoop();
};

const startJobsDeleteReview = async () => {
    await model.value.defineJobs(true);
    model.value.isDeleteReviewActive = false;
    model.value.state = State.RunJobs;
    await startStateLoop();
};

const startJobsJustSave = async () => {
    if (model.value.account.xAccount == null) {
        console.error('startJobsJustSave', 'Account is null');
        return;
    }

    const updatedAccount: Account = {
        ...model.value.account,
        xAccount: {
            ...model.value.account.xAccount,
            saveMyData: true,
            deleteMyData: false,
        }
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

const debugModeTriggerError = async () => {
    await model.value.error(AutomationErrorType.x_unknownError, {
        message: 'Debug mode error triggered'
    }, {
        currentURL: model.value.webview?.getURL()
    });
};

const debugModeDisable = async () => {
    model.value.state = State.WizardPrestart;
};

// Lifecycle

onMounted(async () => {
    if (webviewComponent.value !== null) {
        const webview = webviewComponent.value;

        // Start the state loop
        if (props.account.xAccount !== null) {
            await model.value.init(webview);

            // If there's a saved state from a retry, restore it
            const savedState = localStorage.getItem(`account-${props.account.id}-state`);
            if (savedState) {
                console.log('Restoring saved state', savedState);
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
        console.error('Webview component not found');
    }

    // Emitter for the view model to cancel automation
    emitter?.on(`cancel-automation-${props.account.id}`, onCancelAutomation);

    // Define automation error handlers on the global emitter for this account
    emitter?.on(`automation-error-${props.account.id}-retry`, onAutomationErrorRetry);
    emitter?.on(`automation-error-${props.account.id}-cancel`, onAutomationErrorCancel);
    emitter?.on(`automation-error-${props.account.id}-resume`, onAutomationErrorResume);
});

onUnmounted(async () => {
    canStateLoopRun.value = false;

    // Make sure the account isn't running and power save blocker is stopped
    await setAccountRunning(props.account.id, false);

    // Remove cancel automation handler
    emitter?.off(`cancel-automation-${props.account.id}`, onCancelAutomation);

    // Remove automation error handlers
    emitter?.off(`automation-error-${props.account.id}-retry`, onAutomationErrorRetry);
    emitter?.off(`automation-error-${props.account.id}-cancel`, onAutomationErrorCancel);

    // Cleanup the view controller
    await model.value.cleanup();
});
</script>

<template>
    <div :class="['wrapper', `account-${account.id}`, 'd-flex', 'flex-column']">
        <AccountHeader :account="account" :show-refresh-button="currentState != State.WizardStartDisplay"
            @on-refresh-clicked="emit('onRefreshClicked')" @on-remove-clicked="emit('onRemoveClicked')" />

        <div class="d-flex">
            <div class="d-flex flex-column flex-grow-1">
                <!-- Speech bubble -->
                <SpeechBubble ref="speechBubbleComponent" :message="model.instructions || ''" class="mb-2"
                    :class="{ 'w-100': currentJobs.length === 0 }" />

                <!-- Progress -->
                <XProgressComponent
                    v-if="((rateLimitInfo && rateLimitInfo.isRateLimited) || progress) && model.state == State.RunJobs"
                    :progress="progress" :rate-limit-info="rateLimitInfo" :account-i-d="account.id" />
            </div>

            <div class="d-flex align-items-center">
                <!-- Job status -->
                <XJobStatusComponent v-if="currentJobs.length > 0 && model.state == State.RunJobs" :jobs="currentJobs"
                    :is-paused="isPaused" class="job-status-component" @on-pause="model.pause()"
                    @on-resume="model.resume()" @on-cancel="emit('onRefreshClicked')" @on-report-bug="onReportBug" />
            </div>
        </div>

        <!-- U2F security key notice -->
        <p v-if="model.state == State.Login" class="u2f-info text-center text-muted small">
            <i class="fa-solid fa-circle-info me-2" />
            If you use a U2F security key (like a Yubikey) for 2FA, press it when you see a white
            screen. <a href="#" @click="openURL('https://cyd.social/docs-u2f')">Read more</a>.
        </p>

        <!-- Automation notice -->
        <p v-if="(model.showBrowser && model.showAutomationNotice)" class="text-muted text-center automation-notice">
            <i class="fa-solid fa-robot" /> I'm following your instructions. Feel free to switch windows and use
            your computer for other things.
        </p>

        <!-- Ready for input -->
        <p v-if="(model.showBrowser && !model.showAutomationNotice)" class="text-muted text-center ready-for-input">
            <i class="fa-solid fa-computer-mouse" /> Ready for input.
        </p>

        <!-- Webview -->
        <webview ref="webviewComponent" src="about:blank" class="webview" :partition="`persist:account-${account.id}`"
            :class="{
                'hidden': !model.showBrowser,
                'webview-automation-border': model.showAutomationNotice,
                'webview-input-border': !model.showAutomationNotice
            }" />

        <!-- Wizard -->
        <div :class="{ 'hidden': model.showBrowser, 'wizard': true }">
            <div class="wizard-container d-flex">
                <div class="wizard-content flex-grow-1">
                    <XWizardStartPage v-if="model.state == State.WizardStartDisplay" :model="unref(model)"
                        :failure-state-index-likes_-failed-to-retry-after-rate-limit="failureStateIndexLikes_FailedToRetryAfterRateLimit"
                        :failure-state-index-tweets_-failed-to-retry-after-rate-limit="failureStateIndexTweets_FailedToRetryAfterRateLimit"
                        @update-account="updateAccount" @set-state="setState($event)"
                        @start-state-loop="startStateLoop" />

                    <XWizardBuildDatabasePage v-if="model.state == State.WizardImportOrBuildDisplay"
                        :model="unref(model)" @set-state="setState($event)" @start-state-loop="startStateLoop" />

                    <XWizardImportPage v-if="model.state == State.WizardImportStartDisplay" :model="unref(model)"
                        @set-state="setState($event)" @start-state-loop="startStateLoop" />

                    <XWizardImportDownloadPage v-if="model.state == State.WizardImportDownloadDisplay"
                        @set-state="setState($event)" @start-state-loop="startStateLoop" />

                    <XWizardImportOptionsPage v-if="model.state == State.WizardImportOptionsDisplay"
                        :model="unref(model)" @set-state="setState($event)" @start-state-loop="startStateLoop" />

                    <XWizardSaveOptionsPage v-if="model.state == State.WizardSaveOptionsDisplay" :model="unref(model)"
                        @set-state="setState($event)" @update-account="updateAccount"
                        @start-state-loop="startStateLoop" />

                    <XWizardDeleteOptionsPage v-if="model.state == State.WizardDeleteOptionsDisplay"
                        :model="unref(model)" @update-account="updateAccount" @set-state="setState($event)"
                        @start-state-loop="startStateLoop" />

                    <XWizardReviewPage v-if="model.state == State.WizardReviewDisplay" :model="unref(model)"
                        @set-state="setState($event)" @start-state-loop="startStateLoop" @update-account="updateAccount"
                        @start-jobs="startJobs" />

                    <XWizardDeleteReviewPage v-if="model.state == State.WizardDeleteReviewDisplay" :model="unref(model)"
                        :failure-state-index-likes_-failed-to-retry-after-rate-limit="failureStateIndexLikes_FailedToRetryAfterRateLimit"
                        :failure-state-index-tweets_-failed-to-retry-after-rate-limit="failureStateIndexTweets_FailedToRetryAfterRateLimit"
                        @set-state="setState($event)" @start-state-loop="startStateLoop"
                        @start-jobs-delete-review="startJobsDeleteReview" />

                    <XWizardCheckPremium v-if="model.state == State.WizardCheckPremiumDisplay" :model="unref(model)"
                        :user-authenticated="userAuthenticated" :user-premium="userPremium"
                        @set-state="setState($event)" @start-state-loop="startStateLoop" @update-account="updateAccount"
                        @start-jobs-just-save="startJobsJustSave" />

                    <XFinishedRunningJobsPage v-if="model.state == State.FinishedRunningJobsDisplay"
                        :model="unref(model)"
                        :failure-state-index-likes_-failed-to-retry-after-rate-limit="failureStateIndexLikes_FailedToRetryAfterRateLimit"
                        :failure-state-index-tweets_-failed-to-retry-after-rate-limit="failureStateIndexTweets_FailedToRetryAfterRateLimit"
                        @set-state="setState($event)" @start-state-loop="startStateLoop"
                        @finished-run-again-clicked="finishedRunAgainClicked" />

                    <!-- Debug state -->
                    <div v-if="model.state == State.Debug">
                        <p>Debug debug debug!!!</p>
                        <p>
                            <button class="btn btn-danger" @click="debugModeTriggerError">
                                Trigger Error
                            </button>
                        </p>
                        <p>
                            <button class="btn btn-primary" @click="debugModeDisable">
                                Cancel Debug Mode
                            </button>
                        </p>
                    </div>
                </div>

                <!-- wizard side bar -->
                <XWizardSidebar :model="unref(model)" @set-state="setState($event)" @start-state-loop="startStateLoop"
                    @set-debug-autopause-end-of-step="debugAutopauseEndOfStepChanged" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.job-status-component {
    width: 220px;
}
</style>