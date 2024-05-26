<script setup lang="ts">
import { ref, onMounted, provide } from "vue"
import ErrorMessage from './components/ErrorMessage.vue';

// API URL
const apiUrl = ref('');
provide('apiUrl', apiUrl);

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
  apiUrl.value = await (window as any).api.getApiUrl();
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