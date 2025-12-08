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
          <strong>{{ t("app.updates.updateAvailable") }}</strong>
          {{ t("app.updates.shouldUseLatestVersion") }}
        </p>
        <p class="text-muted">
          <template v-if="platform === 'linux'">
            {{ t("app.updates.installViaPackageManager") }}
          </template>
          <template v-else>
            <template v-if="updateStatus == UpdateStatus.Checking">
              {{ t("app.updates.loadingUpdateStatus") }}
            </template>
            <template v-else-if="updateStatus == UpdateStatus.Available">
              {{ t("app.updates.downloadingUpdate") }}
            </template>
            <template v-else-if="updateStatus == UpdateStatus.Downloaded">
              <button class="btn btn-primary" @click="restartToUpdateClicked">
                {{ t("app.updates.restartToUpdate") }}
              </button>
            </template>
            <template
              v-else-if="
                updateStatus == UpdateStatus.Error ||
                updateStatus == UpdateStatus.NotAvailable
              "
            >
              {{ t("app.updates.errorWithAutomaticUpdate") }}
              <a href="#" @click="openURL('https://cyd.social/download/')">{{
                t("app.updates.fromWebsite")
              }}</a
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
