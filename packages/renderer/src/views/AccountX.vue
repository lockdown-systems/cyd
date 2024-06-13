<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue';
import { useRoute } from 'vue-router';
import Electron from 'electron';

import SpeechBubble from '../components/SpeechBubble.vue';

import { AccountXViewModel } from '../view_models/AccountXViewModel'

const route = useRoute();
const accountID = Number(route.params.id);

const showBack = inject('showBack') as (text: string, navigation: string) => void;
const headerHeight = inject('mainContentPadding') as Ref<number>;

const accountXViewModel = ref<AccountXViewModel | null>(null);

const containerEl = ref<HTMLElement | null>(null);
const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<Electron.WebviewTag | null>(null);

const webviewStyle = ref('');
const containerStyle = ref('height: calc(100vh - 0px)');

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

// const updateHeights = () => {
//     if (containerEl.value && speechBubbleComponent.value) {
//         const diff = headerHeight.value + 20;
//         containerStyle.value = `height: calc(100vh - ${diff}px)`;

//         const containerHeight = containerEl.value.offsetHeight;
//         const speechBubbleHeight = speechBubbleComponent.value.$el.offsetHeight;
//         const webviewHeight = containerHeight - speechBubbleHeight - headerHeight.value - 30;
//         webviewStyle.value = `height: ${webviewHeight}px;`;
//     }
// };

onMounted(async () => {
    showBack('Your accounts', '/dashboard');
    const account = await loadXAccount();

    if (account !== null && webviewComponent.value !== null) {
        accountXViewModel.value = new AccountXViewModel(account, webviewComponent.value);
        await accountXViewModel.value.waitForWebviewReady();
        // TODO: catch exceptions
        await accountXViewModel.value.run();
    }

    // window.addEventListener('resize', updateHeights);
    // setTimeout(updateHeights, 100);

    // :style="webviewStyle"
});

onUnmounted(() => {
    // window.removeEventListener('resize', updateHeights);
});
</script>

<template>
    <div ref="containerEl" class="d-flex flex-column" :style="containerStyle">
        <SpeechBubble ref="speechBubbleComponent" :message="accountXViewModel?.instructions || ''"
            class="speech-bubble" />
        <webview ref="webviewComponent" src="about:blank" class="webview"
            :class="{ 'hidden': !accountXViewModel?.showBrowser }">
        </webview>
    </div>
</template>

<style scoped>
.webview {
    border: 5px solid black;
    height: 100vh;
}

.speech-bubble {
    padding-bottom: 10px;
}

.hidden {
    display: none;
}
</style>