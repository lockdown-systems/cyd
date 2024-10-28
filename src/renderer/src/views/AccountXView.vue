<script setup lang="ts">
import {
    Ref,
    ref,
    watch,
    onMounted,
    onUnmounted,
    inject,
    getCurrentInstance,
    computed,
} from 'vue'
import Electron from 'electron';

import SemiphemeralAPIClient from '../../../semiphemeral-api-client';

import AccountHeader from '../components/AccountHeader.vue';
import SpeechBubble from '../components/SpeechBubble.vue';
import XProgressComponent from '../components/XProgressComponent.vue';
import XJobStatusComponent from '../components/XJobStatusComponent.vue';
import ShowArchiveComponent from '../components/ShowArchiveComponent.vue';

import type { Account, XProgress, XJob, XRateLimitInfo } from '../../../shared_types';
import type { DeviceInfo } from '../types';
import { AutomationErrorType } from '../automation_errors';

import { AccountXViewModel, State, XViewModelState } from '../view_models/AccountXViewModel'

import { setAccountRunning } from '../util';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const props = defineProps<{
    account: Account;
}>();

const emit = defineEmits(['onRefreshClicked', 'onRemoveClicked']);

const apiClient = inject('apiClient') as Ref<SemiphemeralAPIClient>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;

const accountXViewModel = ref<AccountXViewModel | null>(null);

const currentState = ref<State>(State.Login);
const progress = ref<XProgress | null>(null);
const rateLimitInfo = ref<XRateLimitInfo | null>(null);
const currentJobs = ref<XJob[]>([]);
const isPaused = ref<boolean>(false);

const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);
const canStateLoopRun = ref(true);

// Keep currentState in sync
watch(
    () => accountXViewModel.value?.state,
    (newState) => {
        if (newState) {
            currentState.value = newState as State;
        }
    },
    { deep: true, }
);

// Keep progress updated
watch(
    () => accountXViewModel.value?.progress,
    (newProgress) => { if (newProgress) progress.value = newProgress; },
    { deep: true, }
);

// Keep rateLimitInfo updated
watch(
    () => accountXViewModel.value?.rateLimitInfo,
    (newRateLimitInfo) => { if (newRateLimitInfo) rateLimitInfo.value = newRateLimitInfo; },
    { deep: true, }
);

// Keep jobs status updated
watch(
    () => accountXViewModel.value?.jobs,
    (newJobs) => { if (newJobs) currentJobs.value = newJobs; },
    { deep: true, }
);

// Keep isPaused updated
watch(
    () => accountXViewModel.value?.isPaused,
    (newIsPaused) => { if (newIsPaused !== undefined) isPaused.value = newIsPaused; },
    { deep: true, }
);

// Paths
const archivePath = ref('');

// Settings
const archiveTweets = ref(false);
const archiveLikes = ref(false);
const archiveDMs = ref(false);
const deleteTweets = ref(false);
const deleteTweetsDaysOld = ref(0);
const deleteTweetsLikesThresholdEnabled = ref(false);
const deleteTweetsLikesThreshold = ref(0);
const deleteTweetsRetweetsThresholdEnabled = ref(false);
const deleteTweetsRetweetsThreshold = ref(0);
const deleteTweetsArchiveEnabled = ref(false);
const deleteRetweets = ref(false);
const deleteRetweetsDaysOld = ref(0);
const deleteLikes = ref(false);
const deleteLikesDaysOld = ref(0);
const deleteDMs = ref(false);

// Force re-index everything options
const isFirstIndex = ref(true);
const archiveForceIndexEverything = ref(false);
const deleteForceIndexEverything = ref(false);

const checkIfIsFirstIndex = async () => {
    isFirstIndex.value = (
        await window.electron.X.getLastFinishedJob(props.account.id, "indexTweets") == null &&
        await window.electron.X.getLastFinishedJob(props.account.id, "indexLikes") == null &&
        await window.electron.X.getLastFinishedJob(props.account.id, "indexDMs") == null
    );
}

