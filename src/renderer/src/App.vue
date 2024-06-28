<script setup lang="ts">
import { ref, provide, onMounted } from "vue"

import type { DeviceInfo } from './types';
import ServerAPI from './ServerAPI';
import { getDeviceInfo } from './helpers';

import ErrorMessage from './modals/ErrorMessage.vue';
import SettingsModal from './modals/SettingsModal.vue';

import LoginView from "./views/LoginView.vue";
import TabsView from "./views/TabsView.vue";

// Application state
const isFirstLoad = ref(true);
const isLoggedIn = ref(false);

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
    showError("Failed to get saved device info.");
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

// Settings
const showSettingsModal = ref(false);
const showSettings = () => {
  showSettingsModal.value = true;
};
provide('showSettings', showSettings);

// Navigation
const navigate = (_path: string) => {
  // TODO: change how navigation works
  // router.push(path);
};
provide('navigate', navigate);

onMounted(async () => {
  await serverApi.value.initialize();
  await refreshDeviceInfo();
  isFirstLoad.value = false;

  // Already logged in?
  if (deviceInfo.value?.valid) {
    isLoggedIn.value = true;
  }
});
</script>

<template>
  <div class="d-flex flex-column vh-100">
    <div class="flex-grow-1">
      <template v-if="isFirstLoad">
        <div class="container p-2 h-100">
          <div class="d-flex align-items-center h-100">
            <div class="w-100">
              <div class="text-center">
                <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Bird" style="width: 120px;">
              </div>
              <p class="lead text-muted text-center">
                Automatically delete your old posts, except the ones you want to keep.
              </p>
            </div>
          </div>
        </div>
      </template>
      <template v-else-if="!isLoggedIn">
        <LoginView @login-success="isLoggedIn = true" />
      </template>
      <template v-else>
        <TabsView />
      </template>
    </div>

    <!-- Settings modal -->
    <SettingsModal v-if="showSettingsModal" @hide="showSettingsModal = false" @close="showSettingsModal = false" />

    <!-- Error message modal -->
    <ErrorMessage v-if="showErrorModal" :message="errorMessage" @hide="showErrorModal = false"
      @close="showErrorModal = false" />
  </div>
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

/* Webview styles */

.wrapper {
  height: calc(100vh - 80px);
}

.webview {
  border: 5px solid black;
  height: 100vh;
}

/* Headers */
h1 {
  font-size: 1.5rem;
}

h2 {
  font-size: 1.25rem;
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

.mb-3 {
  margin-bottom: 1rem;
}

.mt-5 {
  margin-top: 3rem;
}
</style>
