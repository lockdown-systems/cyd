<script setup lang="ts">
import { onMounted, ref, inject } from 'vue';
import { useRouter } from 'vue-router'

import { getApiInfo } from '../helpers';

const router = useRouter();

const showError = inject('showError') as (message: string) => void;

const userEmail = ref('');
const verificationCode = ref('');

const apiInfo = ref<ApiInfo | null>(null);

type LoginState = 'start' | 'authenticating' | 'token';
const loginState = ref<LoginState>('start');

function authenticate() {
    console.log('Authenticating...')
    if(!userEmail.value) {
        showError('Please enter your email address.');
        return;
    }

    // TODO: authenticate
}

function token() {
    console.log('Token...')
    if(!verificationCode.value) {
        showError('Please enter the verification code.');
        return;
    }

    // TODO: get token
}

onMounted(async () => {
    apiInfo.value = await getApiInfo();
    userEmail.value = apiInfo.value?.userEmail;
    
    // Already logged in? Redirect to the dashboard
    if(apiInfo.value?.valid) {
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
                            <template v-else-if="loginState == 'authenticating'">
                                <p>We've emailed you a verification code. Enter it below.</p>
                                <input type="text" class="form-control" id="verificationCode" placeholder="000000" v-model="verificationCode">
                                <button type="submit" class="btn btn-primary mt-2" @click="token">Continue</button>
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