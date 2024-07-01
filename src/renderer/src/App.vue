<script setup lang="ts">
import { ref, provide, onMounted } from "vue"

import type { DeviceInfo } from './types';
import ServerAPI from './ServerAPI';
import { getDeviceInfo } from './helpers';

import SettingsModal from './modals/SettingsModal.vue';

import SignInView from "./views/SignInView.vue";
import TabsView from "./views/TabsView.vue";

// Application state
const isFirstLoad = ref(true);
const isSignedIn = ref(false);

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
    window.electron.showError("Failed to get saved device info.");
  }
};
provide('refreshDeviceInfo', refreshDeviceInfo);

// User info
const userEmail = ref('');
provide('userEmail', userEmail);

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
    isSignedIn.value = true;
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
      <template v-else-if="!isSignedIn">
        <SignInView @on-sign-in="isSignedIn = true" />
      </template>
      <template v-else>
        <TabsView @on-sign-off="isSignedIn = false" />
      </template>
    </div>

    <!-- Settings modal -->
    <SettingsModal v-if="showSettingsModal" @hide="showSettingsModal = false" @close="showSettingsModal = false" />
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

/* Modal styles */

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

.modal-dialog {
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 0 auto;
}

.modal-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.modal-body {
  overflow-y: auto;
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
