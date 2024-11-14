<script setup lang="ts">
import { Ref, ref, onMounted, onUnmounted, inject, watch } from 'vue'
import Electron from 'electron';
import type { DeviceInfo } from '../types';

const props = defineProps<{
    shouldShow: boolean;
}>();

const emit = defineEmits<{
    redirectToAccount: [accountID: number],
}>()

// Watch for changes in shouldShow
watch(() => props.shouldShow, async (newValue) => {
    if (newValue) {
        if (newValue) {
            console.log('ManageAccountView', 'shouldShow is true, loading dash...');
            await loadDash();
        } else {
            console.log('ManageAccountView', 'shouldShow is false, loading about:blank');
            await loadEmpty();
        }
        isWebviewMounted.value = true;
    }
});

const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;

const webviewComponent = ref<Electron.WebviewTag | null>(null);
const isWebviewMounted = ref(true);

const waitForWebview = async () => {
    while (webviewComponent.value === null) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
};

const loadEmpty = async () => {
    await waitForWebview();
    if (webviewComponent.value !== null) {
        const webview = webviewComponent.value;
        await webview.loadURL('about:blank');
    }
};

const loadDash = async () => {
    await waitForWebview();
    if (webviewComponent.value !== null) {
        const mode = localStorage.getItem('manageAccountMode');

        // Add event listener
        webviewComponent.value.addEventListener('load-commit', onLoadCommit);

        const dashURL = await window.electron.getDashURL();
        const nativeLoginURL = `${dashURL}/#/native-login/${deviceInfo.value?.userEmail}/${deviceInfo.value?.deviceToken}/${mode}`;
        console.log('ManageAccountView: Loading dash', mode, nativeLoginURL);

        const webview = webviewComponent.value;
        await webview.loadURL(nativeLoginURL);
    } else {
        console.error('Webview component not found');
    }
};

const onLoadCommit = async (event: Electron.LoadCommitEvent) => {
    const url = event.url;
    console.log("ManageAccountView: onLoadCommit", url)

    // Check for open receipt in external browser
    if (url.includes('/native-app-open-receipt/')) {
        console.log("ManageAccountView: intercepted receipt open")
        const hashIndex = url.indexOf('#/native-app-open-receipt/');
        if (hashIndex !== -1) {
            const receiptURLB64 = url.substring(hashIndex + '#/native-app-open-receipt/'.length);
            const receiptURL = atob(receiptURLB64);
            console.log("ManageAccountView: opening URL", receiptURL)
            await window.electron.openURL(receiptURL);
        } else {
            console.error("ManageAccountView: Invalid URL format")
        }
        loadDash();
    }

    // Check for redirect
    if (localStorage.getItem("manageAccountMode") == "premium") {
        if (url.includes('/native-app-premium-enabled')) {
            const accountID = localStorage.getItem('manageAccountRedirectAccountID');
            if (!accountID) {
                console.error('ManageAccountView: No account ID found in localStorage');
                loadDash();
                return;
            }
            const accountIDNumber = parseInt(accountID, 10);

            console.log('ManageAccountView: Redirecting to account', accountIDNumber);
            emit('redirectToAccount', accountIDNumber);

            // Remove event listener, and load about:blank
            if (webviewComponent.value !== null) {
                webviewComponent.value.removeEventListener('load-commit', onLoadCommit);
            }
            await webviewComponent.value?.loadURL('about:blank');
        }
    }
};

onMounted(async () => {
    await loadDash();
});

onUnmounted(async () => {
    isWebviewMounted.value = false;

    if (webviewComponent.value !== null) {
        webviewComponent.value.removeEventListener('load-commit', onLoadCommit);
    }
});
</script>

<template>
    <div v-if="shouldShow" class="wrapper d-flex flex-column">
        <webview ref="webviewComponent" src="about:blank" class="webview mt-3" :partition="`persist:account-manage`" />
    </div>
</template>

<style scoped></style>