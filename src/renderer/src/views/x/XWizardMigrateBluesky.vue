<script setup lang="ts">
import { IpcRendererEvent } from 'electron';
import { ref, onMounted, onUnmounted, computed } from 'vue'

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Pie } from 'vue-chartjs'

import {
    XViewModel,
    State as XState,
} from '../../view_models/XViewModel'
import {
    BlueskyMigrationProfile,
    XMigrateTweetCounts,
} from '../../../../shared_types'
import { setJobsType } from '../../util'
import { xHasSomeData, xGetLastImportArchive, xGetLastBuildDatabase } from '../../util_x'

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';
import LoadingComponent from '../shared_components/LoadingComponent.vue';

ChartJS.register(ArcElement, Tooltip, Legend)

enum State {
    Loading,
    NotConnected,
    Connecting,
    FinishInBrowser,
    Connected,
}

const state = ref<State>(State.Loading);

const blueskyProfile = ref<BlueskyMigrationProfile | null>(null);
const tweetCounts = ref<XMigrateTweetCounts | null>(null);

const blueskyHandle = ref('');
const connectButtonText = ref('Connect');

const hasSomeData = ref<boolean>(false);
const lastImportArchive = ref<Date | null>(null);
const lastBuildDatabase = ref<Date | null>(null);

// Props
const props = defineProps<{
    model: XViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: XState]
}>()

const connectClicked = async () => {
    connectButtonText.value = 'Connecting...';
    state.value = State.Connecting;

    try {
        const ret: boolean | string = await window.electron.X.blueskyAuthorize(props.model.account.id, blueskyHandle.value);
        if (ret !== true) {
            await window.electron.showMessage('Failed to connect to Bluesky.', `${ret}`);
            connectButtonText.value = 'Connect';
            state.value = State.NotConnected;
        } else {
            connectButtonText.value = 'Connect';
            state.value = State.FinishInBrowser;
        }
    } catch (e) {
        await window.electron.showMessage('Failed to connect to Bluesky', `${e}`);
        connectButtonText.value = 'Connect';
        state.value = State.NotConnected;
    }
}

const loadTweetCounts = async () => {
    tweetCounts.value = await window.electron.X.blueskyGetTweetCounts(props.model.account.id);
    console.log("Tweet counts", JSON.parse(JSON.stringify(tweetCounts.value)));
}

const oauthCallback = async (queryString: string) => {
    console.log('Bluesky OAuth callback', queryString);
    try {
        const ret: boolean | string = await window.electron.X.blueskyCallback(props.model.account.id, queryString);
        if (ret !== true) {
            await window.electron.showMessage('Failed to connect to Bluesky.', `${ret}`);
            state.value = State.NotConnected;
        } else {
            blueskyProfile.value = await window.electron.X.blueskyGetProfile(props.model.account.id);
            state.value = State.Connected;

            await loadTweetCounts();
        }
    } catch (e) {
        await window.electron.showMessage('Failed to connect to Bluesky', `${e}`);
        state.value = State.NotConnected;
    }
}

const disconnectClicked = async () => {
    await window.electron.X.blueskyDisconnect(props.model.account.id);
    state.value = State.NotConnected;
}

const migrateClicked = async () => {
    setJobsType(props.model.account.id, 'migrateBluesky');
    emit('setState', XState.WizardReview);
}

const deleteClicked = async () => {
    if (tweetCounts.value === null) {
        await window.electron.showMessage("You don't have any tweets to delete.", '');
        return;
    }

    if (!await window.electron.showQuestion('Are you sure you want to delete all migrated tweets from Bluesky?', 'Yes, delete them all', 'No, keep them')) {
        return;
    }

    setJobsType(props.model.account.id, 'migrateBlueskyDelete');
    emit('setState', XState.WizardReview);
}

const blueskyOAuthCallbackEventName = `blueskyOAuthCallback-${props.model.account.id}`;

