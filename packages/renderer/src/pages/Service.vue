<script setup lang="ts">
import { Ref, ref, onMounted, onUnmounted, inject } from "vue"
import { useRouter, useRoute } from 'vue-router';

import { Service, ServiceType } from "../models";

const showError = inject('showError') as (message: string) => void;
const services = inject('services') as Ref<Array<Service>>;

const router = useRouter()
const route = useRoute()

const service = ref<Service>();
const serviceType = ref<ServiceType>();
const serviceName = ref("")
const serviceUsername = ref("")

const instructionsDisplay = ref(false);
const instructionsText = ref("");

// const showInstructions = (message: string) => {
//     instructionsDisplay.value = true;
//     instructionsText.value = message;
// }

const hideInstructions = () => {
    instructionsDisplay.value = false;
    instructionsText.value = "";
}

const goBack = async () => {
    router.push('/')
};

onMounted(async () => {
    // Hide the instructions to start with
    hideInstructions();

    // Get the service
    const serviceId = route.params.id;
    service.value = services.value.find(s => s.id === serviceId);
    if (service.value) {
        serviceType.value = service.value.serviceType;
        serviceName.value = service.value.serviceType;
        serviceUsername.value = service.value.username != "" ? service.value.username : "not logged in yet";
    } else {
        showError(`Service not found.`);
        router.push("/")
        return
    }
});

onUnmounted(() => {
});
</script>

<template>
    <div class="p-2 d-flex flex-column h-100">
        <div class="top-content pb-2">
            <div class="top-row pb-2 col d-flex justify-content-between">
                <button class="btn btn-secondary" @click="goBack">
                    <i class="bi bi-arrow-left"></i> Back
                </button>
                <div class="service-name">
                    {{ serviceName }}
                </div>
                <div class="service-username">
                    {{ serviceUsername }}
                </div>
            </div>
            <div class="instructions d-flex" v-if="instructionsDisplay">
                <div class="logo">
                    <img src="/logo.png" alt="Logo" />
                </div>
                <div class="speech-bubble-left">
                    <div class="speech-bubble-left-inner-top"></div>
                    <div class="speech-bubble-left-inner-bottom"></div>
                </div>
                <div class="message flex-grow-1">
                    <p>{{ instructionsText }}</p>
                </div>
            </div>
        </div>
        <div class="webview-container flex-grow-1">
            <div id="webview">
                <p class="pt-5">this is where the webview will be</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
.top-row .service-name {
    font-weight: bold;
}

.top-row .service-username {
    font-style: italic;
    color: #666;
}

.instructions .logo img {
    margin-top: 14px;
    width: 60px;
    height: 60px;
}

.instructions .speech-bubble-left {
    width: 1em;
    background-color: #367f98;
}

.instructions .speech-bubble-left-inner-top {
    width: 1em;
    height: 2em;
    background-color: #ffffff;
    border-bottom-right-radius: 1em;
}

.instructions .speech-bubble-left-inner-bottom {
    width: 1em;
    height: calc(100% - 2em);
    background-color: #ffffff;
    border-top-right-radius: 1em;
}

.instructions .message {
    background-color: #367f98;
    color: #ffffff;
    border-radius: 1em;
}

.instructions .message p {
    margin: 0.5em 0.8em;
}

#webview {
    color: #666;
    background-color: #333;
    width: 100%;
    height: 100%;
    text-align: center;
}
</style>