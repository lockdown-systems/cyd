<script setup lang="ts">
import { ref, inject, Ref } from 'vue';
import { useRouter } from 'vue-router'

import ServerAPI from '../ServerApi';

const router = useRouter();

const showError = inject('showError') as (message: string) => void;
const userEmail = inject('userEmail') as Ref<string>;
const serverApi = inject('serverApi') as Ref<ServerAPI>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;

const verificationCode = ref('');

type LoginState = 'start' | 'registerDevice';
const loginState = ref<LoginState>('start');

function disableStartFields() {
    document.getElementById("email")?.setAttribute("disabled", "true");
    document.getElementById("start-continue")?.setAttribute("disabled", "true");
}

function enableStartFields() {
    document.getElementById("email")?.setAttribute("disabled", "false");
    document.getElementById("start-continue")?.setAttribute("disabled", "false");
}

async function authenticate() {
    if (!userEmail.value) {
        showError('Please enter your email address.');
        return;
    }

    disableStartFields();

    const resp = await serverApi.value.authenticate({
        email: userEmail.value
    });
    if ("error" in resp && resp.error) {
        showError(resp.message);
        enableStartFields();
        return;
    }

    await (window as any).electron.setConfig("userEmail", userEmail.value);
    enableStartFields();

    serverApi.value.setUserEmail(userEmail.value);

    loginState.value = "registerDevice";
}

async function registerDevice() {
    if (!deviceInfo.value) {
        showError('Failed to get device info. Please try again later.');
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
        showError('Failed to register device. Please try again later.');
        await goBack();
        return;
    }
    if (!registerDeviceResp.deviceToken) {
        showError('Failed to register device. Please try again later.');
        await goBack();
        return;
    }

    // Save the device token
    await (window as any).electron.setConfig("deviceToken", registerDeviceResp.deviceToken);

    // Get a new API
    const pingResp = await serverApi.value.ping();
    if (!pingResp) {
        showError('Failed to register new device. Please try again later.');
    }

    // Refresh the device info
    await refreshDeviceInfo();

    // Redirect to the dashboard
    router.push('/dashboard');
}

async function goBack() {
    verificationCode.value = '';
    loginState.value = 'start';
}
</script>

<template>
    <div class="container p-2 h-100">
        <div class="d-flex align-items-center h-100">
            <div class="w-100">
                <div class="text-center">
                    <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Logo" style="width: 120px;" />
                </div>
                <p class="lead text-muted text-center">
                    Automatically delete your old posts, except the ones you want to keep.
                </p>

                <div class="d-flex flex-column align-items-center">
                    <form @submit.prevent>
                        <template v-if="loginState == 'start'">
                            <div class="form-group d-flex flex-column align-items-center">
                                <p>Login to Semiphemeral using your email address.</p>
                                <input type="email" class="form-control" id="email" placeholder="Email address"
                                    v-model="userEmail">
                                <button type="submit" class="btn btn-primary mt-2" id="start-continue"
                                    @click="authenticate">Continue</button>
                            </div>
                        </template>
                        <template v-else-if="loginState == 'registerDevice'">
                            <div>
                                <p>We've emailed you a verification code. Enter it below.</p>
                                <div class="verification-code-container">
                                    <input type="text" class="form-control verification-code" id="verificationCode"
                                        v-model="verificationCode" maxlength="6">
                                </div>
                                <div class="button-container mt-2">
                                    <button type="submit" class="btn btn-secondary" @click="goBack">Back</button>
                                    <button type="submit" class="btn btn-primary"
                                        @click="registerDevice">Continue</button>
                                </div>
                            </div>
                        </template>
                        <template v-else-if="loginState == 'token'">
                            <p>Logging in...</p>
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