const isArchiveOld = computed(() => {
    // The date before media was added to the Cyd archive, February 18, 2025
    const oldDate = new Date('2025-02-18T00:00:00Z');
    return (lastImportArchive.value == null || lastImportArchive.value < oldDate) &&
        (lastBuildDatabase.value == null || lastBuildDatabase.value < oldDate);
});

onMounted(async () => {
    // Load the last time the archive was imported and the database was built
    hasSomeData.value = await xHasSomeData(props.model.account.id);
    lastImportArchive.value = await xGetLastImportArchive(props.model.account.id);
    lastBuildDatabase.value = await xGetLastBuildDatabase(props.model.account.id);

    // Get Bluesky profile
    try {
        blueskyProfile.value = await window.electron.X.blueskyGetProfile(props.model.account.id);
    } catch (e) {
        await window.electron.showMessage('Failed to get Bluesky profile.', `${e}`);
    }
    if (blueskyProfile.value) {
        state.value = State.Connected;
        await loadTweetCounts();
    } else {
        state.value = State.NotConnected;
        tweetCounts.value = null;
    }

    // Listen for OAuth callback event
    console.log('Bluesky OAuth callback event name', blueskyOAuthCallbackEventName);
    window.electron.ipcRenderer.on(blueskyOAuthCallbackEventName, async (_event: IpcRendererEvent, queryString: string) => {
        await oauthCallback(queryString);
    });
});

