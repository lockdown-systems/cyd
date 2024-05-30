<script setup lang="ts">
import { onMounted, ref, inject } from 'vue';
import type {Ref} from 'vue';
import { useRouter } from 'vue-router'

import ServerAPI from '../ServerApi';
import { getDeviceInfo } from '../helpers';

const router = useRouter();

const showError = inject('showError') as (message: string) => void;
const serverApi = inject('api') as Ref<ServerAPI>;

const userEmail = ref('');
const verificationCode = ref('');

const deviceInfo = ref<DeviceInfo | null>(null);

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
    if(!userEmail.value) {
        showError('Please enter your email address.');
        return;
    }

    disableStartFields();

    const resp = await serverApi.value?.authenticate({
        email: userEmail.value
    });
    if ("error" in resp && resp.error) {
        showError(resp.message);
        enableStartFields();
        return;
    }

    await (window as any).electron.setConfig("userEmail", userEmail.value);
    enableStartFields();
    loginState.value = "registerDevice";
}

async function registerDevice() {
    if(!deviceInfo.value) {
        showError('Failed to get device info. Please try again later.');
        return;
    }

    // Register the device
    const registerDeviceResp = await serverApi.value?.registerDevice({
        email: userEmail.value,
        verificationCode: verificationCode.value,
        description: deviceInfo.value?.deviceDescription,
    });
    if ("error" in registerDeviceResp) {
        showError('Failed to register device. Please try again later.');
        return;
    }
    if(!registerDeviceResp.deviceToken) {
        showError('Failed to register device. Please try again later.');
        return;
    }

    // Save the device token
    await (window as any).electron.setConfig("deviceToken", registerDeviceResp.deviceToken);

    // Get an API token
    const getTokenResp = await serverApi.value?.getToken({
        email: userEmail.value,
        deviceToken: registerDeviceResp.deviceToken,
    });
    if("error" in getTokenResp) {
        showError('Failed to register device. Please try again later.');
        return;
    }
    if(!getTokenResp.token) {
        showError('Failed to get API token. Please try again later.');
        return;
    }

    // Save the API token
    await (window as any).electron.setConfig("apiToken", getTokenResp.token);

    // Redirect to the dashboard
    router.push('/dashboard');
}

function goBack() {
    loginState.value = 'start';
}

onMounted(async () => {
    try {
        deviceInfo.value = await getDeviceInfo(serverApi.value);
        if(deviceInfo.value) {
            userEmail.value = deviceInfo.value.userEmail;
        }
    } catch {
        showError("Failed to get device info. Please try again later.");
    }

    // Already logged in? Redirect to the dashboard
    if(deviceInfo.value?.valid) {
        router.push('/dashboard');
    }
});
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
                        <div class="form-group d-flex flex-column align-items-center">
                            <template v-if="loginState == 'start'">
                                <p>Login to Semiphemeral using your email address.</p>
                                <input type="email" class="form-control" id="email" placeholder="Email address" v-model="userEmail">
                                <button type="submit" class="btn btn-primary mt-2" id="start-continue" @click="authenticate">Continue</button>
                            </template>
                            <template v-else-if="loginState == 'registerDevice'">
                                <p>We've emailed you a verification code. Enter it below.</p>
                                <input type="text" class="form-control" id="verificationCode" v-model="verificationCode">
                                <button type="submit" class="btn mt-2" @click="goBack">Back</button>
                                <button type="submit" class="btn btn-primary mt-2" @click="registerDevice">Continue</button>
                            </template>
                            <template v-else-if="loginState == 'token'">
                                <p>Logging in...</p>
                            </template>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>