<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const instructionsText = ref("");

const router = useRouter()

const goBack = async () => {
    router.push('/')
};

onMounted(async () => {
    const webview = document.querySelector('webview')

    webview.addEventListener('did-start-loading', () => {
        instructionsText.value = "Loading content..."
    })
    webview.addEventListener('did-stop-loading', () => {
        instructionsText.value = "Finished loading"
    })

    window.setTimeout(() => {
        console.log("loading micahflee.com")
        webview.loadURL("https://micahflee.com")
        webview.addEventListener('dom-ready', async () => {
            console.log("page loaded, executing javascript")
            await webview.executeJavaScript('() => { document.body.style.backgroundColor = "red"; return "red"; }')
        })
    }, 1);
});
</script>

<template>
    <div class="p-2 d-flex flex-column h-100">
        <div class="top-content pb-2">
            <div class="top-row pb-2 col d-flex justify-content-between">
                <button class="btn btn-secondary" @click="goBack">
                    <i class="bi bi-arrow-left"></i> Back
                </button>
            </div>
            <div class="instructions d-flex">
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
            <!-- TODO: add appropriate tags https://www.electronjs.org/docs/latest/api/webview-tag -->
            <webview id="webview" src="about:blank">
            </webview>
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