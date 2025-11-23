<script setup lang="ts">
import { IpcRendererEvent } from "electron";
import { ref, provide, onMounted, onUnmounted, getCurrentInstance } from "vue";
import { useI18n } from "vue-i18n";
import semver from "semver";

import { DeviceInfo, PlausibleEvents } from "./types";
import { getDeviceInfo, openURL } from "./util";
import CydAPIClient, {
  APIErrorResponse,
  GetVersionAPIResponse,
} from "../../cyd-api-client";

const { t } = useI18n();

import SignInModal from "./modals/SignInModal.vue";
import AutomationErrorReportModal from "./modals/AutomationErrorReportModal.vue";
import AdvancedSettingsModal from "./modals/AdvancedSettingsModal.vue";

import TabsView from "./views/TabsView.vue";

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Application state
const isReady = ref(false);
const isFirstLoad = ref(true);
const isSignedIn = ref(false);

// API client
const apiClient = ref(new CydAPIClient());
provide("apiClient", apiClient);

// Device info
const deviceInfo = ref<DeviceInfo | null>(null);
provide("deviceInfo", deviceInfo);

const refreshDeviceInfo = async () => {
  try {
    deviceInfo.value = await getDeviceInfo();
    if (deviceInfo.value) {
      userEmail.value = deviceInfo.value.userEmail;
      apiClient.value.setUserEmail(deviceInfo.value.userEmail);
      await apiClient.value.setDeviceToken(deviceInfo.value.deviceToken);
    }
  } catch {
    window.electron.showError(t("app.error.failedToGetDeviceInfo"));
  }
};
provide("refreshDeviceInfo", refreshDeviceInfo);

// Refresh API client
const refreshAPIClient = async () => {
  if (!apiClient.value) {
    apiClient.value = new CydAPIClient();
  }
  apiClient.value.initialize(await window.electron.getAPIURL());
  await refreshDeviceInfo();
};
provide("refreshAPIClient", refreshAPIClient);

// User info
const userEmail = ref("");
provide("userEmail", userEmail);

// For advanced option to delete all settings and restart the app, before we do this we need to kill all of the
// potential webviews by hiding the TabsView component
const shouldHideTabsView = ref(false);
emitter?.on("delete-all-settings-and-restart", async () => {
  shouldHideTabsView.value = true;
});

// Modals!

// Sign in modal
const showSignInModal = ref(false);
emitter?.on("show-sign-in", () => {
  showSignInModal.value = true;
});

// Automation error report modal
const showAutomationErrorReportModal = ref(false);
emitter?.on("show-automation-error", (accountID: number) => {
  localStorage.setItem("automationErrorAccountID", accountID.toString());
  showAutomationErrorReportModal.value = true;
});

// Advanced settings modal
const showAdvancedSettingsModal = ref(false);
emitter?.on("show-advanced-settings", () => {
  showAdvancedSettingsModal.value = true;
});

// Track whether a user is actively using Cyd
const updateUserActivity = async () => {
  if (isSignedIn.value) {
    try {
      await apiClient.value.postUserActivity();
    } catch (error) {
      console.error("Failed to update user activity:", error);
    }
  }
};

// Update user activity periodically (every 6 hours)
let userActivityInterval: ReturnType<typeof setTimeout> | null = null;

const startUserActivityInterval = () => {
  if (userActivityInterval) {
    clearInterval(userActivityInterval);
  }
  // Update every 6 hours (6 * 60 * 60 * 1000 = 21600000 ms)
  userActivityInterval = setInterval(updateUserActivity, 21600000);
};

// Stop the interval when signing out
emitter?.on("signed-out", () => {
  if (userActivityInterval) {
    clearInterval(userActivityInterval);
    userActivityInterval = null;
  }
});

// Check for updates
enum UpdateStatus {
  Unknown,
  Error,
  Checking,
  Available,
  NotAvailable,
  Downloaded,
}

const updatesAvailable = ref(false);
const updateStatus = ref(UpdateStatus.Unknown);
let checkForUpdatesInterval: ReturnType<typeof setTimeout> | null = null;

