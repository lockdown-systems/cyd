<script setup lang="ts">
import { IpcRendererEvent } from "electron";
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";

import type { BlueskyViewModel } from "../../../view_models/BlueskyViewModel";
import { State } from "../../../view_models/BlueskyViewModel";
import { getBreadcrumbIcon } from "../../../util";
import BaseWizardPage from "../../shared_components/wizard/BaseWizardPage.vue";

const { t } = useI18n();

const props = defineProps<{
  model: BlueskyViewModel;
}>();

const emit = defineEmits<{
  setState: [value: string];
}>();

/**
 * Connecting is a browser round trip, so this page has to describe three
 * moments: before it starts, while the person is in their browser, and after
 * the identity is bound. Disconnecting returns to the first without touching
 * the account or any Bluesky saved data.
 */
enum ConnectState {
  NotConnected,
  Connecting,
  FinishInBrowser,
  Connected,
}

const connectState = ref<ConnectState>(
  props.model.isConnected ? ConnectState.Connected : ConnectState.NotConnected,
);
const handle = ref("");

const profile = computed(() => props.model.profile);
const connectError = computed(() => props.model.connectError);

const connectButtonText = computed(() =>
  connectState.value === ConnectState.Connecting
    ? t("bluesky.connect.connecting")
    : t("bluesky.connect.connect"),
);

const connectClicked = async () => {
  connectState.value = ConnectState.Connecting;
  const started = await props.model.connect(handle.value);
  if (started.status === "reused") {
    // Cyd already held a session for this identity — authorized here before,
    // or through an X account's migration — so nothing opened in a browser.
    connectState.value = ConnectState.Connected;
  } else if (started.status === "browser") {
    connectState.value = ConnectState.FinishInBrowser;
  } else {
    connectState.value = ConnectState.NotConnected;
  }
};

const cancelClicked = () => {
  // Nothing was authorized yet, so there is no hold to release: the browser
  // tab is simply abandoned.
  connectState.value = ConnectState.NotConnected;
};

const disconnectClicked = async () => {
  await props.model.disconnect();
  connectState.value = ConnectState.NotConnected;
};

const oauthCallback = async (queryString: string) => {
  // The query string carries the OAuth authorization code, so it is never
  // logged.
  const connected = await props.model.completeConnection(queryString);
  connectState.value = connected
    ? ConnectState.Connected
    : ConnectState.NotConnected;
};

const callbackEventName = props.model.oauthCallbackEventName;

onMounted(async () => {
  // The listener goes up before anything is awaited: an authorization the
  // person finished while this page was loading must not be missed.
  window.electron.ipcRenderer.on(
    callbackEventName,
    async (_event: IpcRendererEvent, queryString: string) => {
      await oauthCallback(queryString);
    },
  );

  await props.model.refreshProfile();
  connectState.value = props.model.isConnected
    ? ConnectState.Connected
    : ConnectState.NotConnected;
});

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners(callbackEventName);
});
</script>

<template>
  <BaseWizardPage
    :breadcrumb-props="{
      buttons: [
        {
          label: t('bluesky.connect.dashboard'),
          action: () => emit('setState', State.BlueskyWizardDashboard),
          icon: getBreadcrumbIcon('dashboard'),
        },
      ],
      label: t('bluesky.connect.title'),
      icon: getBreadcrumbIcon('bluesky'),
    }"
    :button-props="{
      backButtons: [
        {
          label: t('bluesky.connect.backToDashboard'),
          action: () => emit('setState', State.BlueskyWizardDashboard),
        },
      ],
      nextButtons: [],
    }"
  >
    <template #content>
      <div class="wizard-scroll-content bluesky-connect">
        <h2>{{ t("bluesky.connect.title") }}</h2>
        <p class="text-muted">{{ t("bluesky.connect.description") }}</p>

        <div
          v-if="connectError"
          class="alert alert-danger connect-error"
          role="alert"
        >
          {{ connectError }}
        </div>

        <template
          v-if="
            connectState == ConnectState.NotConnected ||
            connectState == ConnectState.Connecting
          "
        >
          <form @submit.prevent="connectClicked">
            <div class="form-group">
              <label for="bluesky-handle" class="sr-only">
                {{ t("bluesky.connect.handle") }}
              </label>
              <div class="input-group">
                <input
                  id="bluesky-handle"
                  v-model="handle"
                  type="text"
                  class="form-control"
                  :placeholder="t('bluesky.connect.handlePlaceholder')"
                  required
                  :disabled="connectState !== ConnectState.NotConnected"
                />
                <div class="input-group-append">
                  <button
                    class="btn btn-primary"
                    type="submit"
                    :disabled="connectState !== ConnectState.NotConnected"
                  >
                    {{ connectButtonText }}
                  </button>
                </div>
              </div>
            </div>
          </form>
          <p class="small text-muted mt-3">
            {{ t("bluesky.connect.oauthOnly") }}
          </p>
        </template>

        <template v-else-if="connectState == ConnectState.FinishInBrowser">
          <div class="d-flex align-items-center">
            <div class="flex-grow-1 fs-4">
              {{ t("bluesky.connect.finishInBrowser") }}
            </div>
            <div>
              <button
                class="btn btn-secondary"
                type="button"
                @click="cancelClicked"
              >
                {{ t("bluesky.connect.cancel") }}
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="connectState == ConnectState.Connected">
          <hr />
          <p>{{ t("bluesky.connect.connectedTo") }}</p>
          <div class="d-flex align-items-center">
            <div class="flex-grow-1">
              <template v-if="profile">
                <img
                  v-if="profile.avatar"
                  :src="profile.avatar"
                  class="rounded-circle me-2"
                  width="32"
                  height="32"
                />
                <span v-if="profile.displayName" class="fw-bold me-2">
                  {{ profile.displayName }}
                </span>
                <small class="text-muted">@{{ profile.handle }}</small>
              </template>
            </div>
            <div>
              <button
                class="btn btn-secondary"
                type="button"
                @click="disconnectClicked"
              >
                {{ t("bluesky.connect.disconnect") }}
              </button>
            </div>
          </div>
          <p class="small text-muted mt-3">
            {{ t("bluesky.connect.disconnectKeepsData") }}
          </p>
        </template>
      </div>
    </template>
  </BaseWizardPage>
</template>
