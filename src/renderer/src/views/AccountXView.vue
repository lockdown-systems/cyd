<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Electron from 'electron';

import AccountHeader from '../components/AccountHeader.vue';
import SpeechBubble from '../components/SpeechBubble.vue';
import XProgressComponent from '../components/XProgressComponent.vue';
import XJobStatusComponent from '../components/XJobStatusComponent.vue';
import type { Account, XProgress, XJob } from '../../../shared_types';

import { AccountXViewModel, State } from '../view_models/AccountXViewModel'

const props = defineProps<{
    account: Account;
}>();

const emit = defineEmits(['onRefreshClicked']);

const accountXViewModel = ref<AccountXViewModel | null>(null);

const progress = ref<XProgress | null>(null);
const currentJobs = ref<XJob[]>([]);
const isPaused = ref<boolean>(false);

const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);
const isWebviewMounted = ref(true);

// Keep progress updated
watch(
    () => accountXViewModel.value?.progress,
    (newProgress) => { if (newProgress) progress.value = newProgress; },
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

const openArchiveFolder = async () => {
    await window.electron.X.openFolder(props.account.id, "");
};

const openArchive = async () => {
    await window.electron.X.openFolder(props.account.id, "index.html");
};

// Settings
const archiveTweets = ref(false);
const archiveDMs = ref(false);
const deleteTweets = ref(false);
const deleteTweetsDaysOld = ref(0);
const deleteTweetsLikesThresholdEnabled = ref(false);
const deleteTweetsLikesThreshold = ref(0);
const deleteTweetsRetweetsThresholdEnabled = ref(false);
const deleteTweetsRetweetsThreshold = ref(0);
const deleteRetweets = ref(false);
const deleteRetweetsDaysOld = ref(0);
const deleteLikes = ref(false);
const deleteLikesDaysOld = ref(0);
const deleteDMs = ref(false);
const deleteDMsDaysOld = ref(0);

// Force re-index everything options
const isFirstIndex = ref(true);
const archiveForceIndexEverything = ref(false);
const deleteForceIndexEverything = ref(false);

const updateSettings = async () => {
    console.log('Updating settings')
    const updatedAccount: Account = {
        id: props.account.id,
        type: props.account.type,
        sortOrder: props.account.sortOrder,
        xAccount: {
            id: props.account.xAccount?.id || 0,
            createdAt: props.account.xAccount?.createdAt || new Date(),
            updatedAt: new Date(),
            accessedAt: new Date(),
            username: props.account.xAccount?.username || '',
            archiveTweets: archiveTweets.value,
            archiveDMs: archiveDMs.value,
            deleteTweets: deleteTweets.value,
            deleteTweetsDaysOld: deleteTweetsDaysOld.value,
            deleteTweetsLikesThresholdEnabled: deleteTweetsLikesThresholdEnabled.value,
            deleteTweetsLikesThreshold: deleteTweetsLikesThreshold.value,
            deleteTweetsRetweetsThresholdEnabled: deleteTweetsRetweetsThresholdEnabled.value,
            deleteTweetsRetweetsThreshold: deleteTweetsRetweetsThreshold.value,
            deleteRetweets: deleteRetweets.value,
            deleteRetweetsDaysOld: deleteRetweetsDaysOld.value,
            deleteLikes: deleteLikes.value,
            deleteLikesDaysOld: deleteLikesDaysOld.value,
            deleteDMs: deleteDMs.value,
            deleteDMsDaysOld: deleteDMsDaysOld.value
        }
    };
    await window.electron.database.saveAccount(JSON.stringify(updatedAccount));
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.account = updatedAccount;
    }
};

const startArchivingClicked = async () => {
    await updateSettings();
    if (accountXViewModel.value) {
        accountXViewModel.value.forceIndexEverything = archiveForceIndexEverything.value;
        await accountXViewModel.value.startArchiving();
        await startStateLoop();
    }
};

const startDeletingClicked = async () => {
    await updateSettings();
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.forceIndexEverything = deleteForceIndexEverything.value;
        await accountXViewModel.value.startDeleting();
        await startStateLoop();
    }
};

