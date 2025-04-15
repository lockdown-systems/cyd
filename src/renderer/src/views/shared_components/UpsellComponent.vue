<script setup lang="ts">
import { IpcRendererEvent } from 'electron';
import { ref, Ref, inject, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { openURL } from '../../util';
import type { DeviceInfo } from '../../types';
import CydAPIClient from '../../../../cyd-api-client';
import { UserPremiumAPIResponse } from "../../../../cyd-api-client";

const apiClient = inject('apiClient') as Ref<CydAPIClient>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// User variables
const userAuthenticated = ref(false);
const userPremium = ref(false);
const userHasBusinessSubscription = ref(false);

const signInClicked = async () => {
    emitter?.emit('show-sign-in');
};

const premiumClicked = async () => {
    if (!userAuthenticated.value) {
        emitter?.emit('show-sign-in');
        return;
    }
    emitter?.emit('show-manage-account')
}

const teamsClicked = async () => {
    if (!userAuthenticated.value) {
        emitter?.emit('show-sign-in');
        return;
    }
    emitter?.emit('show-manage-account-teams')
}

const donateClicked = () => {
    openURL('https://opencollective.com/lockdown-systems');
}

const refreshPremium = async () => {
    // Check if the user is authenticated
    userAuthenticated.value = await apiClient.value.ping() && deviceInfo.value?.valid ? true : false;

    // Check if the user has premium access
    if (userAuthenticated.value) {
        let userPremiumResp: UserPremiumAPIResponse;
        const resp = await apiClient.value.getUserPremium();
        if (resp && 'error' in resp === false) {
            userPremiumResp = resp;
            userPremium.value = userPremiumResp.premium_access;
            userHasBusinessSubscription.value = userPremiumResp.has_business_subscription;
        } else {
            console.error(`Error getting user premium status: ${resp}`);
            userPremium.value = false;
        }
    } else {
        userPremium.value = false;
    }
}

const cydOpenEventName = 'cydOpen';
const isLoading = ref(false);

onMounted(async () => {
    isLoading.value = true;
    await refreshPremium();
    isLoading.value = false;

    emitter?.on('signed-in', refreshPremium);
    emitter?.on('signed-out', refreshPremium);

    // If the user clicks "Open Cyd" from the Cyd dashboard website, it should open Cyd and refresh premium here
    window.electron.ipcRenderer.on(cydOpenEventName, async (_event: IpcRendererEvent, _queryString: string) => {
        await refreshPremium();
    });
});

onUnmounted(async () => {
    window.electron.ipcRenderer.removeAllListeners(cydOpenEventName);
});
</script>

<template>
    <div v-if="!isLoading" class="upsell">
        <div v-if="userPremium">
            <h1 class="text-center">
                Thanks for supporting <img src="/assets/wordmark.svg" class="cyd-wordmark" alt="Cyd">!
            </h1>
            <p class="text-center text-muted mb-0">
                <template v-if="userHasBusinessSubscription">
                    Cyd is an open source app made by a worker-owned collective. Thanks for using a Premium plan. If
                    you'd like to support us even more, <a href="#" @click="donateClicked">we accept donations</a>.
                </template>
                <template v-else>
                    Cyd is an open source app made by a worker-owned collective. Thanks for using a Premium plan! Would
                    Cyd would be useful for your team? Check out <a href="#"
                        @click="openURL('https://docs.cyd.social/docs/cyd-for-teams/intro')">Cyd for Teams</a>. And if
                    you'd like to support us even more, <a href="#" @click="donateClicked">we accept donations</a>.
                </template>
            </p>
        </div>
        <div v-else>
            <div class="container">
                <div class="row">
                    <div class="col-md-4 flex justify-between items-center">
                        <h1 class="text-center text-nowrap">
                            Support <img src="/assets/wordmark.svg" class="cyd-wordmark" alt="Cyd">!
                        </h1>
                    </div>
                    <div class="col-md-8 flex align-items-start">
                        <p class="text-center text-muted small">
                            Cyd is an open source app made by a worker-owned collective. You can support us by upgrading
                            to Premium or <a href="#" @click="donateClicked">donating</a>.
                        </p>
                    </div>
                </div>
            </div>

            <div class="container">
                <div class="row">
                    <div class="col-md-5 upsell-col">
                        <div class="card premium-card text-center" @click="premiumClicked">
                            <div class="card-header">
                                Upgrade to Premium
                            </div>
                            <div class="card-body small">
                                <p>Unlock features like deleting DMs and migrating to Bluesky</p>
                                <p class="fw-bold text-center mb-0">
                                    <template v-if="!userAuthenticated">
                                        Sign in to start
                                    </template>
                                    <template v-else>
                                        Upgrade to Premium
                                    </template>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-5 upsell-col">
                        <div class="card text-center" @click="teamsClicked">
                            <div class="card-header">
                                Cyd for Teams
                            </div>
                            <div class="card-body small">
                                <p>Get Cyd Premium for everyone at your organization or company</p>
                                <p class="fw-bold text-center mb-0">
                                    <template v-if="!userAuthenticated">
                                        Sign in to start
                                    </template>
                                    <template v-else>
                                        Start a Team
                                    </template>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.upsell {
    margin: 0.2em;
    padding: 1em;
    border: 1px solid #e6e6e6;
    border-radius: 0.5em;
}

.upsell-col {
    flex: 1;
    flex-direction: column;
    padding-left: calc(var(--bs-gutter-x)* .1);
    padding-right: calc(var(--bs-gutter-x)* .1);
}

.upsell .cyd-wordmark {
    height: 1em;
}

.upsell .card {
    border-radius: 0.5rem;
    cursor: pointer;
}

.upsell .card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.upsell .card-header {
    padding: 0.2em;
    font-weight: bold;
}

.upsell .card-body {
    padding: 0.5em 0.7em;
    text-align: left;
}

.upsell a {
    color: #000000;
    text-decoration: underline;
}
</style>
