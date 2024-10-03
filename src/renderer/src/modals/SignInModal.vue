<script setup lang="ts">
import { onMounted, onUnmounted, ref, inject, Ref, watch, getCurrentInstance } from 'vue';
import type { DeviceInfo } from '../types';
import { Account, XProgressInfo } from '../../../shared_types'
import SemiphemeralAPIClient from '../semiphemeral-api-client';
import Modal from 'bootstrap/js/dist/modal';

const emit = defineEmits(['hide']);
const hide = () => {
    emit('hide');
};

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const signInModal = ref<HTMLElement | null>(null);
let modalInstance: Modal | null = null;

const userEmail = inject('userEmail') as Ref<string>;
const apiClient = inject('apiClient') as Ref<SemiphemeralAPIClient>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;

const verificationCode = ref('');

type SignInState = 'start' | 'registerDevice' | 'token';
const signInState = ref<SignInState>('start');

const emailInputEl = ref<HTMLInputElement | null>(null);
const startContinueButtonEl = ref<HTMLButtonElement | null>(null);
const verificationCodeInputEl = ref<HTMLInputElement | null>(null);

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

    const resp = await apiClient.value.authenticate({
        email: userEmail.value
    });
    if (typeof resp !== 'boolean' && resp.error) {
        if (resp.status == 403) {
            window.electron.showError('At the moment, sign-ins are restricted to specific people. Sorry!');
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
        window.electron.showError('Failed to get device info. Please try again later.');
        await goBack();
        return;
    }

    // Register the device
    const registerDeviceResp = await apiClient.value.registerDevice({
        email: userEmail.value,
        verification_code: verificationCode.value,
        description: deviceInfo.value?.deviceDescription,
    });
    if ("error" in registerDeviceResp) {
        verificationCode.value = '';
        verificationCodeInputEl.value?.focus();
        window.electron.showError('Invalid verification code.');
        return;
    }
    if (!registerDeviceResp.device_token) {
        window.electron.showError('Failed to register device. Please try again later.');
        await goBack();
        return;
    }

    // Save the device UUID
    await window.electron.database.setConfig("deviceUUID", registerDeviceResp.uuid);

    // Save the device token
    await window.electron.database.setConfig("deviceToken", registerDeviceResp.device_token);
    apiClient.value.setDeviceToken(registerDeviceResp.device_token);

    // Get a new API token
    const pingResp = await apiClient.value.ping();
    if (!pingResp) {
        window.electron.showError('Failed to register new device. Please try again later.');
    }

    // Refresh the device info
    await refreshDeviceInfo();

    // Submit progress to the API
    const accounts: Account[] = await window.electron.database.getAccounts();
    for (let i = 0; i < accounts.length; i++) {
        if (accounts[i].type == 'X') {
            try {
                const progressInfo: XProgressInfo = await window.electron.X.getProgressInfo(accounts[i].id);
                const postXProgresResp = await apiClient.value.postXProgress({
                    account_uuid: progressInfo.accountUUID,
                    total_tweets_archived: progressInfo.totalTweetsArchived,
                    total_messages_indexed: progressInfo.totalMessagesIndexed,
                    total_tweets_deleted: progressInfo.totalTweetsDeleted,
                    total_retweets_deleted: progressInfo.totalRetweetsDeleted,
                    total_likes_deleted: progressInfo.totalLikesDeleted,
                    total_messages_deleted: progressInfo.totalMessagesDeleted
                }, true);
                if (postXProgresResp !== true && postXProgresResp !== false && postXProgresResp.error) {
                    // Silently log the error and continue
                    console.log("Error posting X progress:", postXProgresResp.message);
                }
            } catch (e) {
                // Silently log the error and continue
                console.log("Error getting X progress:", e);
            }
        }
    }

    // Success
    signInState.value = 'token';
    hide();

    // Emit the signed-in event
    emitter?.emit('signed-in');
}

async function goBack() {
    verificationCode.value = '';
    signInState.value = 'start';
}

onMounted(async () => {
    const modalElement = signInModal.value;
    if (modalElement) {
        modalInstance = new Modal(modalElement);
        modalInstance.show();

        // The 'hidden.bs.modal' event is triggered when when the user clicks outside the modal
        modalElement.addEventListener('hidden.bs.modal', () => {
            hide();
        });
    }
});

onUnmounted(() => {
    if (signInModal.value && modalInstance) {
        signInModal.value.removeEventListener('hidden.bs.modal', hide);
    }
});
</script>

<template>
    <div id="signInModal" ref="signInModal" class="modal fade" role="dialog" aria-labelledby="signInModalLabel"
        aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h4 class="modal-title">
                        Sign in
                    </h4>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="hide" />
                </div>
                <div class="modal-body">
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
                                        <input v-model="verificationCode" type="text"
                                            class="form-control verification-code" rel="verificationCodeInputEl"
                                            data-vue-ref="verificationCodeInputEl" maxlength="6">
                                    </div>
                                    <div class="button-container mt-2">
                                        <button type="submit" class="btn btn-secondary" rel="backButtonEl"
                                            data-vue-ref="backButtonEl" @click="goBack">
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
    </div>
</template>

<style scoped></style>