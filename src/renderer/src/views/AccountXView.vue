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

import CydAPIClient from '../../../cyd-api-client';

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

const apiClient = inject('apiClient') as Ref<CydAPIClient>;
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
const saveMyData = ref(true);
const deleteMyData = ref(true);
const archiveTweets = ref(false);
const archiveTweetsHTML = ref(false);
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

const chanceToReview = ref(true);

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
            saveMyData: saveMyData.value,
            deleteMyData: deleteMyData.value,
            archiveTweets: archiveTweets.value,
            archiveTweetsHTML: archiveTweetsHTML.value,
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

// const startArchivingClicked = async () => {
//     await updateSettings();
//     if (accountXViewModel.value) {
//         await accountXViewModel.value.startArchiving(archiveForceIndexEverything.value);
//     }
//     archiveForceIndexEverything.value = false;
//     await startStateLoop();
// };

// const startDeletingClicked = async () => {
//     await updateSettings();
//     if (accountXViewModel.value !== null) {
//         await accountXViewModel.value.startDeleting(deleteForceIndexEverything.value);
//     }
//     deleteForceIndexEverything.value = false;
//     await startStateLoop();
// };

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
            accountXViewModel.value?.state === State.WizardStartDisplay ||
            accountXViewModel.value?.state === State.WizardSaveOptionsDisplay ||
            accountXViewModel.value?.state === State.WizardDeleteOptionsDisplay ||
            accountXViewModel.value?.state === State.WizardReviewDisplay ||
            accountXViewModel.value?.state === State.WizardDeleteReviewDisplay ||
            accountXViewModel.value?.state === State.FinishedRunningJobs
        ) {
            if (accountXViewModel.value?.state === State.WizardStartDisplay) {
                await wizardStartUpdateButtonsText();
            }
            if (accountXViewModel?.value.state === State.WizardSaveOptionsDisplay) {
                await wizardSaveOptionsUpdateButtonsText();
            }
            if (accountXViewModel.value?.state === State.WizardDeleteOptionsDisplay) {
                await wizardDeleteOptionsUpdateButtonsText();
            }
            if (accountXViewModel.value?.state === State.WizardReviewDisplay) {
                await wizardReviewUpdateButtonsText();
            }

            await updateArchivePath();
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    await setAccountRunning(props.account.id, false);
    console.log('State loop ended');
};

