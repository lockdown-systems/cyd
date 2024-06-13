<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue';
import { useRoute } from 'vue-router';

import SpeechBubble from '../components/SpeechBubble.vue';

import { AccountXModel } from '../view_models/AccountXModel'

const route = useRoute();
const accountID = Number(route.params.id);

const showBack = inject('showBack') as (text: string, navigation: string) => void;
const headerHeight = inject('mainContentPadding') as Ref<number>;

const accountXModel = ref<AccountXModel | null>(null);

const containerEl = ref<HTMLElement | null>(null);
const speechBubbleComponent = ref<typeof SpeechBubble | null>(null);
const webviewComponent = ref<any>(null);

const webviewStyle = ref('');
const containerStyle = ref('height: calc(100vh - 0px)');

const loadXAccount = async () => {
    let foundAccount: XAccount | null = null;
    const xAccounts = await (window as any).electron.getXAccounts();
    for (const account of xAccounts) {
        if (account.id === accountID) {
            foundAccount = account;
            break;
        }
    }

    if (foundAccount !== null) {
        accountXModel.value = new AccountXModel(foundAccount);
    }
}

const updateHeights = () => {
    if (containerEl.value && speechBubbleComponent.value) {
        const diff = headerHeight.value + 20;
        containerStyle.value = `height: calc(100vh - ${diff}px)`;

        const containerHeight = containerEl.value.offsetHeight;
        const speechBubbleHeight = speechBubbleComponent.value.$el.offsetHeight;
        const webviewHeight = containerHeight - speechBubbleHeight - headerHeight.value - 30;
        webviewStyle.value = `height: ${webviewHeight}px;`;
    }
};

onMounted(async () => {
    showBack('Your accounts', '/dashboard');
    await loadXAccount();
    await accountXModel.value?.run();

    window.addEventListener('resize', updateHeights);
    setTimeout(updateHeights, 100);
});

onUnmounted(() => {
    window.removeEventListener('resize', updateHeights);
});
</script>

<template>
    <div ref="containerEl" class="d-flex flex-column" :style="containerStyle">
        <SpeechBubble ref="speechBubbleComponent" :message="accountXModel?.instructions || ''" class="speech-bubble" />
        <webview rel="webviewComponent" src="https://micahflee.com" class="webview" :style="webviewStyle">
        </webview>
    </div>
</template>

<style scoped>
.webview {
    border: 5px solid black;
}

.speech-bubble {
    padding-bottom: 10px;
}
</style>