const startStateLoop = async () => {
    console.log('State loop started');
    while (isWebviewMounted.value) {
        await runNextState();

        if (
            accountXViewModel.value?.state === State.DashboardDisplay ||
            accountXViewModel.value?.state === State.FinishedRunningJobs
        ) {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log('State loop ended');
};

const runNextState = async () => {
    if (accountXViewModel.value !== null) {
        await accountXViewModel.value.run();
    }
};

const reset = async () => {
    await accountXViewModel.value?.reset()
    await startStateLoop();
};

onMounted(async () => {
    const path = await window.electron.getAccountDataPath(props.account.id, '');
    if (path) {
        archivePath.value = path;
    }

    if (props.account.xAccount !== null) {
        archiveTweets.value = props.account.xAccount.archiveTweets;
        archiveDMs.value = props.account.xAccount.archiveDMs;
        deleteTweets.value = props.account.xAccount.deleteTweets;
        deleteTweetsDaysOld.value = props.account.xAccount.deleteTweetsDaysOld;
        deleteTweetsLikesThresholdEnabled.value = props.account.xAccount.deleteTweetsLikesThresholdEnabled;
        deleteTweetsLikesThreshold.value = props.account.xAccount.deleteTweetsLikesThreshold;
        deleteTweetsRetweetsThresholdEnabled.value = props.account.xAccount.deleteTweetsRetweetsThresholdEnabled;
        deleteTweetsRetweetsThreshold.value = props.account.xAccount.deleteTweetsRetweetsThreshold;
        deleteRetweets.value = props.account.xAccount.deleteRetweets;
        deleteRetweetsDaysOld.value = props.account.xAccount.deleteRetweetsDaysOld;
        deleteLikes.value = props.account.xAccount.deleteLikes;
        deleteLikesDaysOld.value = props.account.xAccount.deleteLikesDaysOld;
        deleteDMs.value = props.account.xAccount.deleteDMs;
        deleteDMsDaysOld.value = props.account.xAccount.deleteDMsDaysOld;
    }

    // Check if this is the first time indexing tweets/dms has happened in this account
    isFirstIndex.value = (
        await window.electron.X.getLastFinishedJob(props.account.id, "indexTweets") == null &&
        await window.electron.X.getLastFinishedJob(props.account.id, "indexDMs") == null
    );

    if (webviewComponent.value !== null) {
        const webview = webviewComponent.value;

        // Start the state loop
        if (props.account.xAccount !== null) {
            accountXViewModel.value = new AccountXViewModel(props.account, webview);
            await accountXViewModel.value.init();
            await startStateLoop();
        }
    } else {
        console.error('Webview component not found');
    }
});

onUnmounted(async () => {
    isWebviewMounted.value = false;
});
</script>

<template>
    <div class="wrapper d-flex flex-column">
        <AccountHeader :account="account" @on-refresh-clicked="emit('onRefreshClicked')" />

        <div class="d-flex align-items-center">
            <!-- Speech bubble -->
            <SpeechBubble ref="speechBubbleComponent" :message="accountXViewModel?.instructions || ''"
                class="flex-grow-1" :class="{ 'w-100': currentJobs.length === 0 }" />

            <!-- Job status -->
            <XJobStatusComponent v-if="currentJobs.length > 0 && accountXViewModel?.state == State.RunJobs"
                :jobs="currentJobs" :is-paused="isPaused" class="job-status-component"
                @on-pause="accountXViewModel?.pause()" @on-resume="accountXViewModel?.resume()" />
        </div>

        <!-- Progress -->
        <XProgressComponent v-if="progress && accountXViewModel?.state == State.RunJobs" :progress="progress"
            :account-i-d="account.id" />

        <!-- Webview -->
        <webview ref="webviewComponent" src="about:blank" class="webview mt-3"
            :partition="`persist:account-${account.id}`" :class="{ 'hidden': !accountXViewModel?.showBrowser }" />

        <!-- Dashboard -->
        <div v-if="accountXViewModel?.state == State.DashboardDisplay" class="dashboard">
            <div class="container mb-4 mt-3">
                <h2>Archive my data</h2>
                <form @submit.prevent>
                    <div class="mb-3 form-check">
                        <input id="archiveTweets" v-model="archiveTweets" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveTweets">Archive tweets</label>
                    </div>
                    <div class="mb-3 form-check">
                        <input id="archiveDMs" v-model="archiveDMs" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveDMs">Archive direct messages</label>
                    </div>
                    <div v-if="!isFirstIndex" class="mb-3 form-check force-reindex">
                        <input id="archiveForceIndexEverything" v-model="archiveForceIndexEverything" type="checkbox"
                            class="form-check-input">
                        <label class="form-check-label" for="archiveForceIndexEverything">Force Semiphemeral to
                            re-index everything, instead of just the newest</label>
                    </div>
                    <button type="submit" class="btn btn-primary" :disabled="!(archiveTweets || archiveDMs)"
                        @click="startArchivingClicked">
                        Start Archiving
                    </button>
                </form>
            </div>

            <div class="container mb-4">
                <h2>Delete my data</h2>
                <form @submit.prevent>
                    <div class="d-flex align-items-center">
                        <div class="form-check mb-2">
                            <input id="deleteTweets" v-model="deleteTweets" type="checkbox" class="form-check-input">
                            <label class="form-check-label mr-1" for="deleteTweets">
                                Delete tweets
                            </label>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <label class="form-check-label mr-1 no-wrap" for="deleteTweetsDaysOld">
                                older than
                            </label>
                            <div class="input-group">
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
                                <label class="form-check-label mr-1" for="deleteTweetsRetweetsThresholdEnabled">
                                    Unless they have at least
                                </label>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <label class="form-check-label mr-1 sr-only" for="deleteTweetsRetweetsThreshold">
                                    retweets
                                </label>
                                <div class="input-group">
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
                                <input id="deleteTweetsLikesThresholdEnabled"
                                    v-model="deleteTweetsLikesThresholdEnabled" type="checkbox" class="form-check-input"
                                    :disabled="!deleteTweets">
                                <label class="form-check-label mr-1" for="deleteTweetsLikesThresholdEnabled">
                                    Or at least
                                </label>
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <label class="form-check-label mr-1 sr-only" for="deleteTweetsLikesThreshold">
                                    likes
                                </label>
                                <div class="input-group">
                                    <input id="deleteTweetsLikesThreshold" v-model="deleteTweetsLikesThreshold"
                                        type="text" class="form-control form-short" :disabled="!deleteTweets">
                                    <div class="input-group-append">
                                        <span class="input-group-text">likes</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="d-flex align-items-center">
                        <div class="form-check mb-2">
                            <input id="deleteRetweets" v-model="deleteRetweets" type="checkbox"
                                class="form-check-input">
                            <label class="form-check-label mr-1" for="deleteRetweets">
                                Unretweet tweets
                            </label>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <label class="form-check-label mr-1 no-wrap" for="deleteRetweetsDaysOld">
                                older than
                            </label>
                            <div class="input-group">
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
                            <input id="deleteLikes" v-model="deleteLikes" type="checkbox" class="form-check-input">
                            <label class="form-check-label mr-1" for="deleteLikes">
                                Unlike tweets
                            </label>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <label class="form-check-label mr-1 no-wrap" for="deleteLikesDaysOld">
                                older than
                            </label>
                            <div class="input-group">
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
                            <label class="form-check-label mr-1" for="deleteDMs">
                                Delete direct messages
                            </label>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <label class="form-check-label mr-1 no-wrap" for="deleteDMsDaysOld">
                                older than
                            </label>
                            <div class="input-group">
                                <input id="deleteDMsDaysOld" v-model="deleteDMsDaysOld" type="text"
                                    class="form-control form-short">
                                <div class="input-group-append">
                                    <span class="input-group-text">days</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-if="!isFirstIndex" class="mb-3 form-check force-reindex">
                        <input id="deleteForceIndexEverything" v-model="deleteForceIndexEverything" type="checkbox"
                            class="form-check-input">
                        <label class="form-check-label" for="deleteForceIndexEverything">Force Semiphemeral to
                            re-index everything, instead of just the newest</label>
                    </div>
                    <button type="submit" class="btn btn-primary"
                        :disabled="!(deleteTweets || deleteRetweets || deleteLikes || deleteDMs)"
                        @click="startDeletingClicked">
                        Start Deleting
                    </button>
                </form>
            </div>
        </div>

        <!-- Finished running jobs -->
        <div v-if="accountXViewModel?.state == State.FinishedRunningJobs" class="finished">
            <div v-if="accountXViewModel.action == 'archive'" class="container mt-3">
                <p>Your X archive is stored locally on your computer at:</p>
                <p>
                    <a href="#" class="filesystem-path" @click.prevent="openArchiveFolder">
                        {{ archivePath }}
                    </a>
                </p>
                <p>
                    If you want to download new versions of your tweets or DM conversations, delete the HTML files
                    you want to re-archive and then archive your X data again.
                </p>
                <p>
                    You can browse your archive by loading <a href="#" class="filesystem-path"
                        @click.prevent="openArchive">index.html</a>.
                </p>
            </div>
            <div v-if="accountXViewModel.action == 'delete'" class="container mt-3">
                <p>DELETE NOT IMPLEMENTED YET</p>
            </div>
            <div>
                <div class="container mt-3">
                    <button class="btn btn-primary" @click="reset()">
                        Continue
                    </button>
                </div>
            </div>
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
    width: 50px;
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
</style>