<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router';
import Electron from 'electron';

import SpeechBubble from '../components/SpeechBubble.vue';
import type { XAccount } from '../types';

import { AccountXViewModel } from '../view_models/AccountXViewModel'

const route = useRoute();
const accountID = Number(route.params.id);

const showBack = inject('showBack') as (text: string, navigation: string) => void;

const accountXViewModel = ref<AccountXViewModel | null>(null);

const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);

const loadXAccount = async (): Promise<XAccount | null> => {
    let foundAccount: XAccount | null = null;
    const xAccounts = await window.electron.getXAccounts();
    for (const account of xAccounts) {
        if (account.id === accountID) {
            foundAccount = account;
            break;
        }
    }
    return foundAccount;
}

onMounted(async () => {
    showBack('Your accounts', '/tabs');
    const account = await loadXAccount();

    if (webviewComponent.value !== null) {
        const webview = webviewComponent.value;

        if (account !== null) {
            accountXViewModel.value = new AccountXViewModel(account, webview);
            await accountXViewModel.value.init();

            // TODO: catch exceptions
            await accountXViewModel.value.run();
        } else {
            console.error('Account not found');
        }
    } else {
        console.error('Webview component not found');
    }
});

onUnmounted(() => {
});
</script>

<template>
    <div class="wrapper d-flex flex-column">
        <SpeechBubble ref="speechBubbleComponent" :message="accountXViewModel?.instructions || ''"
            class="speech-bubble" />
        <webview ref="webviewComponent" src="about:blank" class="webview" :partition="`persist:x-${accountID}`"
            :class="{ 'hidden': !accountXViewModel?.showBrowser }" />
    </div>
</template>

<style scoped>
.speech-bubble {
    padding-bottom: 10px;
}

.hidden {
    display: none;
}
</style>