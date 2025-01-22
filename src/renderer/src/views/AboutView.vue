<script setup lang="ts">
import { ref, onMounted } from "vue";

const currentYear = new Date().getFullYear();
const appVersion = ref("");
const mode = ref("prod");

defineProps<{
    shouldShow: boolean;
}>();

const privacyClicked = async () => {
    await window.electron.openURL("https://cyd.social/privacy");
};

const termsClicked = async () => {
    await window.electron.openURL("https://cyd.social/terms");
};

onMounted(async () => {
    appVersion.value = await window.electron.getVersion();
    mode.value = await window.electron.getMode();
});
</script>

<template>
    <div v-if="shouldShow" class="d-flex flex-column justify-content-between vh-100">
        <div class="d-flex justify-content-center align-items-center flex-grow-1">
            <div class="text-center">
                <div>
                    <img src="/assets/cyd-tmkf.svg" alt="This Machine Kills Fascists" class="kills-fascists">
                </div>
            </div>
        </div>
        <div class="text-center">
            <p>
                Find a bug or need help? Email collective@lockdown.systems.
            </p>
            <p class="text-muted">
                <img src="/assets/wordmark.svg" class="cyd-wordmark mr-2" alt="Cyd">
                {{ mode != 'prod' ? 'Dev' : '' }}
                version {{ appVersion }}
            </p>
            <p class="text-muted">
                Copyright © Lockdown Systems LLC {{ currentYear }}
                <span class="btn btn-link" @click="privacyClicked">Privacy Policy</span>
                <span class="btn btn-link" @click="termsClicked">Terms of Use</span>
            </p>
        </div>
    </div>
</template>

<style scoped>
.kills-fascists {
    width: 350px;
}

.cyd-wordmark {
    height: 2em;
}
</style>