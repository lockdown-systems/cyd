<script setup lang="ts">
import { ref, provide, onMounted } from "vue"

import type { DeviceInfo } from './types';
import type { Account } from '../../shared_types';

import ServerAPI from './ServerAPI';
import { getDeviceInfo } from './helpers';

import SettingsModal from './modals/SettingsModal.vue';
import AccountSettingsModal from './modals/AccountSettingsModal.vue';

import TabsView from "./views/TabsView.vue";

// Application state
const isReady = ref(false);
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

// Account settings
const accountSettingsAccount = ref<Account | null>(null);
const showAccountSettingsModal = ref(false);
const showAccountSettings = (account: Account) => {
  accountSettingsAccount.value = account;
  showAccountSettingsModal.value = true;
};
provide('showAccountSettings', showAccountSettings);

const signOut = async () => {
  isSignedIn.value = false;
  isFirstLoad.value = true;
  serverApi.value = new ServerAPI();
  await serverApi.value.initialize();
  await refreshDeviceInfo();
  isFirstLoad.value = false;
};

onMounted(async () => {
  await serverApi.value.initialize();

  if (!await window.electron.archive.isChromiumExtracted()) {
    if (!await window.electron.archive.extractChromium()) {
      window.electron.showError('Failed to extract Chromium');
    }
  }

  await refreshDeviceInfo();
  isFirstLoad.value = false;

  // Already logged in?
  if (deviceInfo.value?.valid) {
    isSignedIn.value = true;
  }

  isReady.value = true;
});
</script>

<template>
  <div class="d-flex flex-column vh-100">
    <div class="flex-grow-1">
      <template v-if="!isReady">
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
      <template v-else>
        <TabsView @on-sign-out="signOut" />
      </template>
    </div>

    <!-- Settings modal -->
    <SettingsModal v-if="showSettingsModal" @hide="showSettingsModal = false" @close="showSettingsModal = false" />

    <!-- Account settings modal -->
    <AccountSettingsModal v-if="showAccountSettingsModal" :account="accountSettingsAccount"
      @hide="showAccountSettingsModal = false" @close="showAccountSettingsModal = false" />
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

/* Menu popups */

.menu-popup {
  position: absolute;
  background-color: #333333;
  color: #ffffff;
  border: 1px solid #111111;
  padding: 10px;
  border-radius: 4px;
  white-space: nowrap;
  z-index: 10;
}

.menu-popup ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.menu-popup ul li {
  padding: 3px 6px;
}

.menu-popup ul li.menu-text {
  color: #999999;
}

.menu-popup ul li.menu-line hr {
  margin: 5px 0;
}

.menu-popup ul li.menu-btn {
  cursor: pointer;
}

.menu-popup ul li.menu-btn:hover {
  background-color: #555555;
}

/* Buttons */

.btn-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.info-popup {
  position: absolute;
  background-color: #000000;
  color: #ffffff;
  padding: 3px 6px;
  border-radius: 4px;
  white-space: nowrap;
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

.modal-xl {
  max-width: 90%;
}

/* Webview styles */

.wrapper {
  height: calc(100vh - 10px);
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
