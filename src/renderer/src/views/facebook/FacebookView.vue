<script setup lang="ts">
import {
    Ref,
    ref,
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

import type {
    Account,
    XProgress,
    XJob,
    XRateLimitInfo,
} from '../../../../shared_types';
import type { DeviceInfo } from '../../types';
import { AutomationErrorType } from '../../automation_errors';
import { AccountXViewModel, State, RunJobsState, FailureState, XViewModelState } from '../../view_models/XViewModel'
import { setAccountRunning, openURL } from '../../util';
import { xRequiresPremium, xPostProgress } from '../../util_x';

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
    console.log('Setting state', state);
    model.value.state = state;
    await startStateLoop();
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

const onAutomationErrorRetry = async () => {
    console.log('Retrying automation after error');

    // If we're currently on the finished page, then move back to the review page
    if (model.value.state == State.FinishedRunningJobsDisplay) {
        await setState(State.WizardReview);
    } else {
        // Store the state of the view model before the error
        const state: XViewModelState | undefined = model.value.saveState();
        localStorage.setItem(`account-${props.account.id}-state`, JSON.stringify(state));
        emit('onRefreshClicked');
    }
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

    // Submit progress to the API
    emitter.value.emit(`x-submit-progress-${props.account.id}`);

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
        await window.electron.showMessage("Failed to check if you have Premium access.", "Please try again later.");
        return;
    }
    userPremium.value = userPremiumResp.premium_access;

    if (!userPremium.value) {
        console.log('User does not have Premium access');
        emitter?.emit(`x-premium-check-failed-${props.account.id}`);
    }
};

emitter?.on('signed-in', async () => {
    console.log('AccountXView: User signed in');
    await updateUserAuthenticated();
    await updateUserPremium();
});

emitter?.on('signed-out', async () => {
    console.log('AccountXView: User signed out');
    userAuthenticated.value = false;
    userPremium.value = false;
});

emitter?.on(`x-submit-progress-${props.account.id}`, async () => {
    await xPostProgress(apiClient.value, deviceInfo.value, props.account.id);
});

const startJobs = async () => {
    // Premium check
    if (model.value.account?.xAccount && await xRequiresPremium(model.value.account?.xAccount)) {
        // In open mode, allow the user to continue
        if (await window.electron.getMode() == "open") {
            if (!await window.electron.showQuestion("You're about to run a job that normally requires Premium access, but you're running Cyd in open source developer mode, so you don't have to authenticate with the Cyd server to use these features.\n\nIf you're not contributing to Cyd, please support the project by paying for a Premium plan.", "Continue", "Cancel")) {
                return;
            }
        }
        // Otherwise, make sure the user is authenticated
        else {
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
    }

    // All good, start the jobs
    console.log('Starting jobs');
    await model.value.defineJobs();
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

const debugModeTriggerError = async (count: number = 1) => {
    console.log('Debug mode error triggered', count);
    if (count == 1) {
        await model.value.error(AutomationErrorType.x_unknownError, {
            message: "Debug mode error triggered",
        }, {
            currentURL: model.value.webview?.getURL()
        });
    } else {
        for (let i = 0; i < count; i++) {
            await model.value.error(AutomationErrorType.x_unknownError, {
                message: `Debug mode error triggered ${i + 1} of ${count}`,
            }, {
                currentURL: model.value.webview?.getURL()
            }, true);
        }
        await model.value.showErrorModal();
    }
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
    emitter?.off(`automation-error-${props.account.id}-resume`, onAutomationErrorResume);

    // Cleanup the view controller
    await model.value.cleanup();
});
</script>

<template>
    <div :class="['wrapper', `account-${account.id}`, 'd-flex', 'flex-column']">
        <AccountHeader :account="account" :show-refresh-button="true" @on-refresh-clicked="emit('onRefreshClicked')"
            @on-remove-clicked="emit('onRemoveClicked')" />

        <template v-if="model.state == State.WizardPrestart || model.state == State.WizardStart">
            <div class="text-center ms-2 mt-5">
                <img src="/assets/cyd-loading.gif" alt="Loading">
            </div>
        </template>

        <template v-if="model.state != State.WizardPrestart && model.state != State.WizardStart">
            <div class="d-flex ms-2">
                <div class="d-flex flex-column flex-grow-1">
                    <!-- Speech bubble -->
                    <SpeechBubble ref="speechBubbleComponent" :message="model.instructions || ''" class="mb-2"
                        :class="{ 'w-100': currentJobs.length === 0 }" />

                    <!-- Progress -->
                </div>

                <div class="d-flex align-items-center">
                    <!-- Job status -->
                </div>
            </div>

            <!-- U2F security key notice -->
            <p v-if="model.state == State.Login" class="u2f-info text-center text-muted small ms-2">
                <i class="fa-solid fa-circle-info me-2" />
                If you use a U2F security key (like a Yubikey) for 2FA, press it when you see a white
                screen. <a href="#" @click="openURL('https://cyd.social/docs-u2f')">Read more</a>.
            </p>

            <!-- Automation notice -->
            <p v-if="(model.showBrowser && model.showAutomationNotice)"
                class="text-muted text-center automation-notice">
                <i class="fa-solid fa-robot" /> I'm following your instructions. Feel free to switch windows and use
                your computer for other things.
            </p>

            <!-- Ready for input -->
            <p v-if="(model.showBrowser && !model.showAutomationNotice)" class="text-muted text-center ready-for-input">
                <i class="fa-solid fa-computer-mouse" /> Ready for input.
            </p>
        </template>

        <!-- Webview -->
        <webview ref="webviewComponent" src="about:blank" class="webview" :partition="`persist:account-${account.id}`"
            :class="{
                'hidden': !model.showBrowser,
                'webview-automation-border': model.showAutomationNotice,
                'webview-input-border': !model.showAutomationNotice
            }" />
    </div>
</template>

<style scoped></style>