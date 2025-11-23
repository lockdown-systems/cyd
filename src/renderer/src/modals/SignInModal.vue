<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  ref,
  inject,
  Ref,
  watch,
  getCurrentInstance,
} from "vue";
import { useI18n } from "vue-i18n";
import type { DeviceInfo } from "../types";
import { Account } from "../../../shared_types";
import CydAPIClient, { APIErrorResponse } from "../../../cyd-api-client";
import { xPostProgress } from "../util_x";

import Modal from "bootstrap/js/dist/modal";

const { t } = useI18n();

const emit = defineEmits(["hide"]);
const hide = () => {
  emit("hide");
};

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const signInModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const userEmail = inject("userEmail") as Ref<string>;
const apiClient = inject("apiClient") as Ref<CydAPIClient>;
const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject("refreshDeviceInfo") as () => Promise<void>;

const mode = ref("");

const userSubscribe = ref(true);
const verificationCode = ref("");

type SignInState = "start" | "registerDevice" | "token";
const signInState = ref<SignInState>("start");

const emailInputEl = ref<HTMLInputElement | null>(null);
const startContinueButtonEl = ref<HTMLButtonElement | null>(null);
const verificationCodeInputEl = ref<HTMLInputElement | null>(null);

watch(verificationCode, async (newValue: string, _oldValue: string) => {
  const filtered = newValue.replace(/[^0-9]/g, "").slice(0, 6);

  if (filtered !== newValue) {
    verificationCode.value = filtered;
    return; // Exit early to avoid infinite loop
  }

  // Auto-submit on 6 digits
  if (filtered.length === 6) {
    signInState.value = "token";
    await registerDevice();
  }
});

function disableStartFields() {
  emailInputEl.value?.setAttribute("disabled", "true");
  startContinueButtonEl.value?.setAttribute("disabled", "true");
}

function enableStartFields() {
  emailInputEl.value?.removeAttribute("disabled");
  startContinueButtonEl.value?.removeAttribute("disabled");
}

async function authenticate() {
  if (!userEmail.value) {
    window.electron.showError(t("signIn.error.enterEmail"));
    return;
  }

  disableStartFields();

  const resp = await apiClient.value.authenticate({
    email: userEmail.value,
  });
  if (typeof resp !== "boolean" && resp.error) {
    if (resp.status == 403) {
      window.electron.showError(t("signIn.error.signInRestricted"));
    } else {
      window.electron.showError(resp.message);
    }
    enableStartFields();
    return;
  }

  await window.electron.database.setConfig("userEmail", userEmail.value);
  enableStartFields();

  apiClient.value.setUserEmail(userEmail.value);

  signInState.value = "registerDevice";
}

async function registerDevice() {
  if (!deviceInfo.value) {
    window.electron.showError(t("signIn.error.failedToGetDeviceInfo"));
    await goBack();
    return;
  }

  // Register the device
  const registerDeviceResp = await apiClient.value.registerDevice({
    email: userEmail.value,
    verification_code: verificationCode.value,
    description: deviceInfo.value?.deviceDescription,
    device_type: "app",
  });
  if ("error" in registerDeviceResp) {
    verificationCode.value = "";
    verificationCodeInputEl.value?.focus();
    window.electron.showError(t("signIn.error.invalidVerificationCode"));
    signInState.value = "registerDevice";
    verificationCode.value = "";
    return;
  }
  if (!registerDeviceResp.device_token) {
    window.electron.showError(t("signIn.error.failedToRegisterDevice"));
    await goBack();
    return;
  }

  // Save the device UUID
  await window.electron.database.setConfig(
    "deviceUUID",
    registerDeviceResp.uuid,
  );

  // Save the device token
  await window.electron.database.setConfig(
    "deviceToken",
    registerDeviceResp.device_token,
  );
  apiClient.value.setDeviceToken(registerDeviceResp.device_token);

  // Get a new API token
  const pingResp = await apiClient.value.ping();
  if (!pingResp) {
    window.electron.showError(t("signIn.error.failedToRegisterNewDevice"));
  }

  // Refresh the device info
  await refreshDeviceInfo();

  // Submit progress to the API
  const accounts: Account[] = await window.electron.database.getAccounts();
  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].type == "X") {
      try {
        await xPostProgress(apiClient.value, deviceInfo.value, accounts[i].id);
      } catch (e) {
        // Silently log the error and continue
        console.log("Error getting X progress:", e);
      }
    }
  }

  // Subscribe to newsletter
  if (userSubscribe.value) {
    const subscribeResp: boolean | APIErrorResponse =
      await apiClient.value.postNewsletter({ email: userEmail.value });
    if (
      subscribeResp !== true &&
      subscribeResp !== false &&
      subscribeResp.error
    ) {
      // Silently log the error and continue
      console.log("Error subscribing to newsletter:", subscribeResp.message);
    }
  }

  // Success
  signInState.value = "token";
  hide();

  // Update user activity immediately after successful sign in
  await apiClient.value.postUserActivity();

  // Emit the signed-in event
  emitter?.emit("signed-in");
}