onUnmounted(async () => {
    // Remove OAuth callback event listener
    window.electron.ipcRenderer.removeAllListeners(blueskyOAuthCallbackEventName);
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Migrate to Bluesky
                <span v-if="!userAuthenticated || !userPremium" class="premium badge badge-primary">Premium</span>
            </h2>
            <p class="text-muted">
                Import your old tweets into a Bluesky account. You may want to make a new Bluesky account just for your
                old tweets.
            </p>

            <div v-if="isArchiveOld" class="alert alert-warning">
                <p>
                    <strong>
                        We recommend that you reimport your local database of tweets, or rebuild it from scratch,
                        <em>before</em> migrating to Bluesky.
                    </strong>
                </p>
                <p>
                    When you last built your local database of tweets, Cyd didn't keep track of things like media,
                    replies, and quote tweets. If you migrate to Bluesky now, you may lose some of your data.
                </p>
            </div>

            <XLastImportOrBuildComponent :account-i-d="model.account.id" :show-button="true"
                :show-no-data-warning="true" :button-text="'Build Your Local Database'"
                :button-state="XState.WizardDatabase" @set-state="emit('setState', $event)" />

            <template v-if="state == State.Loading">
                <LoadingComponent />
            </template>
            <template v-if="state == State.NotConnected || state == State.Connecting">
                <form @submit.prevent="connectClicked">
                    <p>
                        To get started, connect your Bluesky account.
                    </p>
                    <div class="form-group">
                        <label for="username" class="sr-only">Bluesky Handle</label>
                        <div class="input-group">
                            <input id="handle" v-model="blueskyHandle" type="text" class="form-control"
                                placeholder="Bluesky Handle (for example, me.bsky.social)" required
                                :disabled="state !== State.NotConnected">
                            <div class="input-group-append">
                                <button class="btn btn-primary" type="submit" :disabled="state !== State.NotConnected">
                                    {{ connectButtonText }}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </template>
            <template v-else-if="state == State.FinishInBrowser">
                <div class="d-flex align-items-center">
                    <div class="flex-grow-1 fs-4">
                        Finish connecting to the Bluesky account <strong>@{{ blueskyHandle }}</strong> in your web
                        browser.
                    </div>
                    <div>
                        <button class="btn btn-secondary" type="button" @click="disconnectClicked">
                            Cancel
                        </button>
                    </div>
                </div>
            </template>
            <template v-else-if="state == State.Connected">
                <!-- Show the Bluesky account that is connected -->
                <hr>
                <p>
                    You have connected to the following Bluesky account:
                </p>
                <div class="d-flex align-items-center">
                    <div class="flex-grow-1">
                        <template v-if="blueskyProfile">
                            <template v-if="blueskyProfile.avatar">
                                <img :src="blueskyProfile.avatar" class="rounded-circle me-2" width="32" height="32">
                            </template>
                            <template v-if="blueskyProfile.displayName">
                                <span class="fw-bold me-2">{{ blueskyProfile.displayName }}</span>
                                <small class="text-muted">@{{ blueskyProfile.handle }}</small>
                            </template>
                            <template v-else>
                                <span class="fw-bold">@{{ blueskyProfile.handle }}</span>
                            </template>
                        </template>
                    </div>
                    <div>
                        <button class="btn btn-secondary" type="button" @click="disconnectClicked">
                            Disconnect
                        </button>
                    </div>
                </div>
                <hr>

                <!-- Connected: Show the preview of what will be migrated -->
                <template v-if="state == State.Connected && tweetCounts !== null">
                    <div class="container">
                        <div class="row">
                            <div class="col col-60">
                                <p v-if="tweetCounts.toMigrateTweets.length > 0">
                                    <strong>You can migrate
                                        {{ tweetCounts.toMigrateTweets.length.toLocaleString() }}
                                        tweets into Bluesky.</strong>
                                </p>
                                <p v-else>
                                    You don't have any tweets to migrate.
                                </p>
                                <ul class="small text-muted">
                                    <li>
                                        Your local database has a total of <strong>
                                            {{ tweetCounts.totalTweetsCount.toLocaleString() }}
                                            tweets</strong>.
                                    </li>
                                    <li>
                                        <strong>
                                            {{ tweetCounts.totalRetweetsCount.toLocaleString() }}
                                            tweets
                                        </strong>
                                        can't be migrated because they're retweets.
                                    </li>
                                    <li>
                                        <strong>
                                            {{ tweetCounts.cannotMigrateCount.toLocaleString() }}
                                            tweets
                                        </strong>
                                        can't be migrated because they're replies to users on X.
                                    </li>
                                    <li>
                                        <strong>
                                            {{ tweetCounts.alreadyMigratedTweets.length.toLocaleString() }}
                                            tweets
                                        </strong>
                                        have already been migrated.
                                    </li>
                                </ul>
                            </div>
                            <div class="col col-40">
                                <Pie :data="{
                                    labels: ['Ready to Migrate', 'Already Migrated', 'Replies', 'Retweets',],
                                    datasets: [{
                                        backgroundColor: ['#377eb8', '#ff7f00', '#4daf4a', '#984ea3'],
                                        data: [tweetCounts.toMigrateTweets.length, tweetCounts.alreadyMigratedTweets.length, tweetCounts.cannotMigrateCount, tweetCounts.totalRetweetsCount]
                                    }],
                                }" :options="{
                                    plugins: {
                                        legend: {
                                            display: true,
                                            position: 'bottom'
                                        },
                                        tooltip: {
                                            enabled: true
                                        }
                                    },
                                    responsive: true,
                                    maintainAspectRatio: false,
                                }" />
                            </div>
                        </div>
                    </div>

                    <div class="buttons mb-4">
                        <p>
                            <button type="submit" class="btn btn-primary text-nowrap m-1"
                                :disabled="tweetCounts.toMigrateTweets.length == 0" @click="migrateClicked">
                                <i class="fa-solid fa-forward" />
                                Continue to Review
                            </button>
                        </p>
                        <p>
                            <button v-if="tweetCounts.alreadyMigratedTweets.length > 0" type="submit"
                                class="btn btn-sm btn-danger text-nowrap m-1" @click="deleteClicked">
                                <i class="fa-solid fa-trash" />
                                Delete Migrated Tweets from Bluesky
                            </button>
                        </p>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<style scoped>
.col-60 {
    width: 60%;
}

.col-40 {
    width: 40%;
}
</style>