const checkForUpdates = async (shouldAlert: boolean = false) => {
  console.log("checkForUpdates", "checking for updates");
  const currentVersion = await window.electron.getVersion();
  const resp = await apiClient.value.getVersion();
  if (resp && "error" in (resp as APIErrorResponse) === false) {
    const latestVersion = (resp as GetVersionAPIResponse).version;
    if (semver.gt(latestVersion, currentVersion)) {
      console.log(
        "checkForUpdates",
        `updates available, currentVersion=${currentVersion}, latestVersion=${latestVersion}`,
      );
      updatesAvailable.value = true;

      // Tell the main process to check for updates
      await window.electron.checkForUpdates();

      if (shouldAlert) {
        await window.electron.showMessage(
          t("app.updates.updateAvailableTitle"),
          t("app.updates.updateAvailableMessage", {
            currentVersion,
            latestVersion,
          }),
        );
      }
    } else {
      console.log("checkForUpdates", "no updates available", currentVersion);
      updatesAvailable.value = false;

      if (shouldAlert) {
        await window.electron.showMessage(
          t("app.updates.noUpdatesAvailableTitle"),
          t("app.updates.noUpdatesAvailableMessage", {
            currentVersion,
          }),
        );
      }
    }
  } else {
    console.log("checkForUpdates", "error checking for updates", resp);
    if (shouldAlert) {
      await window.electron.showError(t("app.error.failedToCheckUpdates"));
    }
  }
};

const restartToUpdateClicked = async () => {
  await window.electron.quitAndInstallUpdate();
};

// Update status events
const cydAutoUpdaterErrorEventName = "cydAutoUpdaterError";
const cydAutoUpdaterCheckingForUpdatesEventName =
  "cydAutoUpdaterCheckingForUpdates";
const cydAutoUpdaterUpdateAvailableEventName = "cydAutoUpdaterUpdateAvailable";
const cydAutoUpdaterUpdateNotAvailableEventName =
  "cydAutoUpdaterUpdateNotAvailable";
const cydAutoUpdaterUpdateDownloadedEventName =
  "cydAutoUpdaterUpdateDownloaded";

const platform = ref("");

onMounted(async () => {
  await window.electron.trackEvent(
    PlausibleEvents.APP_OPENED,
    navigator.userAgent,
  );

  apiClient.value.initialize(await window.electron.getAPIURL());

  platform.value = await window.electron.getPlatform();

  await refreshDeviceInfo();
  isFirstLoad.value = false;

  // Already logged in?
  if (deviceInfo.value?.valid) {
    isSignedIn.value = true;
  }

  // If logged in, update the server with user activity (gets truncated to day)
  if (isSignedIn.value) {
    await updateUserActivity();
    startUserActivityInterval();
  }

  isReady.value = true;

  // Change the app title
  const mode = await window.electron.getMode();
  if (mode === "prod") {
    document.title = "Cyd";
  } else {
    document.title = `Cyd (${mode})`;
  }

  // Check for updates
  await checkForUpdates();
  checkForUpdatesInterval = setInterval(checkForUpdates, 1000 * 60 * 60); // every 60 minutes

  // If the user clicks "Open Cyd" from the Cyd dashboard website, it should open Cyd and refresh premium here
  window.electron.ipcRenderer.on(
    cydAutoUpdaterErrorEventName,
    async (_event: IpcRendererEvent, _queryString: string) => {
      updateStatus.value = UpdateStatus.Error;
    },
  );
  window.electron.ipcRenderer.on(
    cydAutoUpdaterCheckingForUpdatesEventName,
    async (_event: IpcRendererEvent, _queryString: string) => {
      updateStatus.value = UpdateStatus.Checking;
    },
  );
  window.electron.ipcRenderer.on(
    cydAutoUpdaterUpdateAvailableEventName,
    async (_event: IpcRendererEvent, _queryString: string) => {
      updateStatus.value = UpdateStatus.Available;
    },
  );
  window.electron.ipcRenderer.on(
    cydAutoUpdaterUpdateNotAvailableEventName,
    async (_event: IpcRendererEvent, _queryString: string) => {
      updateStatus.value = UpdateStatus.NotAvailable;
    },
  );
  window.electron.ipcRenderer.on(
    cydAutoUpdaterUpdateDownloadedEventName,
    async (_event: IpcRendererEvent, _queryString: string) => {
      updateStatus.value = UpdateStatus.Downloaded;
    },
  );
});

