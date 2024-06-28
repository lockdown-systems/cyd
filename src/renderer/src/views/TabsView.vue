<script setup lang="ts">
import { inject, Ref, ref, onMounted } from 'vue';
import AccountButton from '../components/AccountButton.vue';
import AccountView from './AccountView.vue';
import type { DeviceInfo } from '../types';
import type { Account } from '../../../shared_types';

const addAccountBtnShowInfo = ref(false);
const userBtnShowInfo = ref(false);
const accounts = ref<Account[]>([]);
const activeAccountId = ref<number | null>(null);

const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;

const accountClicked = (account: Account) => {
  activeAccountId.value = account.id;
};

const addAccountClicked = async () => {
  // Do we already have an unknown account?
  const unknownAccount = accounts.value.find((account) => account.type === 'unknown');
  if (unknownAccount) {
    activeAccountId.value = unknownAccount.id;
    return;
  }

  // Create a new account
  const account = await window.electron.createAccount();
  accounts.value = await window.electron.getAccounts();
  activeAccountId.value = account.id;
};

onMounted(async () => {
  accounts.value = await window.electron.getAccounts();
  if (accounts.value.length === 0) {
    await addAccountClicked();
  }
});
</script>

<template>
  <div class="container-fluid">
    <div class="row">
      <div class="sidebar col-auto d-flex flex-column gap-2">
        <div class="accounts-list flex-grow-1 d-flex flex-column gap-2 mt-3">
          <AccountButton v-for="account in accounts" :key="account.id" :account="account"
            :active="account.id === activeAccountId" @click="accountClicked(account)" />
        </div>

        <div class="btns-list d-flex flex-column gap-2 mb-3">
          <div class="btn-container">
            <div class="add-account-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="addAccountBtnShowInfo = true" @mouseleave="addAccountBtnShowInfo = false"
              @click="addAccountClicked">
              <i class="fa-solid fa-plus" />
            </div>
            <div v-if="addAccountBtnShowInfo" class="info-popup">
              Add an account
            </div>
          </div>

          <div class="btn-container">
            <div class="user-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="userBtnShowInfo = true" @mouseleave="userBtnShowInfo = false">
              <i class="fa-solid fa-user-ninja" />
            </div>
            <div v-if="userBtnShowInfo" class="info-popup">
              You are logged in as {{ deviceInfo?.userEmail }}
            </div>
          </div>
        </div>
      </div>

      <div class="main-content col">
        <AccountView v-for="account in accounts" :key="account.id" :account="account"
          :class="{ 'hide': activeAccountId !== account.id }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  height: 100vh;
  width: 66px;
  background-color: #254a5b;
  border-right: 3px solid #5b9bb9;
}

.sidebar .btn-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar .sidebar-btn {
  width: 40px;
  height: 40px;
  font-size: 25px;
  border-radius: 30%;
  cursor: pointer;
}

.sidebar .add-account-btn {
  color: #ffffff;
  background-color: #000000;
  opacity: 0.3;
  border-radius: 50%;
}

.sidebar .add-account-btn:hover {
  opacity: 0.6;
}

.sidebar .user-btn {
  color: #000000;
  background-color: #ffffff;
  opacity: 0.6;
}

.sidebar .user-btn:hover {
  opacity: 0.9;
}

.sidebar .info-popup {
  position: absolute;
  bottom: 4px;
  left: 45px;
  background-color: #000000;
  color: #ffffff;
  padding: 3px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.hide {
  display: none;
}
</style>