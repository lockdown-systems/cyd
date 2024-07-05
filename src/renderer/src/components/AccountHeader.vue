<script setup lang="ts">
import { ref, inject } from 'vue';
import { getAccountIcon } from '../helpers';
import type { Account } from '../../../shared_types';

const props = defineProps<{
    account: Account;
}>();

const showAccountSettings = inject('showAccountSettings') as (account: Account) => void;

const refreshBtnShowInfo = ref(false);
const settingsBtnShowInfo = ref(false);

const onRefreshClicked = () => {
    console.log('Refresh clicked');
};

const onSettingsClicked = () => {
    showAccountSettings(props.account);
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
            <span class="logo">
                <i :class="getAccountIcon(account.type)" />
            </span>
            <template v-if="account.type == 'X'">
                <template v-if="account.xAccount?.username == null">
                    <span class="label-text">not logged in</span>
                </template>
                <template v-else>
                    <span class="label-text">@{{ account.xAccount?.username }}</span>
                </template>
            </template>
        </div>
        <div class="btn-container">
            <div class="settings-btn account-header-btn d-flex justify-content-center align-items-center"
                @mouseover="settingsBtnShowInfo = true" @mouseleave="settingsBtnShowInfo = false"
                @click="onSettingsClicked">
                <i class="fa-solid fa-gear" />
            </div>
            <div v-if="settingsBtnShowInfo" class="info-popup info-popup-settings">
                Settings
            </div>
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
    margin-right: 10px;
}

.label .label-text {
    font-weight: bold;
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