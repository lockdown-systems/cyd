<script setup lang="ts">
import { inject, Ref, ref, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import AccountButton from '../components/AccountButton.vue';
import AccountView from './AccountView.vue';
import SemiphemeralAPIClient from '../semiphemeral-api-client';
import type { DeviceInfo } from '../types';
import type { Account } from '../../../shared_types';
import ManageAccountView from './ManageAccountView.vue';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const addAccountBtnShowInfo = ref(false);
const userBtnShowInfo = ref(false);
const userBtnShowMenu = ref(false);
const accounts = ref<Account[]>([]);
const activeAccountId = ref<number | null>(null);

const apiClient = inject('apiClient') as Ref<SemiphemeralAPIClient>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;
const refreshAPIClient = inject('refreshAPIClient') as () => Promise<void>;
const showSignIn = inject('showSignIn') as () => void;

const showManageAccount = ref(false);

const accountClicked = async (account: Account) => {
  showManageAccount.value = false;
  activeAccountId.value = account.id;

  // If we clicked out of an unknown account, remove the unknown account
  if (account.type !== 'unknown') {
    for (let i = 0; i < accounts.value.length; i++) {
      if (accounts.value[i].type === 'unknown') {
        const accountIDToDelete = accounts.value[i].id;
        await window.electron.database.deleteAccount(accountIDToDelete);
        accounts.value = await window.electron.database.getAccounts();
        break;
      }
    }
  }
};

const addAccountClicked = async () => {
  // Do we already have an unknown account?
  const unknownAccount = accounts.value.find((account) => account.type === 'unknown');
  if (unknownAccount) {
    activeAccountId.value = unknownAccount.id;
    return;
  }

  // Create a new account
  const account = await window.electron.database.createAccount();
  accounts.value = await window.electron.database.getAccounts();
  activeAccountId.value = account.id;
};

const deleteAccount = async (account: Account) => {
  if (await window.electron.showQuestion(
    'Are you sure you want to remove this account from Semiphemeral?',
    'Yes, remove it',
    'No, keep it'
  )) {
    const accountIDToDelete = account.id;
    await window.electron.database.deleteAccount(accountIDToDelete);
    accounts.value = await window.electron.database.getAccounts();

    if (accounts.value.length === 0) {
      await addAccountClicked();
    } else {
      if (activeAccountId.value == accountIDToDelete) {
        activeAccountId.value = accounts.value[0].id;
      }
    }
  }
}

const accountSelected = async (account: Account, accountType: string) => {
  try {
    const newAccount = await window.electron.database.selectAccountType(account.id, accountType);
    if (newAccount === null) {
      throw new Error('Failed to select account type');
    }

    // For the account in the accounts list
    for (let i = 0; i < accounts.value.length; i++) {
      if (accounts.value[i].id === account.id) {
        accounts.value[i] = newAccount;
        break;
      }
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      await window.electron.showError(e.message);
    }
  }
}

const userMenuPopupEl = ref<HTMLDivElement | null>(null);
const userMenuBtnEl = ref<HTMLDivElement | null>(null);

const userMenuClicked = () => {
  userBtnShowMenu.value = !userBtnShowMenu.value;
};

const outsideUserMenuClicked = (event: MouseEvent) => {
  if (
    userBtnShowMenu.value &&
    !userMenuBtnEl.value?.contains(event.target as Node) &&
    !userMenuPopupEl.value?.contains(event.target as Node)
  ) {
    userBtnShowMenu.value = false;
  }
};

const manageAccountClicked = async () => {
  userBtnShowMenu.value = false;
  showManageAccount.value = true;
};

const signInClicked = async () => {
  showSignIn();
};

const signOutClicked = async () => {
  if (deviceInfo.value === null) {
    window.electron.showError('Cannot sign out without device info');
    return;
  }

  // Delete the logged in device
  const deleteDeviceResp = await apiClient.value.deleteDevice({
    // this API route takes either a UUID or a device token
    uuid: deviceInfo.value.deviceToken
  });
  if (deleteDeviceResp !== undefined && deleteDeviceResp.error) {
    console.log("Error deleting device", deleteDeviceResp.message)
  }

  // Delete the device from the local storage
  await window.electron.database.setConfig("userEmail", "");
  await window.electron.database.setConfig("apiToken", "");
  await window.electron.database.setConfig("deviceToken", "");
  await window.electron.database.setConfig("deviceUUID", "");

  // Refresh the device info and the API client
  await refreshDeviceInfo();
  await refreshAPIClient();

  showManageAccount.value = false;
  userBtnShowMenu.value = false;
};

const reloadAccounts = async () => {
  console.log('Reloading accounts');
  accounts.value = await window.electron.database.getAccounts();
};

onMounted(async () => {
  await reloadAccounts();
  if (accounts.value.length === 0) {
    await addAccountClicked();
  } else {
    activeAccountId.value = accounts.value[0].id;
  }

  document.addEventListener('click', outsideUserMenuClicked);
  document.addEventListener('auxclick', outsideUserMenuClicked);

  emitter?.on('signed-in', manageAccountClicked);
  emitter?.on('account-updated', reloadAccounts);
});

onUnmounted(async () => {
  document.removeEventListener('click', outsideUserMenuClicked);
  document.removeEventListener('auxclick', outsideUserMenuClicked);
});
</script>

<template>
  <div class="container-fluid">
    <div class="row">
      <div class="sidebar col-auto d-flex flex-column gap-2">
        <div class="accounts-list flex-grow-1 d-flex flex-column gap-2 mt-3">
          <AccountButton v-for="account in accounts" :key="account.id" class="account-button" :account="account"
            :active="account.id === activeAccountId" @click="accountClicked(account)"
            @on-delete-clicked="deleteAccount(account)" />
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
            <div ref="userMenuBtnEl" class="user-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="userBtnShowInfo = true" @mouseleave="userBtnShowInfo = false" @click="userMenuClicked">
              <i class="fa-solid fa-user-ninja" />
            </div>
            <div v-if="userBtnShowInfo" class="info-popup">
              <template v-if="deviceInfo?.valid">
                You are signed in as {{ deviceInfo?.userEmail }}
              </template>
              <template v-else>
                You are not signed in
              </template>
            </div>
            <div v-if="userBtnShowMenu" ref="userMenuPopupEl" class="menu-popup">
              <template v-if="deviceInfo?.valid">
                <ul>
                  <li class="menu-text">
                    Signed in as {{ deviceInfo?.userEmail }}
                  </li>
                  <li class="menu-line">
                    <hr>
                  </li>
                  <li class="menu-btn" @click="manageAccountClicked">
                    Manage my Semiphemeral account
                  </li>
                  <li class="menu-btn" @click="signOutClicked">
                    Sign out of my Semiphemeral account
                  </li>
                </ul>
              </template>
              <template v-else>
                <ul>
                  <li class="menu-text">
                    Not signed in
                  </li>
                  <li class="menu-line">
                    <hr>
                  </li>
                  <li class="menu-btn" @click="signInClicked">
                    Sign in to Semiphemeral to access paid features
                  </li>
                </ul>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="main-content col">
        <template v-if="showManageAccount">
          <ManageAccountView />
        </template>
        <template v-else>
          <AccountView v-for="account in accounts" :key="account.id" :account="account"
            :class="{ 'hide': activeAccountId !== account.id }" @account-selected="accountSelected" />
        </template>
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

.sidebar-btn {
  width: 40px;
  height: 40px;
  font-size: 25px;
  border-radius: 30%;
  cursor: pointer;
}

.add-account-btn {
  color: #ffffff;
  background-color: #000000;
  opacity: 0.3;
  border-radius: 50%;
}

.add-account-btn:hover {
  opacity: 0.6;
}

.user-btn {
  color: #000000;
  background-color: #ffffff;
  opacity: 0.6;
}

.user-btn:hover {
  opacity: 0.9;
}

.info-popup {
  bottom: 4px;
  left: 45px;
}

.menu-popup {
  bottom: 4px;
  left: 45px;
}

.hide {
  display: none;
}
</style>