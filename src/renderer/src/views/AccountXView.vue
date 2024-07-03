<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Electron from 'electron';

import AccountHeader from '../components/AccountHeader.vue';
import SpeechBubble from '../components/SpeechBubble.vue';
import type { Account } from '../../../shared_types';

import { AccountXViewModel } from '../view_models/AccountXViewModel'

const props = defineProps<{
    account: Account;
}>();

const accountXViewModel = ref<AccountXViewModel | null>(null);

const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);
const isWebviewMounted = ref(true);


onMounted(async () => {
    if (webviewComponent.value !== null) {
        const webview = webviewComponent.value;

        if (props.account.xAccount !== null) {
            accountXViewModel.value = new AccountXViewModel(props.account, webview);
            await accountXViewModel.value.init();

            // eslint-disable-next-line no-constant-condition
            while (isWebviewMounted.value) {
                // TODO: catch exceptions
                await accountXViewModel.value.run();

                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    } else {
        console.error('Webview component not found');
    }
});

onUnmounted(() => {
    isWebviewMounted.value = false;
});
</script>

<template>
    <div class="wrapper d-flex flex-column">
        <AccountHeader :account="account" />
        <SpeechBubble ref="speechBubbleComponent" :message="accountXViewModel?.instructions || ''"
            class="speech-bubble" />
        <webview ref="webviewComponent" src="about:blank" class="webview" :partition="`persist:x-${account.id}`"
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