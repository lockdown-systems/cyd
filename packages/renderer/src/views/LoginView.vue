<script setup lang="ts">
import { onMounted, ref, inject } from 'vue';
import type {Ref} from 'vue';
import { useRouter } from 'vue-router'

import API from '../api';
import { getDeviceInfo } from '../helpers';

const router = useRouter();

const showError = inject('showError') as (message: string) => void;
const api = inject('api') as Ref<API>;

const userEmail = ref('');
const verificationCode = ref('');

const deviceInfo = ref<DeviceInfo | null>(null);

type LoginState = 'start' | 'registerDevice';
const loginState = ref<LoginState>('start');

async function authenticate() {
    if(!userEmail.value) {
        showError('Please enter your email address.');
        return;
    }

    try {
        await api.value?.authenticate({
            email: userEmail.value
        });
    } catch {
        showError("Failed to authenticate. Please try again later.");
        return;
    }

    await (window as any).api.setConfig("userEmail", userEmail.value);
    loginState.value = "registerDevice";
}

async function registerDevice() {
    if(!deviceInfo.value) {
        showError('Failed to get device info. Please try again later.');
        return;
    }

    // Register the device
    try {
        const registerDeviceApiResponse = await api.value?.registerDevice({
            email: userEmail.value,
            verificationCode: verificationCode.value,
            description: deviceInfo.value?.deviceDescription,
        });
        await (window as any).api.setConfig("deviceToken", registerDeviceApiResponse.deviceToken);

        // Get an API token
        const tokenApiResponse = await api.value?.getToken({
            email: userEmail.value,
            deviceToken: registerDeviceApiResponse.deviceToken,
        });
        await (window as any).api.setConfig("apiToken", tokenApiResponse.token);

        // Redirect to the dashboard
        router.push('/dashboard');
    } catch {
        showError('Failed to register device. Please try again later.');
    }
}

function goBack() {
    loginState.value = 'start';
}

onMounted(async () => {
    try {
        deviceInfo.value = await getDeviceInfo(api.value);
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
                    <form class="w-50" @submit.prevent>
                        <div class="form-group d-flex flex-column align-items-center">
                            <template v-if="loginState == 'start'">
                                <p>Login to Semiphemeral using your email address.</p>
                                <input type="email" class="form-control" id="email" placeholder="Email address" v-model="userEmail">
                                <button type="submit" class="btn btn-primary mt-2" @click="authenticate">Continue</button>
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