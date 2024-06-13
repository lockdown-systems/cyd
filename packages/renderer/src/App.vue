<script setup lang="ts">
import { ref, provide, onMounted } from "vue"
import { useRouter } from 'vue-router'

import ServerAPI from './ServerAPI';
import { getDeviceInfo } from './helpers';

import Header from './components/Header.vue';
import ErrorMessage from './modals/ErrorMessage.vue';
import Settings from './modals/Settings.vue';

const router = useRouter();

// Main content padding from the header
const mainContentEl = ref<HTMLElement | null>(null);
const adjustMainContentPadding = (headerHeight: number) => {
  if (mainContentEl.value) {
    mainContentEl.value.style.paddingTop = `${headerHeight}px`;
  }
};

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
const navigate = (path: string) => {
  router.push(path);
};
provide('navigate', navigate);

// Back button
const showBackButton = ref(false);
const backText = ref('');
const backNavigation = ref('');

const showBack = (text: string, navigation: string) => {
  backText.value = text;
  backNavigation.value = navigation;
  showBackButton.value = true;
};
provide('showBack', showBack);

const hideBack = () => {
  showBackButton.value = false;
};
provide('hideBack', hideBack);

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
    <Header :show-back-button="showBackButton" :back-text="backText" :back-navigation="backNavigation"
      :device-info="deviceInfo" @adjust-main-content="adjustMainContentPadding" />
    <div class="flex-grow-1 m-3" ref="mainContentEl">
      <RouterView />
    </div>

    <!-- Settings modal -->
    <Settings v-if="showSettingsModal" @hide="showSettingsModal = false" @close="showSettingsModal = false" />

    <!-- Error message modal -->
    <ErrorMessage v-if="showErrorModal" :message="errorMessage" @hide="showErrorModal = false"
      @close="showErrorModal = false" />
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
