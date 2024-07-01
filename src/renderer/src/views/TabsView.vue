<script setup lang="ts">
import { inject, Ref, ref, onMounted, onUnmounted } from 'vue';
import AccountButton from '../components/AccountButton.vue';
import AccountView from './AccountView.vue';
import ServerAPI from '../ServerAPI';
import type { DeviceInfo } from '../types';
import type { Account } from '../../../shared_types';

const addAccountBtnShowInfo = ref(false);
const userBtnShowInfo = ref(false);
const userBtnShowMenu = ref(false);
const accounts = ref<Account[]>([]);
const activeAccountId = ref<number | null>(null);

const serverApi = inject('serverApi') as Ref<ServerAPI>;
const deviceInfo = inject('deviceInfo') as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject('refreshDeviceInfo') as () => Promise<void>;
const showSettings = inject('showSettings') as () => void;

const emit = defineEmits(['onSignOff']);

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

const accountSelected = (account: Account, accountType: string) => {
  // TODO: Create a new account of the right type. Probably need to implement a new preloader function to do this.
  console.log('Account selected:', account, accountType);
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

const settingsClicked = async () => {
  userBtnShowMenu.value = false;
  showSettings()
};

const signOutClicked = async () => {
  if (deviceInfo.value === null) {
    window.electron.showError('Cannot sign out without device info');
    return;
  }

  // Delete the device
  const deleteDeviceResp = await serverApi.value.deleteDevice({
    // this API route takes either a UUID or a device token
    uuid: deviceInfo.value.deviceToken
  });
  if (deleteDeviceResp !== undefined && deleteDeviceResp.error) {
    console.log("Error deleting device", deleteDeviceResp.message)
  }

  // Sign out
  const logoutResp = await serverApi.value.logout();
  if ("error" in logoutResp && logoutResp.error) {
    console.log("Error logging out", logoutResp.message);
  }

  // Delete the device from the local storage
  await window.electron.setConfig("apiToken", "");
  await window.electron.setConfig("deviceToken", "");
  await window.electron.setConfig("deviceUUID", "");

  // Refresh the device info
  await refreshDeviceInfo();

  // Sign off
  emit('onSignOff');
};

onMounted(async () => {
  accounts.value = await window.electron.getAccounts();
  if (accounts.value.length === 0) {
    await addAccountClicked();
  } else {
    activeAccountId.value = accounts.value[0].id;
  }

  document.addEventListener('click', outsideUserMenuClicked);
});

onUnmounted(async () => {
  document.removeEventListener('click', outsideUserMenuClicked);
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
            <div ref="userMenuBtnEl" class="user-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="userBtnShowInfo = true" @mouseleave="userBtnShowInfo = false" @click="userMenuClicked">
              <i class="fa-solid fa-user-ninja" />
            </div>
            <div v-if="userBtnShowInfo" class="info-popup">
              You are signed in as {{ deviceInfo?.userEmail }}
            </div>
            <div v-if="userBtnShowMenu" ref="userMenuPopupEl" class="user-menu-popup">
              <ul>
                <li class="menu-text">
                  Signed in as {{ deviceInfo?.userEmail }}
                </li>
                <li class="menu-line">
                  <hr>
                </li>
                <li class="menu-btn" @click="settingsClicked">
                  Settings
                </li>
                <li class="menu-btn" @click="signOutClicked">
                  Sign out
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="main-content col">
        <AccountView v-for="account in accounts" :key="account.id" :account="account"
          :class="{ 'hide': activeAccountId !== account.id }" @account-selected="accountSelected" />
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

.sidebar .user-menu-popup {
  position: absolute;
  bottom: 4px;
  left: 45px;
  background-color: #333333;
  color: #ffffff;
  border: 1px solid #111111;
  padding: 10px;
  border-radius: 4px;
  white-space: nowrap;
}

.sidebar .user-menu-popup ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.sidebar .user-menu-popup ul li {
  padding: 3px 6px;
}

.sidebar .user-menu-popup ul li.menu-text {
  color: #999999;
}

.sidebar .user-menu-popup ul li.menu-line hr {
  margin: 5px 0;
}

.sidebar .user-menu-popup ul li.menu-btn {
  cursor: pointer;
}

.sidebar .user-menu-popup ul li.menu-btn:hover {
  background-color: #555555;

}

.hide {
  display: none;
}
</style>