onUnmounted(() => {
  // Cleanup the update status events
  window.electron.ipcRenderer.removeAllListeners(cydAutoUpdaterErrorEventName);
  window.electron.ipcRenderer.removeAllListeners(
    cydAutoUpdaterCheckingForUpdatesEventName,
  );
  window.electron.ipcRenderer.removeAllListeners(
    cydAutoUpdaterUpdateAvailableEventName,
  );
  window.electron.ipcRenderer.removeAllListeners(
    cydAutoUpdaterUpdateNotAvailableEventName,
  );
  window.electron.ipcRenderer.removeAllListeners(
    cydAutoUpdaterUpdateDownloadedEventName,
  );

  // Cleanup check for updates interval
  if (checkForUpdatesInterval) {
    clearInterval(checkForUpdatesInterval);
    checkForUpdatesInterval = null;
  }

  // Cleanup user activity interval started during mount
  if (userActivityInterval) {
    clearInterval(userActivityInterval);
    userActivityInterval = null;
  }
});
</script>

<template>
  <div class="d-flex flex-column vh-100">
    <template v-if="!isReady">
      <div class="flex-grow-1">
        <div class="container p-2 h-100">
          <div class="d-flex align-items-center h-100">
            <div class="w-100">
              <div class="text-center">
                <img
                  src="/assets/cyd-plain.svg"
                  class="cyd-avatar mb-3"
                  alt="Cyd Avatar"
                />
              </div>
              <p class="lead text-muted text-center">
                Automatically delete your old posts, except the ones you want to
                keep.
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <TabsView
        v-if="!shouldHideTabsView"
        :updates-available="updatesAvailable"
        @check-for-updates-clicked="checkForUpdates(true)"
      />

      <div v-if="updatesAvailable" class="updates-bar">
        <p>
          <strong>{{ t('app.updates.updateAvailable') }}</strong> {{ t('app.updates.shouldUseLatestVersion') }}
        </p>
        <p class="text-muted">
          <template v-if="platform === 'linux'">
            {{ t('app.updates.installViaPackageManager') }}
          </template>
          <template v-else>
            <template v-if="updateStatus == UpdateStatus.Checking">
              {{ t('app.updates.loadingUpdateStatus') }}
            </template>
            <template v-else-if="updateStatus == UpdateStatus.Available">
              {{ t('app.updates.downloadingUpdate') }}
            </template>
            <template v-else-if="updateStatus == UpdateStatus.Downloaded">
              <button class="btn btn-primary" @click="restartToUpdateClicked">
                {{ t('app.updates.restartToUpdate') }}
              </button>
            </template>
            <template
              v-else-if="
                updateStatus == UpdateStatus.Error ||
                updateStatus == UpdateStatus.NotAvailable
              "
            >
              {{ t('app.updates.errorWithAutomaticUpdate') }}
              <a href="#" @click="openURL('https://cyd.social/download/')"
                >{{ t('app.updates.fromWebsite') }}</a
              >.
            </template>
          </template>
        </p>
      </div>
    </template>

    <!-- Sign in modal -->
    <SignInModal
      v-if="showSignInModal"
      @hide="showSignInModal = false"
      @close="showSignInModal = false"
    />

    <!-- Automation error report modal -->
    <AutomationErrorReportModal
      v-if="showAutomationErrorReportModal"
      @hide="showAutomationErrorReportModal = false"
      @close="showAutomationErrorReportModal = false"
    />

    <!-- Advanced settings modal -->
    <AdvancedSettingsModal
      v-if="showAdvancedSettingsModal"
      @hide="showAdvancedSettingsModal = false"
      @close="showAdvancedSettingsModal = false"
    />
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

.cyd-avatar {
  width: 130px;
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
  z-index: 1000;
}

/* Updates style */

.updates-bar {
  z-index: 100;
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 10px 20px;
  border: 1px solid #ffc56e;
  border-radius: 1em;
  background-color: #ffe289;
  color: #000;
  font-size: 0.9em;
  text-align: right;
}

