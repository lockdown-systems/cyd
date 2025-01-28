<script setup lang="ts">
import {
    AccountXViewModel
} from '../../view_models/AccountXViewModel'

// Props
defineProps<{
    model: AccountXViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();
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
                        <strong>Considering making a new Bluesky account just for your old tweets.</strong> This is a
                        good way to keep your old tweets separate from your new posts.
                    </p>
                    <p>
                        <strong>Not all of your tweets can be imported into Bluesky.</strong> Cyd will import tweets
                        that are not replies, and also tweets where you're replying to yourself, which will keep your
                        threads intact.
                    </p>
                </div>
            </div>

            <p>
                asdf
            </p>
        </div>
    </div>
</template>

<style scoped></style>