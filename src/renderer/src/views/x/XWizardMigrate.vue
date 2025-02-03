<script setup lang="ts">
import { ref } from 'vue'
import {
    AccountXViewModel
} from '../../view_models/AccountXViewModel'

const blueskyUsername = ref('');

// Props
defineProps<{
    model: AccountXViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

const connectClicked = () => {
    console.log('Connect to Bluesky');
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

            <form @submit.prevent="connectClicked">
                <p>
                    To get started, connect your Bluesky account.
                </p>
                <div class="form-group">
                    <label for="username" class="sr-only">Bluesky Username</label>
                    <div class="input-group">
                        <input id="username" v-model="blueskyUsername" type="text" class="form-control"
                            placeholder="Bluesky Username" required>
                        <div class="input-group-append">
                            <button class="btn btn-primary" type="submit">
                                Connect
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>

<style scoped></style>