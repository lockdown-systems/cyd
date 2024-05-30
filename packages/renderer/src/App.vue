<script setup lang="ts">
import { ref, onMounted, provide } from "vue"

import ServerAPI from './ServerApi';
import ErrorMessage from './components/ErrorMessage.vue';

// API
const serverApi = ref<ServerAPI | null>(null);
provide('api', serverApi);

// Error messages
const showErrorModal = ref(false);
const errorMessage = ref('');

provide('showError', (message: string) => {
  errorMessage.value = message;
  showErrorModal.value = true;
});

provide('hideError', () => {
  errorMessage.value = '';
  showErrorModal.value = false;
});

onMounted(async () => {
  const apiUrl = await (window as any).electron.getApiUrl();
  if(apiUrl) {
    serverApi.value = new ServerAPI(apiUrl);
  } else {
    showErrorModal.value = true;
    errorMessage.value = 'Unable to get API URL. Please contact support.';
  }
});
</script>
<template>
  <RouterView />
  <ErrorMessage v-if="showErrorModal" :message="errorMessage" @close="showErrorModal = false" />
</template>

<style>
html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
}

#app {
  height: 100%;
}

.modal-backdrop.show {
  display: none;
}

.modal.show {
  display: block;
  background-color: rgba(0, 0, 0, 0.5);
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1050;
}
</style>