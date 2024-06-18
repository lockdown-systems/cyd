<script setup lang="ts">
import { inject, Ref } from 'vue';

import ServerAPI from '../ServerAPI';
import type { DeviceInfo } from '../types';

const showError = inject('showError') as (message: string) => void;
const showSettings = inject('showSettings') as () => void;
const navigate = inject('navigate') as (path: string) => void;
const userEmail = inject('userEmail') as Ref<string>;
const serverApi = inject('serverApi') as Ref<ServerAPI>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;
const hideBack = inject('hideBack') as () => void;

const props = defineProps<{
  showBackButton: boolean;
  backText: string;
  backNavigation: string;
}>();

const settingsClicked = async () => {
  showSettings();
};

const signOutClicked = async () => {
  if (deviceInfo.value === null) {
    showError('Cannot sign out without device info');
    return;
  }

  // Delete the device
  const deleteDeviceResp = await serverApi.value.deleteDevice({
    // this API route takes either a UUID or a device token
    uuid: deviceInfo.value.deviceToken
  });
  if (deleteDeviceResp !== undefined && deleteDeviceResp.error) {
    console.log("Error deleting device", deleteDeviceResp.message)
  }

  // Sign out
  const logoutResp = await serverApi.value.logout();
  if ("error" in logoutResp && logoutResp.error) {
    console.log("Error logging out", logoutResp.message);
  }

  // Delete the device from the local storage
  await window.electron.setConfig("apiToken", "");
  await window.electron.setConfig("deviceToken", "");
  await window.electron.setConfig("deviceUUID", "");

  // Refresh the device info
  await refreshDeviceInfo();

  // Redirect to the login page
  backClicked();
  navigate('/');
};

const backClicked = () => {
  hideBack();
  navigate(props.backNavigation);
};
</script>

<template>
  <template v-if="userEmail != '' && deviceInfo?.valid">
    <div class="footer d-flex flex-md-row justify-content-between align-items-center p-2 bg-light"
      data-vue-ref="headerEl">
      <button v-if="showBackButton" class="btn btn-secondary btn-sm" @click="backClicked">
        <i class="fa-solid fa-circle-left" /> {{ backText }}
      </button>
      <div />
      <div class="d-flex align-items-center">
        <div class="mr-2">
          <i class="fa-regular fa-face-smile" />
          {{ userEmail }}
        </div>
        <div>
          <button class="btn btn-secondary btn-sm mr-2" @click="settingsClicked">
            <i class="fa-solid fa-gear" />
          </button>
          <button class="btn btn-secondary btn-sm" @click="signOutClicked">
            Sign out
          </button>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 1000;
}

a {
  text-decoration: none;
  color: #1a5568;
}
</style>