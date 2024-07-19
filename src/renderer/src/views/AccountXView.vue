<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Electron from 'electron';

import AccountHeader from '../components/AccountHeader.vue';
import SpeechBubble from '../components/SpeechBubble.vue';
import ProgressXComponent from '../components/ProgressXComponent.vue';
import type { Account, XProgress } from '../../../shared_types';

import { AccountXViewModel, State } from '../view_models/AccountXViewModel'

const props = defineProps<{
    account: Account;
}>();

const emit = defineEmits(['onRefreshClicked']);

const accountXViewModel = ref<AccountXViewModel | null>(null);
const progress = ref<XProgress | null>(null);

const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);
const isWebviewMounted = ref(true);

// Keep progress updated
watch(
    () => accountXViewModel.value?.progress,
    (newProgress) => { progress.value = newProgress; },
    { deep: true, }
);

// Settings
const archiveTweets = ref(false);
const archiveDirectMessages = ref(false);
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
const deleteDirectMessages = ref(false);
const deleteDirectMessagesDaysOld = ref(0);

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
            archiveDirectMessages: archiveDirectMessages.value,
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
            deleteDirectMessages: deleteDirectMessages.value,
            deleteDirectMessagesDaysOld: deleteDirectMessagesDaysOld.value
        }
    };
    await window.electron.database.saveAccount(JSON.stringify(updatedAccount));
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.account = updatedAccount;
    }
};

const startDownloadingClicked = async () => {
    await updateSettings();
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.state = State.Download;
        await startStateLoop();
    }
};

const startDeletingClicked = async () => {
    await updateSettings();
    if (accountXViewModel.value !== null) {
        accountXViewModel.value.state = State.Download;
        await startStateLoop();
    }
};

const startStateLoop = async () => {
    while (isWebviewMounted.value) {
        await runNextState();

        if (accountXViewModel.value?.state === State.DashboardDisplay) {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }
};

const runNextState = async () => {
    if (accountXViewModel.value !== null) {
        await accountXViewModel.value.run();
    }
};

onMounted(async () => {
    if (props.account.xAccount !== null) {
        archiveTweets.value = props.account.xAccount.archiveTweets;
        archiveDirectMessages.value = props.account.xAccount.archiveDirectMessages;
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
        deleteDirectMessages.value = props.account.xAccount.deleteDirectMessages;
        deleteDirectMessagesDaysOld.value = props.account.xAccount.deleteDirectMessagesDaysOld;
    }

    if (webviewComponent.value !== null) {
        const webview = webviewComponent.value;

        // Start the MITM proxy
        await window.electron.mitmProxy.start(props.account.id, ["x.com/i/api/graphql"]);

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
    // Stop the MITM proxy
    await window.electron.mitmProxy.stop(props.account.id);

    isWebviewMounted.value = false;
});
</script>

<template>
    <div class="wrapper d-flex flex-column">
        <AccountHeader :account="account" @on-refresh-clicked="emit('onRefreshClicked')" />

        <!-- Speech bubble -->
        <SpeechBubble ref="speechBubbleComponent" :message="accountXViewModel?.instructions || ''"
            class="speech-bubble" />

        <!-- Progress -->
        <ProgressXComponent v-if="progress" :progress="progress" />

        <!-- Webview -->
        <webview ref="webviewComponent" src="about:blank" class="webview" :partition="`persist:account-${account.id}`"
            :class="{ 'hidden': !accountXViewModel?.showBrowser }" />

        <!-- Dashboard -->
        <div v-if="accountXViewModel?.state == State.DashboardDisplay" class="dashboard">
            <h2>Download my data</h2>
            <div class="container mb-4">
                <form @submit.prevent>
                    <div class=" mb-3 form-check">
                        <input id="archiveTweets" v-model="archiveTweets" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveTweets">Archive tweets</label>
                    </div>
                    <div class="mb-3 form-check">
                        <input id="archiveDirectMessages" v-model="archiveDirectMessages" type="checkbox"
                            class="form-check-input">
                        <label class="form-check-label" for="archiveDirectMessages">Archive direct messages</label>
                    </div>
                    <button type="submit" class="btn btn-primary" @click="startDownloadingClicked">
                        Start Downloading
                    </button>
                </form>
            </div>

            <h2>Delete my data</h2>
            <div class="container mb-4">
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
                            <input id="deleteDirectMessages" v-model="deleteDirectMessages" type="checkbox"
                                class="form-check-input">
                            <label class="form-check-label mr-1" for="deleteDirectMessages">
                                Delete direct messages
                            </label>
                        </div>
                        <div class="d-flex align-items-center mb-2">
                            <label class="form-check-label mr-1 no-wrap" for="deleteDirectMessagesDaysOld">
                                older than
                            </label>
                            <div class="input-group">
                                <input id="deleteDirectMessagesDaysOld" v-model="deleteDirectMessagesDaysOld"
                                    type="text" class="form-control form-short">
                                <div class="input-group-append">
                                    <span class="input-group-text">days</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary"
                        :disabled="!(deleteTweets || deleteRetweets || deleteLikes || deleteDirectMessages)"
                        @click="startDeletingClicked">
                        Start Deleting
                    </button>
                </form>
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
</style>