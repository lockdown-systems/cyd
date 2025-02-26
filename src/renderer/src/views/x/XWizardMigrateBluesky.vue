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
import { openURL, setJobsType } from '../../util'
import { xHasSomeData, xGetLastImportArchive, xGetLastBuildDatabase } from '../../util_x'

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';

ChartJS.register(ArcElement, Tooltip, Legend)

enum State {
    Loading,
    NotConnected,
    Connecting,
    FinishInBrowser,
    Connected,
    Migrating,
    Deleting,
    Finished,
}

const state = ref<State>(State.Loading);

const blueskyProfile = ref<BlueskyMigrationProfile | null>(null);
const tweetCounts = ref<XMigrateTweetCounts | null>(null);
const migratedTweetsCount = ref(0);
const skippedTweetsCount = ref(0);
const skippedTweetsErrors = ref<Record<string, string>>({});
const deletedPostsCount = ref(0);
const skippedDeletePostsCount = ref(0);
const shouldCancelMigration = ref(false);

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

const migrateCancelClicked = async () => {
    shouldCancelMigration.value = true;
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

const viewBlueskyProfileClicked = async () => {
    await openURL(`https://bsky.app/profile/${blueskyProfile.value?.handle}`);
}

const blueskyOAuthCallbackEventName = `blueskyOAuthCallback-${props.model.account.id}`;

const isArchiveOld = computed(() => {
    // The date before media was added to the Cyd archive, February 18, 2025
    const oldDate = new Date('2025-02-18T00:00:00Z');
    return lastImportArchive.value !== null && lastImportArchive.value < oldDate ||
        lastBuildDatabase.value !== null && lastBuildDatabase.value < oldDate;
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
                <p>
                    Loading...
                </p>
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
            <template
                v-else-if="state == State.Connected || state == State.Migrating || state == State.Deleting || state == State.Finished">
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
                            <div class="col">
                                <p v-if="tweetCounts.toMigrateTweetIDs.length > 0">
                                    <strong>You can migrate
                                        {{ tweetCounts.toMigrateTweetIDs.length.toLocaleString() }}
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
                                            {{ tweetCounts.alreadyMigratedTweetIDs.length.toLocaleString() }}
                                            tweets
                                        </strong>
                                        have already been migrated.
                                    </li>
                                </ul>
                            </div>
                            <div class="col">
                                <Pie :data="{
                                    labels: ['Ready to Migrate', 'Already Migrated', 'Replies', 'Retweets',],
                                    datasets: [{
                                        backgroundColor: ['#377eb8', '#ff7f00', '#4daf4a', '#984ea3'],
                                        data: [tweetCounts.toMigrateTweetIDs.length, tweetCounts.alreadyMigratedTweetIDs.length, tweetCounts.cannotMigrateCount, tweetCounts.totalRetweetsCount]
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
                                :disabled="tweetCounts.toMigrateTweetIDs.length == 0" @click="migrateClicked">
                                <i class="fa-solid fa-forward" />
                                Continue to Review
                            </button>
                        </p>
                        <p>
                            <button v-if="tweetCounts.alreadyMigratedTweetIDs.length > 0" type="submit"
                                class="btn btn-sm btn-danger text-nowrap m-1" @click="deleteClicked">
                                <i class="fa-solid fa-trash" />
                                Delete Migrated Tweets from Bluesky
                            </button>
                        </p>
                    </div>
                </template>

                <!-- Migrating: Migration progress bar, and cancel button -->
                <template v-if="state == State.Migrating">
                    <div v-if="tweetCounts !== null">
                        <p class="text-center">
                            Posted
                            <b>
                                {{ migratedTweetsCount.toLocaleString() }} of
                                {{ tweetCounts.toMigrateTweetIDs.length.toLocaleString() }} tweets
                            </b>
                            to Bluesky.
                            <small v-if="skippedTweetsCount > 0" class="text-muted">
                                Skipped
                                <b>
                                    {{ skippedTweetsCount.toLocaleString() }} tweets
                                </b>
                                because of errors, but you can try again with them.
                            </small>
                        </p>
                        <div class="progress flex-grow-1 me-2">
                            <div class="progress-bar" role="progressbar"
                                :style="{ width: `${((migratedTweetsCount + skippedTweetsCount) / tweetCounts.toMigrateTweetIDs.length) * 100}%` }"
                                :aria-valuenow="((migratedTweetsCount + skippedTweetsCount) / tweetCounts.toMigrateTweetIDs.length) * 100"
                                aria-valuemin="0" aria-valuemax="100">
                                {{ Math.round(((migratedTweetsCount + skippedTweetsCount) /
                                    tweetCounts.toMigrateTweetIDs.length) * 100) }}%
                            </div>
                        </div>
                    </div>

                    <div class="buttons mb-4">
                        <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="shouldCancelMigration"
                            @click="migrateCancelClicked">
                            <i class="fa-solid fa-xmark" />
                            Cancel
                        </button>
                    </div>
                </template>

                <!-- Deleting: Deleting progress bar -->
                <template v-if="state == State.Deleting">
                    <div v-if="tweetCounts !== null">
                        <p class="text-center">
                            Deleted
                            <b>
                                {{ deletedPostsCount.toLocaleString() }} of
                                {{ tweetCounts.alreadyMigratedTweetIDs.length.toLocaleString() }} migrated tweets
                            </b>
                            from Bluesky.
                            <small v-if="skippedDeletePostsCount > 0" class="text-muted">
                                Skipped
                                <b>
                                    {{ skippedDeletePostsCount.toLocaleString() }} migrated tweets
                                </b>
                                because of errors, but you can try again with them.
                            </small>
                        </p>
                        <div class="progress flex-grow-1 me-2">
                            <div class="progress-bar" role="progressbar"
                                :style="{ width: `${((deletedPostsCount + skippedDeletePostsCount) / tweetCounts.alreadyMigratedTweetIDs.length) * 100}%` }"
                                :aria-valuenow="((deletedPostsCount + skippedDeletePostsCount) / tweetCounts.alreadyMigratedTweetIDs.length) * 100"
                                aria-valuemin="0" aria-valuemax="100">
                                {{ Math.round(((deletedPostsCount + skippedDeletePostsCount) /
                                    tweetCounts.alreadyMigratedTweetIDs.length) * 100) }}%
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Finished -->
                <template v-if="state == State.Finished">
                    <h2 class="mt-4">
                        Finished migrating tweets to Bluesky!
                    </h2>
                    <p>
                        You migrated <strong>{{ migratedTweetsCount.toLocaleString() }} tweets</strong> to Bluesky.
                    </p>
                    <div v-if="skippedTweetsCount > 0" class="alert alert-warning mt-4">
                        <p>
                            <strong>
                                {{ skippedTweetsCount.toLocaleString() }} tweets
                            </strong>
                            were skipped because of errors:
                        </p>
                        <ul>
                            <li v-for="(error, tweetID) in skippedTweetsErrors" :key="tweetID">
                                <small><strong>{{ tweetID }}</strong>: {{ error }}</small>
                            </li>
                        </ul>
                    </div>
                    <div class="buttons mb-4">
                        <p>
                            <button type="submit" class="btn btn-success text-nowrap m-1"
                                @click="viewBlueskyProfileClicked">
                                <i class="fa-brands fa-bluesky" />
                                Check out your Bluesky profile!
                            </button>
                        </p>
                        <p>
                            <button type="submit" class="btn btn-primary text-nowrap m-1"
                                @click="state = State.Connected;">
                                <i class="fa-solid fa-forward" />
                                Continue
                            </button>
                        </p>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<style scoped></style>