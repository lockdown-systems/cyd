<script setup lang="ts">
import { IpcRendererEvent } from 'electron';
import { ref, onMounted, onUnmounted } from 'vue'
import {
    AccountXViewModel
} from '../../view_models/AccountXViewModel'
import { BlueskyMigrationProfile } from '../../../../shared_types'

enum State {
    NotConnected,
    Connecting,
    FinishInBrowser,
    Connected,
}

const state = ref<State>(State.NotConnected);

const blueskyProfile = ref<BlueskyMigrationProfile | null>(null);

const blueskyHandle = ref('');
const connectButtonText = ref('Connect');

// Props
const props = defineProps<{
    model: AccountXViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

const connectClicked = async () => {
    connectButtonText.value = 'Connecting...';
    state.value = State.Connecting;

    try {
        const ret: boolean | string = await window.electron.X.blueskyAuthorize(props.model.account.id, blueskyHandle.value);
        if (ret !== true) {
            await window.electron.showMessage('Failed to connect to Bluesky: ' + ret);
            connectButtonText.value = 'Connect';
            state.value = State.NotConnected;
        } else {
            connectButtonText.value = 'Connect';
            state.value = State.FinishInBrowser;
        }
    } catch (e) {
        await window.electron.showMessage('Failed to connect to Bluesky: ' + e);
        connectButtonText.value = 'Connect';
        state.value = State.NotConnected;
    }
}

const oauthCallback = async (queryString: string) => {
    try {
        const ret: boolean | string = await window.electron.X.blueskyCallback(props.model.account.id, queryString);
        if (ret !== true) {
            await window.electron.showMessage('Failed to connect to Bluesky: ' + ret);
            state.value = State.NotConnected;
        } else {
            blueskyProfile.value = await window.electron.X.blueskyGetProfile(props.model.account.id);
            state.value = State.Connected;
        }
    } catch (e) {
        await window.electron.showMessage('Failed to connect to Bluesky: ' + e);
        state.value = State.NotConnected;
    }
}

const disconnectClicked = async () => {
    await window.electron.X.blueskyDisconnect(props.model.account.id);
    state.value = State.NotConnected;
}

const blueskyOAuthCallbackEventName = `blueskyOAuthCallback-${props.model.account.id}`;

onMounted(async () => {
    // Get Bluesky profile
    try {
        blueskyProfile.value = await window.electron.X.blueskyGetProfile(props.model.account.id);
    } catch (e) {
        await window.electron.showMessage('Failed to get Bluesky profile: ' + e);
    }
    if (blueskyProfile.value) {
        state.value = State.Connected;
    } else {
        state.value = State.NotConnected;
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
                Import your old tweets into a Bluesky account.
            </p>

            <div class="alert alert-light" role="alert">
                <div class="small">
                    <p>
                        <strong>Considering making a new Bluesky account just for your old tweets.</strong><br>
                        This is a good way to keep your old tweets separate from your new posts.
                    </p>
                    <p>
                        <strong>Not all of your tweets can be imported into Bluesky.</strong><br>
                        Cyd will import tweets that are not replies, and also tweets where you're replying to yourself,
                        which will keep your threads intact.
                    </p>
                </div>
            </div>

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
            <template v-else-if="state == State.Connected">
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
            </template>
        </div>
    </div>
</template>

<style scoped></style>