async function goBack() {
  verificationCode.value = "";
  signInState.value = "start";
}

onMounted(async () => {
  mode.value = await window.electron.getMode();

  const modalElement = signInModal.value;
  if (modalElement) {
    modalInstance = new Modal(modalElement);
    modalInstance.show();

    // The 'hidden.bs.modal' event is triggered when when the user clicks outside the modal
    modalElement.addEventListener("hidden.bs.modal", () => {
      hide();
    });
  }
});

onUnmounted(() => {
  if (signInModal.value && modalInstance) {
    signInModal.value.removeEventListener("hidden.bs.modal", hide);
  }
});
</script>

<template>
  <div
    id="signInModal"
    ref="signInModal"
    class="modal fade"
    role="dialog"
    aria-labelledby="signInModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h4 class="modal-title text-nowrap">
            {{ t("signIn.title") }}
          </h4>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
            @click="hide"
          />
        </div>
        <div class="modal-body">
          <div v-if="mode == 'open'">
            <p>
              {{ t("signIn.openSourceMode") }}
            </p>
            <p>
              {{ t("signIn.supportProject") }}
            </p>
          </div>
          <div v-else class="d-flex flex-column align-items-center">
            <form @submit.prevent>
              <template v-if="signInState == 'start'">
                <div class="form-group d-flex flex-column mt-4">
                  <div>
                    <label for="email" class="sr-only">
                      {{ t("signIn.emailLabel") }}
                    </label>
                    <input
                      id="email"
                      ref="emailInputEl"
                      v-model="userEmail"
                      type="email"
                      class="form-control"
                      data-testid="email-input"
                      :placeholder="t('signIn.emailPlaceholder')"
                    />
                  </div>

                  <div class="form-check subscribe mt-2">
                    <input
                      id="subscribe"
                      v-model="userSubscribe"
                      type="checkbox"
                      class="form-check-input"
                    />
                    <label class="form-check-label small" for="subscribe">
                      {{ t("signIn.subscribeLabel") }}
                    </label>
                  </div>

                  <div class="mt-2">
                    <button
                      type="submit"
                      class="btn btn-primary mt-2"
                      rel="startContinueButtonEl"
                      data-testid="continue-button"
                      @click="authenticate"
                    >
                      {{ t("signIn.continue") }}
                    </button>
                  </div>
                </div>
                <p class="text-muted small mt-5">
                  {{ t("signIn.emailPrivacy") }}
                </p>
              </template>
              <template v-else-if="signInState == 'registerDevice'">
                <div class="mt-4">
                  <p>{{ t("signIn.verificationCodeSent") }}</p>
                  <div class="verification-code-container">
                    <input
                      v-model="verificationCode"
                      type="text"
                      class="form-control verification-code"
                      rel="verificationCodeInputEl"
                      data-testid="verification-code-input"
                      maxlength="6"
                    />
                  </div>
                  <div class="button-container text-center mt-5">
                    <button
                      type="submit"
                      class="btn btn-secondary"
                      rel="backButtonEl"
                      data-testid="back-button"
                      @click="goBack"
                    >
                      {{ t("signIn.back") }}
                    </button>
                  </div>
                </div>
              </template>
              <template v-else-if="signInState == 'token'">
                <p>{{ t("signIn.signingIn") }}</p>
              </template>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
label {
  margin-bottom: 0.5rem;
}

input[type="email"],
input[type="text"] {
  font-size: 1.5rem;
}

.subscribe {
  font-size: 1.1rem;
}
</style>