const reset = async () => {
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

// Wizard functions

const wizardNextText = ref('Continue');
const wizardBackText = ref('Back');

const wizardStartUpdateButtonsText = async () => {
    if (saveMyData.value) {
        wizardNextText.value = 'Continue to Save Options';
    } else if (deleteMyData.value) {
        wizardNextText.value = 'Continue to Delete Options';
    } else {
        wizardNextText.value = 'Choose Save or Delete to Continue';
    }
}

const wizardSaveOptionsUpdateButtonsText = async () => {
    if (deleteMyData.value) {
        wizardNextText.value = 'Continue to Delete Options';
    } else {
        wizardNextText.value = 'Continue to Review';
    }
    wizardBackText.value = 'Back to Start';
}

const wizardDeleteOptionsUpdateButtonsText = async () => {
    wizardNextText.value = 'Continue to Review';
    if (saveMyData.value) {
        wizardBackText.value = 'Back to Save Options';
    } else {
        wizardBackText.value = 'Back to Start';
    }
}

const wizardReviewUpdateButtonsText = async () => {
    if (saveMyData.value) {
        if (deleteMyData.value) {
            if (chanceToReview.value) {
                wizardNextText.value = 'Start Saving and Build Database';
            } else {
                wizardNextText.value = 'Start Saving, Build Database, and Start Deleting';
            }
        } else {
            wizardNextText.value = 'Start Saving';
        }
    } else {
        if (chanceToReview.value) {
            wizardNextText.value = 'Build Database';
        } else {
            wizardNextText.value = 'Build Database and Start Deleting';
        }
    }

    if (deleteMyData.value) {
        wizardBackText.value = 'Back to Delete Options';
    } else {
        wizardBackText.value = 'Back to Save Options';
    }
}

const wizardStartNextClicked = async () => {
    if (!accountXViewModel.value) { return; }
    await updateSettings();
    if (saveMyData.value) {
        accountXViewModel.value.state = State.WizardSaveOptions;
    } else if (deleteMyData.value) {
        accountXViewModel.value.state = State.WizardDeleteOptions;
    }
    await startStateLoop();
};

const wizardSaveOptionsBackClicked = async () => {
    if (!accountXViewModel.value) { return; }
    await updateSettings();
    accountXViewModel.value.state = State.WizardStart;
    await startStateLoop();
};

const wizardSaveOptionsNextClicked = async () => {
    if (!accountXViewModel.value) { return; }
    await updateSettings();
    if (deleteMyData.value) {
        accountXViewModel.value.state = State.WizardDeleteOptions;
    } else {
        accountXViewModel.value.state = State.WizardReview;
    }
    await startStateLoop();
};

const wizardDeleteOptionsBackClicked = async () => {
    if (!accountXViewModel.value) { return; }
    await updateSettings();
    if (saveMyData.value) {
        accountXViewModel.value.state = State.WizardSaveOptions;
    } else {
        accountXViewModel.value.state = State.WizardStart;
    }
    await startStateLoop();
};

const wizardDeleteOptionsNextClicked = async () => {
    if (!accountXViewModel.value) { return; }
    await updateSettings();
    accountXViewModel.value.state = State.WizardReview;
    await startStateLoop();
};

const wizardReviewBackClicked = async () => {
    if (!accountXViewModel.value) { return; }
    await updateSettings();
    if (deleteMyData.value) {
        accountXViewModel.value.state = State.WizardDeleteOptions;
    } else {
        accountXViewModel.value.state = State.WizardSaveOptions;
    }
    await startStateLoop();
};

const wizardReviewNextClicked = async () => {
    if (!accountXViewModel.value) { return; }
    await updateSettings();
    // TODO: fix this logic
    if (saveMyData.value) {
        if (deleteMyData.value) {
            if (chanceToReview.value) {
                accountXViewModel.value.state = State.RunJobs;
            } else {
                accountXViewModel.value.state = State.WizardDeleteReview;
            }
        } else {
            accountXViewModel.value.state = State.RunJobs;
        }
    } else {
        if (chanceToReview.value) {
            accountXViewModel.value.state = State.RunJobs;
        } else {
            accountXViewModel.value.state = State.WizardDeleteReview;
        }
    }
    await startStateLoop();
};

// Debug functions

const shouldOpenDevtools = ref(false);

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
        accountXViewModel.value.state = State.WizardStart;
    }
};

// Lifecycle

