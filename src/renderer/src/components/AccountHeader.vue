<script setup lang="ts">
import { ref } from 'vue';
import { getAccountIcon } from '../helpers';
import type { Account } from '../../../shared_types';

defineProps<{
    account: Account;
}>();

const emit = defineEmits(['onRefreshClicked']);

const refreshBtnShowInfo = ref(false);

const onRefreshClicked = () => {
    emit('onRefreshClicked');
};
</script>

<template>
    <div class="account-header d-flex align-items-center justify-content-between">
        <div class="btn-container">
            <div class="refresh-btn account-header-btn d-flex justify-content-center align-items-center"
                @mouseover="refreshBtnShowInfo = true" @mouseleave="refreshBtnShowInfo = false"
                @click="onRefreshClicked">
                <i class="fa-solid fa-rotate-right" />
            </div>
            <div v-if="refreshBtnShowInfo" class="info-popup info-popup-refresh">
                Refresh
            </div>
        </div>
        <div class="label d-flex align-items-center">
            <template v-if="account.type == 'X'">
                <template
                    v-if="account.xAccount?.profileImageDataURI != '' && account.xAccount?.profileImageDataURI != null">
                    <span class="profile-image">
                        <img alt="Profile Image" :src="account.xAccount?.profileImageDataURI">
                    </span>
                </template>
                <template v-if="account.xAccount?.username != null">
                    <span class="label-text">@{{ account.xAccount?.username }}</span>
                </template>
            </template>
            <span class="logo">
                <i :class="getAccountIcon(account.type)" />
            </span>
        </div>
    </div>
</template>

<style scoped>
.account-header {
    background-color: #9e9e9e;
    margin-left: -15px;
    margin-right: -12px;
    padding: 3px 10px;
    background-color: #254a5b;
    border-bottom: 3px solid #5b9bb9;
}

.btn-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.account-header-btn {
    width: 40px;
    height: 40px;
    font-size: 20px;
    border-radius: 30%;
    cursor: pointer;
    color: #ffffff;
    opacity: 0.5;
    border-radius: 50%;
}

.account-header-btn:hover {
    opacity: 1.0;
}

.label {
    color: #ffffff;
    font-size: 20px;
}

.label .logo {
    opacity: 0.5;
    margin-left: 10px;
}

.profile-image img {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: 10px;
}

.info-popup {
    position: absolute;
    background-color: #000000;
    color: #ffffff;
    padding: 3px 6px;
    border-radius: 4px;
    white-space: nowrap;
}

.info-popup-refresh {
    top: 35px;
    left: 0px;
}

.info-popup-settings {
    top: 35px;
    right: 0px;
}
</style>