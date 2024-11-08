<script setup lang="ts">
import { inject, Ref, ref, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import AccountButton from '../components/AccountButton.vue';
import AccountView from './AccountView.vue';
import CydAPIClient from '../../../cyd-api-client';
import type { DeviceInfo } from '../types';
import type { Account } from '../../../shared_types';
import ManageAccountView from './ManageAccountView.vue';
import AboutView from './AboutView.vue';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const addAccountBtnShowInfo = ref(false);
const userBtnShowInfo = ref(false);
const userBtnShowMenu = ref(false);
const accounts = ref<Account[]>([]);
const activeAccountID = ref<number | null>(null);

const apiClient = inject('apiClient') as Ref<CydAPIClient>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;
const refreshAPIClient = inject('refreshAPIClient') as () => Promise<void>;

const hideAllAccounts = ref(false);
const showManageAccount = ref(false);

const showAbout = ref(false);

const accountClicked = async (account: Account) => {
  hideManageAccountView();
  hideAboutView();

  activeAccountID.value = account.id;

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
  hideManageAccountView();
  hideAboutView();

  // Do we already have an unknown account?
  const unknownAccount = accounts.value.find((account) => account.type === 'unknown');
  if (unknownAccount) {
    console.log('Already have an unknown account, setting it as active');
    activeAccountID.value = unknownAccount.id;
    return;
  }

  // Create a new account
  const account = await window.electron.database.createAccount();
  accounts.value = await window.electron.database.getAccounts();
  activeAccountID.value = account.id;
  console.log('Added new account', account);
};

const removeAccount = async (accountID: number) => {
  if (await window.electron.showQuestion(
    'Are you sure you want to remove this account from Cyd?',
    'Yes, remove it',
    'No, keep it'
  )) {
    console.log(`Removing account ${accountID}`);
    await window.electron.database.deleteAccount(accountID);
    accounts.value = await window.electron.database.getAccounts();

    if (accounts.value.length === 0) {
      console.log('No accounts left, adding an unknown account');
      await addAccountClicked();
    } else {
      console.log(`Setting active account to first account`);
      if (activeAccountID.value == accountID) {
        activeAccountID.value = accounts.value[0].id;
      }
    }

    console.log('Accounts after removing', JSON.parse(JSON.stringify(accounts.value)));
  }
}

const accountSelected = async (account: Account, accountType: string) => {
  hideManageAccountView();
  hideAboutView();

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

const showManageAccountView = () => {
  userBtnShowMenu.value = false;

  showManageAccount.value = true;
  showAbout.value = false;
  hideAllAccounts.value = true;
};

const hideManageAccountView = () => {
  showManageAccount.value = false;
  showAbout.value = false;
  hideAllAccounts.value = false;
};

emitter?.on('show-manage-account', showManageAccountView);

const manageAccountClicked = async () => {
  localStorage.setItem('manageAccountMode', 'manage');
  showManageAccountView();
};

const redirectToAccount = (accountID: number) => {
  // This forces the account to re-check if the user is signed in and if premium is enabled
  emitter?.emit('signed-in');

  activeAccountID.value = accountID;
  hideManageAccountView();
};

const showAboutView = () => {
  userBtnShowMenu.value = false;
  showManageAccount.value = false;
  showAbout.value = true;
  hideAllAccounts.value = true;
};

const hideAboutView = () => {
  showManageAccount.value = false;
  showAbout.value = false;
  hideAllAccounts.value = false;
};

const aboutClicked = async () => {
  showAboutView();
};

const signInClicked = async () => {
  localStorage.setItem('manageAccountMode', 'manage');
  emitter?.emit('show-sign-in');
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

  emitter?.emit('signed-out');

  hideManageAccountView();
};

const checkForUpdatesClicked = async () => {
  console.log('Checking for updates');
  await window.electron.checkForUpdates();
  userBtnShowMenu.value = false;
};

const advancedSettingsClicked = async () => {
  userBtnShowMenu.value = false;
  emitter?.emit('show-advanced-settings');
};

const reloadAccounts = async () => {
  accounts.value = await window.electron.database.getAccounts();
  console.log('Reloading accounts', JSON.parse(JSON.stringify(accounts.value)));
};

onMounted(async () => {
  await reloadAccounts();
  if (accounts.value.length === 0) {
    await addAccountClicked();
  } else {
    activeAccountID.value = accounts.value[0].id;
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
          <AccountButton v-for="account in accounts" :key="account.id"
            :class="['account-button', `account-button-${account.id}`]" :account="account"
            :active="account.id === activeAccountID" @click="accountClicked(account)"
            @on-remove-clicked="removeAccount(account.id)" />
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
              <i class="fa-solid fa-bars" />
            </div>
            <div v-if="userBtnShowInfo" class="info-popup">
              <template v-if="deviceInfo?.valid">
                You are signed in to Cyd as {{ deviceInfo?.userEmail }}
              </template>
              <template v-else>
                You are not signed in to Cyd
              </template>
            </div>
            <div v-if="userBtnShowMenu" ref="userMenuPopupEl" class="menu-popup">
              <ul>
                <template v-if="deviceInfo?.valid">
                  <li class="menu-text">
                    Signed in as {{ deviceInfo?.userEmail }}
                  </li>
                  <li class="menu-line">
                    <hr>
                  </li>
                  <li class="menu-btn" @click="manageAccountClicked">
                    Manage my Cyd account
                  </li>
                  <li class="menu-btn" @click="signOutClicked">
                    Sign out of my Cyd account
                  </li>
                </template>
                <template v-else>
                  <li class="menu-text">
                    Not signed in to Cyd
                  </li>
                  <li class="menu-line">
                    <hr>
                  </li>
                  <li class="menu-btn" @click="signInClicked">
                    Sign in to Cyd to access premium features
                  </li>
                </template>
                <li class="menu-line">
                  <hr>
                </li>
                <li class="menu-btn" @click="checkForUpdatesClicked">
                  Check for updates
                </li>
                <li class="menu-btn" @click="advancedSettingsClicked">
                  Advanced settings
                </li>
                <li class="menu-btn" @click="aboutClicked">
                  About
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="main-content col">
        <!-- Accounts -->
        <AccountView v-for="account in accounts" :key="account.id" :account="account"
          :class="{ 'hide': hideAllAccounts || activeAccountID !== account.id }" @account-selected="accountSelected"
          @on-remove-clicked="removeAccount(account.id)" />

        <!-- Manay my Cyd account -->
        <ManageAccountView :should-show="showManageAccount" @redirect-to-account="redirectToAccount" />

        <!-- About -->
        <AboutView :should-show="showAbout" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  height: 100vh;
  width: 66px;
  background-color: #3f5f8b;
  border-right: 3px solid #5885c4;
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