const showArchivedOnFinishedDelete = computed(() => {
    return (
        accountXViewModel.value?.action === 'delete' &&
        (progress.value?.newTweetsArchived || 0) > 0 ||
        (progress.value?.tweetsIndexed || 0) > 0 ||
        (progress.value?.likesIndexed || 0) > 0 ||
        (progress.value?.conversationsIndexed || 0) > 0 ||
        (progress.value?.messagesIndexed || 0) > 0
    );
});

const updateSettings = async () => {
    console.log('Updating settings')
    const updatedAccount: Account = {
        id: props.account.id,
        type: props.account.type,
        sortOrder: props.account.sortOrder,
        uuid: props.account.uuid,
        xAccount: {
            id: props.account.xAccount?.id || 0,
            createdAt: props.account.xAccount?.createdAt || new Date(),
            updatedAt: new Date(),
            accessedAt: new Date(),
            username: props.account.xAccount?.username || '',
            profileImageDataURI: props.account.xAccount?.profileImageDataURI || '',
            archiveTweets: archiveTweets.value,
            archiveLikes: archiveLikes.value,
            archiveDMs: archiveDMs.value,
            deleteTweets: deleteTweets.value,
            deleteTweetsDaysOld: deleteTweetsDaysOld.value,
            deleteTweetsLikesThresholdEnabled: deleteTweetsLikesThresholdEnabled.value,
            deleteTweetsLikesThreshold: deleteTweetsLikesThreshold.value,
            deleteTweetsRetweetsThresholdEnabled: deleteTweetsRetweetsThresholdEnabled.value,
            deleteTweetsRetweetsThreshold: deleteTweetsRetweetsThreshold.value,
            deleteTweetsArchiveEnabled: deleteTweetsArchiveEnabled.value,
            deleteRetweets: deleteRetweets.value,
            deleteRetweetsDaysOld: deleteRetweetsDaysOld.value,
            deleteLikes: deleteLikes.value,
            deleteLikesDaysOld: deleteLikesDaysOld.value,
            deleteDMs: deleteDMs.value,
        }
    };
    await window.electron.database.saveAccount(JSON.stringify(updatedAccount));
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.account = updatedAccount;
    }
    emitter?.emit('account-updated');
};

const startArchivingClicked = async () => {
    await updateSettings();
    if (accountXViewModel.value) {
        await accountXViewModel.value.startArchiving(archiveForceIndexEverything.value);
    }
    archiveForceIndexEverything.value = false;
    await startStateLoop();
};

const startDeletingClicked = async () => {
    await updateSettings();
    if (accountXViewModel.value !== null) {
        await accountXViewModel.value.startDeleting(deleteForceIndexEverything.value);
    }
    deleteForceIndexEverything.value = false;
    await startStateLoop();
};

const startStateLoop = async () => {
    console.log('State loop started');
    await setAccountRunning(props.account.id, true);

    while (canStateLoopRun.value) {
        // Run next state
        if (accountXViewModel.value !== null) {
            await accountXViewModel.value.run();
        }

        // Break out of the state loop if the view model is in a final state
        if (
            accountXViewModel.value?.state === State.DashboardDisplay ||
            accountXViewModel.value?.state === State.FinishedRunningJobs
        ) {
            await updateArchivePath();
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await setAccountRunning(props.account.id, false);
    console.log('State loop ended');
};

const reset = async () => {
    await checkIfIsFirstIndex();
    await accountXViewModel.value?.reset()
    await startStateLoop();
};

const updateArchivePath = async () => {
    const path = await window.electron.getAccountDataPath(props.account.id, '');
    archivePath.value = path ? path : '';
};

const onAutomationErrorRetry = () => {
    console.log('Retrying automation after error');

    // Store the state of the view model before the error
    const state: XViewModelState | undefined = accountXViewModel.value?.saveState();
    localStorage.setItem(`account-${props.account.id}-state`, JSON.stringify(state));
    emit('onRefreshClicked');
};

const onAutomationErrorCancel = () => {
    console.log('Cancelling automation after error');
    emit('onRefreshClicked');
};

const onCancelAutomation = () => {
    console.log('Cancelling automation');
    emit('onRefreshClicked');
};

const u2fInfoClicked = () => {
    window.electron.openURL('https://semiphemeral.com/docs-u2f');
};

// Debug functions

const enableDebugMode = async () => {
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.state = State.Debug;
    }
    await startStateLoop();
};

const debugModeTriggerError = async () => {
    if (accountXViewModel.value !== null) {
        await accountXViewModel.value.error(AutomationErrorType.x_unknownError, {
            message: 'Debug mode error triggered'
        }, {
            currentURL: accountXViewModel.value.webview.getURL()
        });
    }
};

const debugModeDisable = async () => {
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.state = State.DashboardDisplay;
    }
};

