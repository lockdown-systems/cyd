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
        </div>
    </div>
</template>

<style scoped></style>