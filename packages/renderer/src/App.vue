<script setup lang="ts">
import { ref, provide, onMounted } from "vue"
import { useRouter } from 'vue-router'

import ServerAPI from './ServerApi';
import { getDeviceInfo } from './helpers';

import Header from './components/Header.vue';
import ErrorMessage from './components/ErrorMessage.vue';

const router = useRouter();

// Server API
const serverApi = ref(new ServerAPI());
provide('serverApi', serverApi);

// Device info
const deviceInfo = ref<DeviceInfo | null>(null);
provide('deviceInfo', deviceInfo);

const refreshDeviceInfo = async () => {
  try {
    deviceInfo.value = await getDeviceInfo();
    if (deviceInfo.value) {
      userEmail.value = deviceInfo.value.userEmail;
      serverApi.value.setUserEmail(deviceInfo.value.userEmail);
      serverApi.value.setDeviceToken(deviceInfo.value.deviceToken);
    }
  } catch {
    showError("Failed to get device info. Please try again later.");
  }
};
provide('refreshDeviceInfo', refreshDeviceInfo);

// User info
const userEmail = ref('');
provide('userEmail', userEmail);

// Error messages
const showErrorModal = ref(false);
const errorMessage = ref('');

const showError = (message: string) => {
  errorMessage.value = message;
  showErrorModal.value = true;
};
provide('showError', showError);

const hideError = () => {
  errorMessage.value = '';
  showErrorModal.value = false;
};
provide('hideError', hideError);

onMounted(async () => {
  await serverApi.value.initialize();
  await refreshDeviceInfo();

  // Already logged in? Redirect to the dashboard
  if (deviceInfo.value?.valid) {
    router.push('/dashboard');
  }
});
</script>

<template>
  <div class="d-flex flex-column vh-100">
    <Header :device-info="deviceInfo" />
    <div class="flex-grow-1 m-2">
      <RouterView />
    </div>
    <ErrorMessage v-if="showErrorModal" :message="errorMessage" @close="showErrorModal = false" />
  </div>
</template>

<style scoped>
header .logo {
  max-height: 2.2rem;
}
</style>

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

/* Bootstrap style that for some reason aren't making it */
.mr-1 {
  margin-right: 0.25rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mr-3 {
  margin-right: 1rem;
}
</style>