onMounted(async () => {
    await updateArchivePath();

    if (props.account.xAccount !== null) {
        archiveTweets.value = props.account.xAccount.archiveTweets;
        archiveLikes.value = props.account.xAccount.archiveLikes;
        archiveDMs.value = props.account.xAccount.archiveDMs;
        deleteTweets.value = props.account.xAccount.deleteTweets;
        deleteTweetsDaysOld.value = props.account.xAccount.deleteTweetsDaysOld;
        deleteTweetsLikesThresholdEnabled.value = props.account.xAccount.deleteTweetsLikesThresholdEnabled;
        deleteTweetsLikesThreshold.value = props.account.xAccount.deleteTweetsLikesThreshold;
        deleteTweetsRetweetsThresholdEnabled.value = props.account.xAccount.deleteTweetsRetweetsThresholdEnabled;
        deleteTweetsRetweetsThreshold.value = props.account.xAccount.deleteTweetsRetweetsThreshold;
        deleteTweetsArchiveEnabled.value = props.account.xAccount.deleteTweetsArchiveEnabled;
        deleteRetweets.value = props.account.xAccount.deleteRetweets;
        deleteRetweetsDaysOld.value = props.account.xAccount.deleteRetweetsDaysOld;
        deleteLikes.value = props.account.xAccount.deleteLikes;
        deleteLikesDaysOld.value = props.account.xAccount.deleteLikesDaysOld;
        deleteDMs.value = props.account.xAccount.deleteDMs;
    }

    await checkIfIsFirstIndex();

    if (webviewComponent.value !== null) {
        const webview = webviewComponent.value;

        // Start the state loop
        if (props.account.xAccount !== null) {
            accountXViewModel.value = new AccountXViewModel(props.account, webview, apiClient.value, deviceInfo.value, emitter);
            await accountXViewModel.value.init();

            // If there's a saved state from a retry, restore it
            const savedState = localStorage.getItem(`account-${props.account.id}-state`);
            if (savedState) {
                console.log('Restoring saved state', savedState);
                const savedStateObj: XViewModelState = JSON.parse(savedState);

                accountXViewModel.value.restoreState(savedStateObj);
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
    if (accountXViewModel.value !== null) {
        await accountXViewModel.value.cleanup();
    }
});
</script>

<template>
    <div :class="['wrapper', `account-${account.id}`, 'd-flex', 'flex-column']">
        <AccountHeader :account="account" :show-dashboard-button="currentState != State.DashboardDisplay"
            @on-dashboard-clicked="emit('onRefreshClicked')" @on-remove-clicked="emit('onRemoveClicked')" />

        <div class="d-flex">
            <div class="d-flex flex-column flex-grow-1">
                <!-- Speech bubble -->
                <SpeechBubble ref="speechBubbleComponent" :message="accountXViewModel?.instructions || ''" class="mb-2"
                    :class="{ 'w-100': currentJobs.length === 0 }" />

                <!-- Progress -->
                <XProgressComponent
                    v-if="((rateLimitInfo && rateLimitInfo.isRateLimited) || progress) && accountXViewModel?.state == State.RunJobs"
                    :progress="progress" :rate-limit-info="rateLimitInfo" :account-i-d="account.id" />
            </div>

            <div class="d-flex align-items-center">
                <!-- Job status -->
                <XJobStatusComponent v-if="currentJobs.length > 0 && accountXViewModel?.state == State.RunJobs"
                    :jobs="currentJobs" :is-paused="isPaused" class="job-status-component"
                    @on-pause="accountXViewModel?.pause()" @on-resume="accountXViewModel?.resume()"
                    @on-cancel="emit('onRefreshClicked')" />
            </div>
        </div>

        <!-- U2F security key notice -->
        <p v-if="accountXViewModel?.state == State.Login" class="u2f-info text-center text-muted small">
            <i class="fa-solid fa-circle-info me-2" />
            If you use a U2F security key (like a Yubikey) for 2FA, press it when you see a white
            screen. <a href="#" @click="u2fInfoClicked">Read more</a>.
        </p>

        <!-- Automation notice -->
        <p v-if="(accountXViewModel?.showBrowser && accountXViewModel?.showAutomationNotice)"
            class="text-muted text-center automation-notice">
            <i class="fa-solid fa-robot" /> Automation in Progress: Feel free to switch windows and use your computer
            for other things.
        </p>

        <!-- Ready for input -->
        <p v-if="(accountXViewModel?.showBrowser && !accountXViewModel?.showAutomationNotice)"
            class="text-muted text-center ready-for-input">
            <i class="fa-solid fa-computer-mouse" /> Ready for input.
        </p>

        <!-- Webview -->
        <webview ref="webviewComponent" src="about:blank" class="webview" :partition="`persist:account-${account.id}`"
            :class="{
                'hidden': !accountXViewModel?.showBrowser,
                'webview-automation-border': accountXViewModel?.showAutomationNotice,
                'webview-input-border': !accountXViewModel?.showAutomationNotice
            }" />

        <!-- Dashboard -->
        <div v-if="accountXViewModel?.state == State.DashboardDisplay" class="dashboard">
            <div class="container mb-4 mt-3">
                <div class="row">
                    <div class="col-md-6 mb-4">
                        <h2>Archive my data</h2>
                        <p class="text-muted small">
                            Download a local archive of your X data to the <code>Documents</code> folder on your
                            computer.
                        </p>
                        <form @submit.prevent>
                            <div class="mb-3 form-check">
                                <input id="archiveTweets" v-model="archiveTweets" type="checkbox"
                                    class="form-check-input">
                                <label class="form-check-label" for="archiveTweets">Archive tweets</label>
                            </div>
                            <div class="mb-3 form-check">
                                <input id="archiveLikes" v-model="archiveLikes" type="checkbox"
                                    class="form-check-input">
                                <label class="form-check-label" for="archiveLikes">Archive likes</label>
                            </div>
                            <div class="mb-3 form-check">
                                <input id="archiveDMs" v-model="archiveDMs" type="checkbox" class="form-check-input">
                                <label class="form-check-label" for="archiveDMs">Archive direct messages</label>
                            </div>
                            <div v-if="!isFirstIndex" class="mb-3 form-check force-reindex">
                                <input id="archiveForceIndexEverything" v-model="archiveForceIndexEverything"
                                    type="checkbox" class="form-check-input">
                                <label class="form-check-label" for="archiveForceIndexEverything">Force Semiphemeral to
                                    re-index everything, instead of just the newest</label>
                            </div>
                            <button type="submit" class="btn btn-primary"
                                :disabled="!(archiveTweets || archiveLikes || archiveDMs)"
                                @click="startArchivingClicked">
                                <i class="fa-solid fa-floppy-disk mr-2" />
                                Start Archiving
                            </button>
                        </form>

                        <div v-if="!isFirstIndex" class="mt-5">
                            <h2>Explore my data</h2>
                            <ShowArchiveComponent :account-i-d="account.id" />
                        </div>
                    </div>

                    <div class="col-md-6 mb-4">
                        <h2>Delete my data <span class="premium badge badge-primary">Premium</span></h2>
                        <p class="text-muted small">
                            Delete your data from X, except for what you want to keep.
                        </p>
                        <form @submit.prevent>
                            <div class="d-flex align-items-center">
                                <div class="form-check mb-2">
                                    <input id="deleteTweets" v-model="deleteTweets" type="checkbox"
                                        class="form-check-input">
                                    <label class="form-check-label mr-1 text-nowrap" for="deleteTweets">
                                        Delete tweets
                                    </label>
                                </div>
                                <div class="d-flex align-items-center mb-2">
                                    <label class="form-check-label mr-1 no-wrap text-nowrap" for="deleteTweetsDaysOld">
                                        older than
                                    </label>
                                    <div class="input-group flex-nowrap">
                                        <input id="deleteTweetsDaysOld" v-model="deleteTweetsDaysOld" type="text"
                                            class="form-control form-short">
                                        <div class="input-group-append">
                                            <span class="input-group-text">days</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="container">
                                <div class="d-flex align-items-center">
                                    <div class="form-check mb-2">
                                        <input id="deleteTweetsRetweetsThresholdEnabled"
                                            v-model="deleteTweetsRetweetsThresholdEnabled" type="checkbox"
                                            class="form-check-input" :disabled="!deleteTweets">
                                        <label class="form-check-label mr-1 text-nowrap"
                                            for="deleteTweetsRetweetsThresholdEnabled">
                                            Unless they have at least
                                        </label>
                                    </div>
                                    <div class="d-flex align-items-center mb-2">
                                        <label class="form-check-label mr-1 sr-only"
                                            for="deleteTweetsRetweetsThreshold">
                                            retweets
                                        </label>
                                        <div class="input-group flex-nowrap">
                                            <input id="deleteTweetsRetweetsThreshold"
                                                v-model="deleteTweetsRetweetsThreshold" type="text"
                                                class="form-control form-short" :disabled="!deleteTweets">
                                            <div class="input-group-append">
                                                <span class="input-group-text">retweets</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center">
                                    <div class="form-check mb-2">
                                        <input id="deleteTweetsLikesThresholdEnabled"
                                            v-model="deleteTweetsLikesThresholdEnabled" type="checkbox"
                                            class="form-check-input" :disabled="!deleteTweets">
                                        <label class="form-check-label mr-1 text-nowrap"
                                            for="deleteTweetsLikesThresholdEnabled">
                                            Or at least
                                        </label>
                                    </div>
                                    <div class="d-flex align-items-center mb-2">
                                        <label class="form-check-label mr-1 sr-only" for="deleteTweetsLikesThreshold">
                                            likes
                                        </label>
                                        <div class="input-group flex-nowrap">
                                            <input id="deleteTweetsLikesThreshold" v-model="deleteTweetsLikesThreshold"
                                                type="text" class="form-control form-short" :disabled="!deleteTweets">
                                            <div class="input-group-append">
                                                <span class="input-group-text">likes</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="d-flex align-items-center">
                                    <div class="form-check mb-2">
                                        <input id="deleteTweetsArchiveEnabled" v-model="deleteTweetsArchiveEnabled"
                                            type="checkbox" class="form-check-input" :disabled="!deleteTweets">
                                        <label class="form-check-label mr-1 text-nowrap"
                                            for="deleteTweetsArchiveEnabled">
                                            Archive before deleting
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <div class="form-check mb-2">
                                    <input id="deleteRetweets" v-model="deleteRetweets" type="checkbox"
                                        class="form-check-input">
                                    <label class="form-check-label mr-1 text-nowrap" for="deleteRetweets">
                                        Unretweet tweets
                                    </label>
                                </div>
                                <div class="d-flex align-items-center mb-2">
                                    <label class="form-check-label mr-1 no-wrap text-nowrap"
                                        for="deleteRetweetsDaysOld">
                                        older than
                                    </label>
                                    <div class="input-group flex-nowrap">
                                        <input id="deleteRetweetsDaysOld" v-model="deleteRetweetsDaysOld" type="text"
                                            class="form-control form-short">
                                        <div class="input-group-append">
                                            <span class="input-group-text">days</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <div class="form-check mb-2">
                                    <input id="deleteLikes" v-model="deleteLikes" type="checkbox"
                                        class="form-check-input">
                                    <label class="form-check-label mr-1 text-nowrap" for="deleteLikes">
                                        Unlike tweets
                                    </label>
                                </div>
                                <div class="d-flex align-items-center mb-2">
                                    <label class="form-check-label mr-1 no-wrap text-nowrap" for="deleteLikesDaysOld">
                                        older than
                                    </label>
                                    <div class="input-group flex-nowrap">
                                        <input id="deleteLikesDaysOld" v-model="deleteLikesDaysOld" type="text"
                                            class="form-control form-short">
                                        <div class="input-group-append">
                                            <span class="input-group-text">days</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="d-flex align-items-center">
                                <div class="form-check mb-2">
                                    <input id="deleteDMs" v-model="deleteDMs" type="checkbox" class="form-check-input">
                                    <label class="form-check-label mr-1 text-nowrap" for="deleteDMs">
                                        Delete all direct messages
                                    </label>
                                </div>
                            </div>
                            <div v-if="!isFirstIndex" class="mb-3 form-check force-reindex">
                                <input id="deleteForceIndexEverything" v-model="deleteForceIndexEverything"
                                    type="checkbox" class="form-check-input">
                                <label class="form-check-label" for="deleteForceIndexEverything">Force Semiphemeral to
                                    re-index everything, instead of just the newest</label>
                            </div>
                            <button type="submit" class="btn btn-primary"
                                :disabled="!(deleteTweets || deleteRetweets || deleteLikes || deleteDMs)"
                                @click="startDeletingClicked">
                                <i class="fa-solid fa-fire mr-2 delete-icon" />
                                Start Deleting
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <!-- <p>
                <button class="btn btn-primary" @click="enableDebugMode">
                    Debug Mode
                </button>
            </p> -->
        </div>

        <!-- Finished running jobs -->
        <div v-if="accountXViewModel?.state == State.FinishedRunningJobs" class="finished">
            <div v-if="accountXViewModel.action == 'archive'" class="container mt-3">
                <div class="finished-archive">
                    <p>You just archived:</p>
                    <ul>
                        <li v-if="(progress?.newTweetsArchived ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.newTweetsArchived.toLocaleString() }}</strong> tweets saved as HTML
                            archives
                        </li>
                        <li v-if="account.xAccount?.archiveTweets || (progress?.tweetsIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.tweetsIndexed.toLocaleString() }}</strong> tweets
                        </li>
                        <li v-if="account.xAccount?.archiveLikes || (progress?.likesIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.likesIndexed.toLocaleString() }}</strong> likes
                        </li>
                        <li
                            v-if="account.xAccount?.archiveDMs || (progress?.conversationsIndexed ?? 0) > 0 || (progress?.messagesIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.conversationsIndexed.toLocaleString() }}</strong> conversations,
                            including <strong>{{ progress?.messagesIndexed.toLocaleString() }}</strong> messages
                        </li>
                    </ul>

                    <p>Your X archive is stored locally on your computer at <code>{{ archivePath }}</code>.</p>

                    <ShowArchiveComponent :account-i-d="account.id" />

                    <p>
                        Every time you have new tweets or DMs to archive, run this tool again and it will resume from
                        last
                        time you performed an archive.
                    </p>

                    <p>
                        If you want to recreate an archive of an individual tweet, delete its HTML file first.
                    </p>
                </div>
            </div>
            <div v-if="accountXViewModel.action == 'delete'" class="container mt-3">
                <div class="finished-delete">
                    <div v-if="showArchivedOnFinishedDelete">
                        <p>You just archived:</p>
                        <ul>
                            <li v-if="(progress?.newTweetsArchived ?? 0) > 0">
                                <i class="fa-solid fa-floppy-disk archive-bullet" />
                                <strong>{{ progress?.newTweetsArchived.toLocaleString() }}</strong> tweets saved as HTML
                                archives
                            </li>
                            <li v-if="(progress?.tweetsIndexed ?? 0) > 0">
                                <i class="fa-solid fa-floppy-disk archive-bullet" />
                                <strong>{{ progress?.tweetsIndexed.toLocaleString() }}</strong> tweets
                            </li>
                            <li v-if="(progress?.likesIndexed ?? 0) > 0">
                                <i class="fa-solid fa-floppy-disk archive-bullet" />
                                <strong>{{ progress?.likesIndexed.toLocaleString() }}</strong> likes
                            </li>
                            <li
                                v-if="(progress?.conversationsIndexed ?? 0) > 0 || (progress?.messagesIndexed ?? 0) > 0">
                                <i class="fa-solid fa-floppy-disk archive-bullet" />
                                <strong>{{ progress?.conversationsIndexed.toLocaleString() }}</strong> conversations,
                                including <strong>{{ progress?.messagesIndexed.toLocaleString() }}</strong> messages
                            </li>
                        </ul>
                    </div>

                    <p>You just deleted:</p>
                    <ul>
                        <li v-if="account.xAccount?.deleteTweets || (progress?.tweetsDeleted ?? 0) > 0">
                            <i class="fa-solid fa-fire delete-bullet" />
                            <strong>{{ progress?.tweetsDeleted.toLocaleString() }}</strong> tweets
                        </li>
                        <li v-if="account.xAccount?.deleteRetweets || (progress?.retweetsDeleted ?? 0) > 0">
                            <i class="fa-solid fa-fire delete-bullet" />
                            <strong>{{ progress?.retweetsDeleted.toLocaleString() }}</strong> retweets
                        </li>
                        <li v-if="account.xAccount?.deleteLikes || (progress?.likesDeleted ?? 0) > 0">
                            <i class="fa-solid fa-fire delete-bullet" />
                            <strong>{{ progress?.likesDeleted.toLocaleString() }}</strong> likes
                        </li>
                        <li
                            v-if="account.xAccount?.deleteDMs || (progress?.conversationsDeleted ?? 0) > 0 || (progress?.messagesDeleted ?? 0) > 0">
                            <i class="fa-solid fa-fire delete-bullet" />
                            <strong>{{ progress?.conversationsDeleted.toLocaleString() }}</strong> conversations,
                            including <strong>{{ progress?.messagesDeleted.toLocaleString() }}</strong> messages
                        </li>
                    </ul>

                    <ShowArchiveComponent :account-i-d="account.id" />
                </div>
            </div>
            <div>
                <div class="container mt-3">
                    <button class="btn btn-primary" @click="reset()">
                        Back to the dashboard
                    </button>
                </div>
            </div>
        </div>

        <!-- Debug state -->
        <div v-if="accountXViewModel?.state == State.Debug">
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
</template>

<style scoped>
.speech-bubble {
    padding-bottom: 10px;
}

.hidden {
    display: none;
}

.dashboard {
    height: 100vh;
    overflow: auto;
}

.form-short {
    width: 55px;
}

.no-wrap {
    white-space: nowrap;
}

.full-width {
    width: 100%;
}

.job-status-component {
    width: 220px;
}

.filesystem-path {
    font-family: monospace;
    text-decoration: none;
    font-weight: bold;
}

.force-reindex {
    font-size: 0.9rem;
    color: #333333;
}

.delete-icon {
    color: rgb(250, 190, 79);
}

.delete-bullet {
    color: rgb(218, 82, 41);
    margin-right: 5px;
}

.archive-bullet {
    color: rgb(50, 164, 164);
    margin-right: 5px;
}

.premium {
    text-transform: uppercase;
    font-size: 0.9rem;
    margin-left: 5px;
    padding: 0.2em 0.5em;
    background-color: #50a4ff;
    color: white;
    border-radius: 0.25rem;
}

.finished-archive ul,
.finished-delete ul {
    list-style-type: none;
    padding-left: 0;
    margin-left: 1.5em;
}

.finished-archive li,
.finished-delete li {
    margin-bottom: 0.2rem;
}
</style>