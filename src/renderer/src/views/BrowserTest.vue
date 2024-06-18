<script setup lang="ts">
import { onMounted, ref, inject } from 'vue'
import Electron from 'electron';

const showBack = inject('showBack') as (text: string, navigation: string) => void;

const webviewComponent = ref<Electron.WebviewTag | null>(null);


onMounted(() => {
    showBack('Your accounts', '/dashboard');

    if (webviewComponent.value !== null) {
        const webview: Electron.WebviewTag = webviewComponent.value;
        webview.addEventListener('dom-ready', async () => {
            console.log('webview dom-ready');

            // Open devtools
            webview.openDevTools();

            // Inject javascript
            webview.executeJavaScript(`
                console.log('Hello from the webview');
            `);

            // Get the title of the webpage with javascript injection
            const result = await webview.executeJavaScript(`
                ( () => { return document.title; } )()
            `);
            console.log('Title:', result);
        });
    }
});
</script>

<template>
  <div class="wrapper d-flex flex-column">
    <webview
      ref="webviewComponent"
      src="https://example.com"
      class="webview"
    />
  </div>
</template>

<style scoped></style>