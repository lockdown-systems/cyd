<script setup lang="ts">
import { Ref, ref, onMounted, onUnmounted, inject } from 'vue'
import Electron from 'electron';
import type { DeviceInfo } from '../types';

const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;

const webviewComponent = ref<Electron.WebviewTag | null>(null);
const isWebviewMounted = ref(true);

onMounted(async () => {
    if (webviewComponent.value !== null) {
        const dashURL = await window.electron.getDashURL();
        const nativeLoginURL = `${dashURL}/#/native-login/${deviceInfo.value?.userEmail}/${deviceInfo.value?.deviceToken}`;

        const webview = webviewComponent.value;
        await webview.loadURL(nativeLoginURL);
    } else {
        console.error('Webview component not found');
    }
});

onUnmounted(async () => {
    isWebviewMounted.value = false;
});
</script>

<template>
    <div class="wrapper d-flex flex-column">
        <webview ref="webviewComponent" src="about:blank" class="webview-borderless mt-3"
            :partition="`persist:account-manage`" />
    </div>
</template>

<style scoped></style>