onMounted(async () => {
    shouldOpenDevtools.value = await window.electron.shouldOpenDevtools();

    await updateArchivePath();

    if (props.account.xAccount !== null) {
        archiveTweets.value = props.account.xAccount.archiveTweets;
        archiveTweetsHTML.value = props.account.xAccount.archiveTweetsHTML;
        archiveLikes.value = props.account.xAccount.archiveLikes;
        archiveDMs.value = props.account.xAccount.archiveDMs;
        saveMyData.value = props.account.xAccount.saveMyData;
        deleteMyData.value = props.account.xAccount.deleteMyData;
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
        <AccountHeader :account="account" :show-dashboard-button="currentState != State.wizardStartDisplay"
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

        <!-- Wizard: start -->
        <div v-if="accountXViewModel?.state == State.WizardStartDisplay" class="wizard container mb-4 mt-3 mx-auto">
            <div class="mb-4">
                <h2>
                    Choose your adventure
                </h2>
                <p class="text-muted">
                    Choose what you want to do with your X data.
                </p>
            </div>
            <form @submit.prevent>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="saveMyData" v-model="saveMyData" type="checkbox" class="form-check-input"
                            @change="wizardStartUpdateButtonsText">
                        <label class="form-check-label" for="saveMyData">Save my data</label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            Create a local archive of tweets, retweets, likes, and/or direct messages
                        </small>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="deleteMyData" v-model="deleteMyData" type="checkbox" class="form-check-input"
                            @change="wizardStartUpdateButtonsText">
                        <label class="form-check-label" for="deleteMyData">Delete my data</label>
                        <span class="premium badge badge-primary">Premium</span>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            Delete my tweets, retweets, likes, and/or direct messages
                        </small>
                    </div>
                </div>

                <div class="buttons">
                    <button type="submit" class="btn btn-primary" :disabled="!(saveMyData || deleteMyData)"
                        @click="wizardStartNextClicked">
                        <i class="fa-solid fa-forward" />
                        {{ wizardNextText }}
                    </button>
                </div>
            </form>

            <p v-if="shouldOpenDevtools">
                <button class="btn btn-primary" @click="enableDebugMode">
                    Debug Mode
                </button>
            </p>
        </div>

        <!-- Wizard: save options -->
        <div v-if="accountXViewModel?.state == State.WizardSaveOptionsDisplay"
            class="wizard container mb-4 mt-3 mx-auto">
            <div class="mb-4">
                <h2>
                    Save options
                </h2>
                <p class="text-muted">
                    You can save your tweets, likes, and direct messages.
                </p>
            </div>
            <form @submit.prevent>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveTweets" v-model="archiveTweets" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveTweets">Save my tweets</label>
                    </div>
                </div>
                <div class="indent">
                    <div class="mb-3">
                        <div class="form-check">
                            <input id="archiveTweetsHTML" v-model="archiveTweetsHTML" type="checkbox"
                                class="form-check-input" :disabled="!archiveTweets">
                            <label class="form-check-label" for="archiveTweetsHTML">Save an HTML version of each
                                tweet</label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                Make an HTML archive of each tweet, including its replies, which is good for taking
                                screenshots
                                <em>(takes longer)</em>
                            </small>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveLikes" v-model="archiveLikes" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveLikes">Save my likes</label>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveDMs" v-model="archiveDMs" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveDMs">Save my direct messages</label>
                    </div>
                </div>

                <div class="buttons">
                    <button type="submit" class="btn btn-outline-secondary" @click="wizardSaveOptionsBackClicked">
                        <i class="fa-solid fa-backward" />
                        {{ wizardBackText }}
                    </button>

                    <button type="submit" class="btn btn-primary"
                        :disabled="!(archiveTweets || archiveLikes || archiveDMs)"
                        @click="wizardSaveOptionsNextClicked">
                        <i class="fa-solid fa-forward" />
                        {{ wizardNextText }}
                    </button>
                </div>
            </form>
        </div>

        <!-- Wizard: delete options -->
        <div v-if="accountXViewModel?.state == State.WizardDeleteOptionsDisplay"
            class="wizard container mb-4 mt-3 mx-auto">
            <div class="mb-4">
                <h2>
                    Delete options
                </h2>
                <p class="text-muted">
                    Delete your data from X, except for what you want to keep.
                </p>
            </div>
            <form @submit.prevent>
                <div class="d-flex align-items-center">
                    <div class="form-check mb-2">
                        <input id="deleteTweets" v-model="deleteTweets" type="checkbox" class="form-check-input">
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
                        <span class="ms-2 text-muted">(recommended)</span>
                    </div>
                </div>
                <div class="indent">
                    <div class="d-flex align-items-center">
                        <div class="form-check mb-2">
                            <input id="deleteTweetsRetweetsThresholdEnabled"
                                v-model="deleteTweetsRetweetsThresholdEnabled" type="checkbox" class="form-check-input"
                                :disabled="!deleteTweets">
                            <label class="form-check-label mr-1 text-nowrap" for="deleteTweetsRetweetsThresholdEnabled">
                                Unless they have at least
                            </label>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <label class="form-check-label mr-1 sr-only" for="deleteTweetsRetweetsThreshold">
                                retweets
                            </label>
                            <div class="input-group flex-nowrap">
                                <input id="deleteTweetsRetweetsThreshold" v-model="deleteTweetsRetweetsThreshold"
                                    type="text" class="form-control form-short" :disabled="!deleteTweets">
                                <div class="input-group-append">
                                    <span class="input-group-text">retweets</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center">
                        <div class="form-check mb-2">
                            <input id="deleteTweetsLikesThresholdEnabled" v-model="deleteTweetsLikesThresholdEnabled"
                                type="checkbox" class="form-check-input" :disabled="!deleteTweets">
                            <label class="form-check-label mr-1 text-nowrap" for="deleteTweetsLikesThresholdEnabled">
                                Or at least
                            </label>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <label class="form-check-label mr-1 sr-only" for="deleteTweetsLikesThreshold">
                                likes
                            </label>
                            <div class="input-group flex-nowrap">
                                <input id="deleteTweetsLikesThreshold" v-model="deleteTweetsLikesThreshold" type="text"
                                    class="form-control form-short" :disabled="!deleteTweets">
                                <div class="input-group-append">
                                    <span class="input-group-text">likes</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center">
                        <div class="mb-2">
                            <div class="form-check">
                                <input id="deleteTweetsArchiveEnabled" v-model="deleteTweetsArchiveEnabled"
                                    type="checkbox" class="form-check-input" :disabled="!deleteTweets">
                                <label class="form-check-label mr-1 text-nowrap" for="deleteTweetsArchiveEnabled">
                                    Save an HTML version of each tweet before deleting it
                                </label>
                            </div>
                            <div class="indent">
                                <small class="form-text text-muted">
                                    Make an HTML archive of each tweet, including its replies, which is good for taking
                                    screenshots <em>(takes longer)</em>
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="form-check mb-2">
                        <input id="deleteRetweets" v-model="deleteRetweets" type="checkbox" class="form-check-input">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteRetweets">
                            Unretweet tweets
                        </label>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-check-label mr-1 no-wrap text-nowrap" for="deleteRetweetsDaysOld">
                            older than
                        </label>
                        <div class="input-group flex-nowrap">
                            <input id="deleteRetweetsDaysOld" v-model="deleteRetweetsDaysOld" type="text"
                                class="form-control form-short">
                            <div class="input-group-append">
                                <span class="input-group-text">days</span>
                            </div>
                        </div>
                        <span class="ms-2 text-muted">(recommended)</span>
                    </div>
                </div>
                <div class="mb-2">
                    <div class="d-flex align-items-center">
                        <div class="form-check">
                            <input id="deleteLikes" v-model="deleteLikes" type="checkbox" class="form-check-input">
                            <label class="form-check-label mr-1 text-nowrap" for="deleteLikes">
                                Unlike tweets
                            </label>
                        </div>
                        <div class="d-flex align-items-center">
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
                    <div class="indent">
                        <small class="form-text text-muted">
                            Likes are private on X. If you've liked a lot of tweets, it might take a long time to delete
                            them all.
                        </small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="mb-2">
                        <div class="form-check">
                            <input id="deleteDMs" v-model="deleteDMs" type="checkbox" class="form-check-input">
                            <label class="form-check-label mr-1 text-nowrap" for="deleteDMs">
                                Delete all direct messages
                            </label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                This will only delete DMs from your account. The people you've sent messages to will
                                still
                                have them unless they delete their DMs as well.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="buttons">
                    <button type="submit" class="btn btn-outline-secondary" @click="wizardDeleteOptionsBackClicked">
                        <i class="fa-solid fa-backward" />
                        {{ wizardBackText }}
                    </button>

                    <button type="submit" class="btn btn-primary"
                        :disabled="!(archiveTweets || archiveLikes || archiveDMs)"
                        @click="wizardDeleteOptionsNextClicked">
                        <i class="fa-solid fa-forward" />
                        {{ wizardNextText }}
                    </button>
                </div>
            </form>
        </div>

        <!-- Wizard: review -->
        <div v-if="accountXViewModel?.state == State.WizardReviewDisplay" class="wizard container mb-4 mt-3 mx-auto">
            <div class="mb-4">
                <h2>
                    Review your choices
                </h2>
            </div>
            <form @submit.prevent>
                <div v-if="saveMyData">
                    <h3>
                        <i class="fa-solid fa-floppy-disk" />
                        Save my data
                    </h3>
                    <ul>
                        <li v-if="archiveTweets">
                            Save tweets
                            <ul>
                                <li v-if="archiveTweetsHTML">
                                    Save HTML versions of tweets
                                </li>
                            </ul>
                        </li>
                        <li v-if="archiveLikes">
                            Save likes
                        </li>
                        <li v-if="archiveDMs">
                            Save direct messages
                        </li>
                    </ul>
                </div>

                <div v-if="deleteMyData">
                    <h3>
                        <i class="fa-solid fa-fire" />
                        Delete my data
                    </h3>
                    <ul>
                        <li v-if="deleteTweets">
                            Delete tweets
                            <ul>
                                <li v-if="deleteTweetsRetweetsThresholdEnabled">
                                    Keep tweets with at least {{ deleteTweetsRetweetsThreshold }} retweets
                                </li>
                                <li v-if="deleteTweetsLikesThresholdEnabled">
                                    Keep tweets with at least {{ deleteTweetsLikesThreshold }} likes
                                </li>
                                <li v-if="deleteTweetsArchiveEnabled">
                                    Save an HTML version of each tweet before deleting it
                                </li>
                            </ul>
                        </li>
                        <li v-if="deleteRetweets">
                            Unretweet tweets
                        </li>
                        <li v-if="deleteLikes">
                            Unlike tweets
                        </li>
                        <li v-if="deleteDMs">
                            Delete direct messages
                        </li>
                    </ul>

                    <div class="mb-2">
                        <div class="form-check">
                            <input id="chanceToReview" v-model="chanceToReview" type="checkbox" class="form-check-input"
                                @change="wizardReviewUpdateButtonsText">
                            <label class="form-check-label mr-1 text-nowrap" for="chanceToReview">
                                Give me a chance to review my data before deleting it
                            </label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                If you don't check this box, your data will be deleted as soon Cyd builds your local
                                database.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="buttons">
                    <button type="submit" class="btn btn-outline-secondary" @click="wizardReviewBackClicked">
                        <i class="fa-solid fa-backward" />
                        {{ wizardBackText }}
                    </button>

                    <button type="submit" class="btn btn-primary"
                        :disabled="!(archiveTweets || archiveLikes || archiveDMs)" @click="wizardReviewNextClicked">
                        <i class="fa-solid fa-forward" />
                        {{ wizardNextText }}
                    </button>
                </div>
            </form>
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
                        <li v-if="account.xAccount?.archiveTweets || (progress?.retweetsIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.retweetsIndexed.toLocaleString() }}</strong> retweets
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
                            <li v-if="(progress?.retweetsIndexed ?? 0) > 0">
                                <i class="fa-solid fa-floppy-disk archive-bullet" />
                                <strong>{{ progress?.retweetsIndexed.toLocaleString() }}</strong> retweets
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

.wizard {
    height: 100vh;
    overflow: auto;
    max-width: 800px;
}

.wizard .buttons {
    margin-top: 3rem;
}

.wizard .buttons button {
    margin-right: 1rem;
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
    font-size: 0.7rem;
    margin-left: 1rem;
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

.indent {
    margin-left: 1.5rem;
}
</style>