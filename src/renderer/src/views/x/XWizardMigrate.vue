<script setup lang="ts">
import { ref } from 'vue'
import {
    AccountXViewModel
} from '../../view_models/AccountXViewModel'

enum State {
    NotConnected,
    Connecting,
    FinishInBrowser,
    Connected,
}

const state = ref<State>(State.NotConnected);

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

    const ret: boolean | string = await window.electron.X.blueskyAuthorize(props.model.account.id, blueskyHandle.value);
    if (ret !== true) {
        await window.electron.showMessage('Failed to connect to Bluesky: ' + ret);
        connectButtonText.value = 'Connect';
        state.value = State.NotConnected;
    } else {
        connectButtonText.value = 'Connect';
        state.value = State.FinishInBrowser;
    }
}

const disconnectClicked = async () => {
    // await window.electron.X.blueskyDisconnect(props.model.account.id);
    state.value = State.NotConnected;
}
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
                <p>
                    Finish connecting to your Bluesky account in your browser.
                </p>
                <p>
                    <button class="btn btn-secondary" type="button" @click="disconnectClicked">
                        Cancel
                    </button>
                </p>
            </template>
            <template v-else-if="state == State.Connected">
                <p>You are connected.</p>
                <button class="btn btn-secondary" type="button" @click="disconnectClicked">
                    Disconnect
                </button>
            </template>
        </div>
    </div>
</template>

<style scoped></style>