.updates-bar p {
  margin: 0;
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
  margin: 1rem auto;
}

.modal-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.modal-body {
  overflow-y: auto;
}

@media (min-width: 820px) {
  .modal-lg,
  .modal-xl {
    --bs-modal-width: 700px;
  }
}

@media (min-width: 992px) {
  .modal-lg,
  .modal-xl {
    --bs-modal-width: 800px;
  }
}

/* Webview styles */

.automation-notice {
  font-size: 0.7em;
  padding: 0.3em 0.5em 0.5em 0.5em;
  background-color: #ffea9b;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.ready-for-input {
  font-size: 0.8em;
  padding: 0.3em 0.5em 0.5em 0.5em;
  background-color: #c1fac4;
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.wrapper {
  height: calc(100vh - 10px);
}

.webview {
  height: 100vh;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.webview-automation-border {
  border: 5px solid #ffea9b;
  pointer-events: none;
  opacity: 0.7;
}

.webview-automation-border.webview-clickable {
  opacity: 1;
  pointer-events: auto;
}

.webview-input-border {
  border: 5px solid #c1fac4;
}

/* Wizard styles */

.wizard {
  flex: 1;
  overflow: auto;
}

.wizard-container {
  display: flex;
  height: 100%;
}

.wizard-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.wizard-scroll-content {
  flex: 1 1 0;
  overflow-y: auto;
  min-height: 0;
  padding: 0 1rem;
}

.wizard-sidebar {
  min-width: 150px;
  flex-basis: 150px;
  overflow-y: auto;
  flex-shrink: 0;
}

.wizard-sidebar .stats .card-header {
  font-size: 0.8rem;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wizard-sidebar .stats .card-body {
  padding: 0.7rem 0.2rem;
  font-size: 1.5em;
  margin-bottom: 0;
}

.wizard-review ul {
  list-style-type: circle;
  padding-left: 2.5rem;
}

.wizard-review ul ul {
  list-style-type: circle;
  padding-left: 1.5rem;
}

.option-card {
  cursor: pointer;
}

.option-card.selected {
  background-color: #f0f0f0;
}

/* Run Jobs styles */

.run-jobs-state {
  flex: 1;
  overflow: auto;
}

.run-jobs-state-container {
  display: flex;
  height: 100%;
}

.run-jobs-state-content {
  flex-grow: 1;
  overflow-y: auto;
  min-width: 0;
}

/* Finished wizard page */

.finished .delete-bullet {
  color: rgb(218, 82, 41);
  margin-right: 5px;
}

.finished .archive-bullet {
  color: rgb(50, 164, 164);
  margin-right: 5px;
}

.finished .bluesky-bullet {
  color: #0091ff;
  margin-right: 5px;
}

.finished .finished ul,
.finished .finished ul,
.finished .finished ul {
  list-style-type: none;
  padding-left: 0;
  margin-left: 1.5em;
}

.finished .finished li,
.finished .finished li,
.finished .finished li {
  margin-bottom: 0.2rem;
}

/* Misc */

.hidden {
  display: none;
}

.indent {
  margin-left: 1.5rem;
}

.no-wrap {
  white-space: nowrap;
}

.full-width {
  width: 100%;
}

.premium {
  text-transform: uppercase;
  font-size: 0.7rem;
  margin-left: 1rem;
  padding: 0.2em 0.5em;
  background-color: #50a4ff;
  color: white;
  border-radius: 0.25rem;
}

.alpha {
  text-transform: uppercase;
  font-size: 0.7rem;
  margin-left: 1rem;
  padding: 0.2em 0.5em;
  background-color: #e289ff;
  color: white;
  border-radius: 0.25rem;
}

.fa-heart {
  color: red;
}

.alert-details {
  margin-top: 0.25rem;
  font-size: 0.875em;
}

.alert {
  overflow: auto;
}

/* Headers */
h1 {
  font-size: 1.5rem;
}

h2 {
  font-size: 1.25rem;
}

h3 {
  font-size: 1.125rem;
  color: #666666;
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
