<script setup lang="ts">
import { IpcRendererEvent } from 'electron';
import { ref, onMounted, onUnmounted } from 'vue'
import {
    XViewModel
} from '../../view_models/XViewModel'
import {
    BlueskyMigrationProfile,
    XMigrateTweetCounts,
} from '../../../../shared_types'
import { openURL } from '../../util'

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

// Props
const props = defineProps<{
    model: XViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

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
    if (tweetCounts.value === null) {
        await window.electron.showMessage("You don't have any tweets to migrate.", '');
        return;
    }

    migratedTweetsCount.value = 0;
    skippedTweetsCount.value = 0;
    skippedTweetsErrors.value = {};

    state.value = State.Migrating;
    shouldCancelMigration.value = false;

    for (const tweetID of tweetCounts.value.toMigrateTweetIDs) {
        const resp = await window.electron.X.blueskyMigrateTweet(props.model.account.id, tweetID);
        if (typeof resp === 'string') {
            skippedTweetsCount.value++;
            skippedTweetsErrors.value[tweetID] = resp;
            console.error('Failed to migrate tweet', tweetID, resp);
        } else {
            migratedTweetsCount.value++;
        }

        // Cancel early
        if (shouldCancelMigration.value) {
            await window.electron.showMessage('Migration cancelled.', `You have already posted ${migratedTweetsCount.value} tweets into your Blueksy account.`);
            state.value = State.Connected;
            await loadTweetCounts();
            return;
        }
    }

    await loadTweetCounts();
    state.value = State.Finished;
}

const migrateCancelClicked = async () => {
    shouldCancelMigration.value = true;
}

const deleteClicked = async () => {
    if (tweetCounts.value === null) {
        await window.electron.showMessage("You don't have any tweets to delete.", '');
        return;
    }

    deletedPostsCount.value = 0;
    skippedDeletePostsCount.value = 0;

    state.value = State.Deleting;

    for (const tweetID of tweetCounts.value.alreadyMigratedTweetIDs) {
        if (await window.electron.X.blueskyDeleteMigratedTweet(props.model.account.id, tweetID)) {
            deletedPostsCount.value++;
        } else {
            skippedDeletePostsCount.value++;
            console.error('Failed to delete migrated tweet', tweetID);
        }
    }

    await loadTweetCounts();
    state.value = State.Connected;
}

const viewBlueskyProfileClicked = async () => {
    await openURL(`https://bsky.app/profile/${blueskyProfile.value?.handle}`);
}

const blueskyOAuthCallbackEventName = `blueskyOAuthCallback-${props.model.account.id}`;

onMounted(async () => {
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
                    <div class="flex-grow-1">
                        Finish connecting to the Bluesky account <strong>@{{ blueskyHandle }}</strong> in web browser.
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
                    <p class="mt-4">
                        <span v-if="tweetCounts.toMigrateTweetIDs.length > 0">
                            Are you ready to migrate
                            <strong>
                                {{ tweetCounts.toMigrateTweetIDs.length.toLocaleString() }}
                            </strong>
                            tweets into Bluesky?
                        </span>
                        <span v-else>
                            You don't have any tweets to migrate.
                        </span>
                        <br>
                        <small class="text-muted">
                            <strong>
                                {{ tweetCounts.cannotMigrateCount.toLocaleString() }}
                            </strong>
                            tweets can't be migrated because they're replies to users on X.<br>
                            <strong>
                                {{ tweetCounts.alreadyMigratedTweetIDs.length.toLocaleString() }}
                            </strong>
                            tweets have already been migrated.
                        </small>
                    </p>

                    <div class="buttons mb-4">
                        <p>
                            <button type="submit" class="btn btn-primary text-nowrap m-1"
                                :disabled="tweetCounts.toMigrateTweetIDs.length == 0" @click="migrateClicked">
                                <i class="fa-brands fa-bluesky" />
                                Start Migrating to Bluesky
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