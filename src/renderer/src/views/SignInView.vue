<script setup lang="ts">
import { ref, inject, Ref, watch } from 'vue';
import type { DeviceInfo } from '../types';
import ServerAPI from '../ServerAPI';

const userEmail = inject('userEmail') as Ref<string>;
const serverApi = inject('serverApi') as Ref<ServerAPI>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;

const verificationCode = ref('');

type SignInState = 'start' | 'registerDevice' | 'token';
const signInState = ref<SignInState>('start');

const emailInputEl = ref<HTMLInputElement | null>(null);
const startContinueButtonEl = ref<HTMLButtonElement | null>(null);
const verificationCodeInputEl = ref<HTMLInputElement | null>(null);

const emit = defineEmits(['onSignIn']);

watch(verificationCode, async (newValue, _oldValue) => {
  if (newValue.length < 6) {
    // Strip non-numeric characters
    verificationCode.value = newValue.replace(/[^0-9]/g, '');
  }
  // Auto-submit on 6 digits
  if (newValue.length === 6) {
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
    window.electron.showError('Please enter your email address.');
    return;
  }

  disableStartFields();

  const resp = await serverApi.value.authenticate({
    email: userEmail.value
  });
  if ("error" in resp && resp.error) {
    window.electron.showError(resp.message);
    enableStartFields();
    return;
  }

  await window.electron.setConfig("userEmail", userEmail.value);
  enableStartFields();

  serverApi.value.setUserEmail(userEmail.value);

  signInState.value = "registerDevice";
}

async function registerDevice() {
  if (!deviceInfo.value) {
    window.electron.showError('Failed to get device info. Please try again later.');
    await goBack();
    return;
  }

  // Register the device
  const registerDeviceResp = await serverApi.value.registerDevice({
    email: userEmail.value,
    verificationCode: verificationCode.value,
    description: deviceInfo.value?.deviceDescription,
  });
  if ("error" in registerDeviceResp) {
    verificationCode.value = '';
    verificationCodeInputEl.value?.focus();
    window.electron.showError('Invalid verification code.');
    return;
  }
  if (!registerDeviceResp.deviceToken) {
    window.electron.showError('Failed to register device. Please try again later.');
    await goBack();
    return;
  }

  // Save the device UUID
  await window.electron.setConfig("deviceUUID", registerDeviceResp.uuid);

  // Save the device token
  await window.electron.setConfig("deviceToken", registerDeviceResp.deviceToken);
  serverApi.value.setDeviceToken(registerDeviceResp.deviceToken);

  // Get a new API token
  const pingResp = await serverApi.value.ping();
  if (!pingResp) {
    window.electron.showError('Failed to register new device. Please try again later.');
  }

  // Refresh the device info
  await refreshDeviceInfo();

  // Success
  emit('onSignIn');
  signInState.value = 'token';
}

async function goBack() {
  verificationCode.value = '';
  signInState.value = 'start';
}
</script>

<template>
  <div class="container p-2 h-100">
    <div class="d-flex align-items-center h-100">
      <div class="w-100">
        <div class="text-center">
          <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Bird" style="width: 120px;">
        </div>
        <p class="lead text-muted text-center">
          Automatically delete your old posts, except the ones you want to keep.
        </p>

        <div class="d-flex flex-column align-items-center">
          <form @submit.prevent>
            <template v-if="signInState == 'start'">
              <div class="form-group d-flex flex-column align-items-center">
                <p>Sign in to Semiphemeral using your email address.</p>
                <input ref="emailInputEl" v-model="userEmail" type="email" class="form-control"
                  data-vue-ref="emailInputEl" placeholder="Email address">
                <button type="submit" class="btn btn-primary mt-2" rel="startContinueButtonEl"
                  data-vue-ref="startContinueButtonEl" @click="authenticate">
                  Continue
                </button>
              </div>
            </template>
            <template v-else-if="signInState == 'registerDevice'">
              <div>
                <p>We've emailed you a verification code. Enter it below.</p>
                <div class="verification-code-container">
                  <input v-model="verificationCode" type="text" class="form-control verification-code"
                    rel="verificationCodeInputEl" data-vue-ref="verificationCodeInputEl" maxlength="6">
                </div>
                <div class="button-container mt-2">
                  <button type="submit" class="btn btn-secondary" rel="backButtonEl" data-vue-ref="backButtonEl"
                    @click="goBack">
                    Back
                  </button>
                </div>
              </div>
            </template>
            <template v-else-if="signInState == 'token'">
              <p>Signing in...</p>
            </template>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.verification-code-container {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.verification-code {
  width: 130px;
  font-size: 1.5em;
  font-weight: bold;
  text-align: center;
  font-family: 'Courier New', monospace;
}

.button-container {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}
</style>