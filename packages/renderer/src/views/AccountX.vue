<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router';
import Electron from 'electron';

import SpeechBubble from '../components/SpeechBubble.vue';

import { AccountXViewModel } from '../view_models/AccountXViewModel'

const route = useRoute();
const accountID = Number(route.params.id);

const showBack = inject('showBack') as (text: string, navigation: string) => void;

const accountXViewModel = ref<AccountXViewModel | null>(null);

const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);

const loadXAccount = async (): Promise<XAccount | null> => {
    let foundAccount: XAccount | null = null;
    const xAccounts = await (window as any).electron.getXAccounts();
    for (const account of xAccounts) {
        if (account.id === accountID) {
            foundAccount = account;
            break;
        }
    }
    return foundAccount;
}

onMounted(async () => {
    showBack('Your accounts', '/dashboard');
    const account = await loadXAccount();

    if (account !== null && webviewComponent.value !== null) {
        accountXViewModel.value = new AccountXViewModel(account, webviewComponent.value);
        await accountXViewModel.value.waitForWebviewReady();
        // TODO: catch exceptions
        await accountXViewModel.value.run();
    }
});

onUnmounted(() => {
});
</script>

<template>
    <div class="wrapper d-flex flex-column">
        <SpeechBubble ref="speechBubbleComponent" :message="accountXViewModel?.instructions || ''"
            class="speech-bubble" />
        <webview ref="webviewComponent" src="about:blank" class="webview"
            :class="{ 'hidden': !accountXViewModel?.showBrowser }">
        </webview>
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