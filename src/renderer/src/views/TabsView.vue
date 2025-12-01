<script setup lang="ts">
import {
  inject,
  Ref,
  ref,
  onMounted,
  onUnmounted,
  getCurrentInstance,
} from "vue";
import { useI18n } from "vue-i18n";
import AccountButton from "./shared_components/AccountButton.vue";
import AccountView from "./AccountView.vue";
import CydAPIClient from "../../../cyd-api-client";
import type { DeviceInfo } from "../types";
import type { Account } from "../../../shared_types";
import AboutView from "./AboutView.vue";
import { openURL } from "../util";

const { t } = useI18n();

defineProps<{
  updatesAvailable: boolean;
}>();

const emit = defineEmits<{
  checkForUpdatesClicked: [];
}>();

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

const addAccountBtnShowInfo = ref(false);
const userBtnShowInfo = ref(false);
const userBtnShowMenu = ref(false);
const accounts = ref<Account[]>([]);
const activeAccountID = ref<number | null>(null);

const apiClient = inject("apiClient") as Ref<CydAPIClient>;
const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;
const refreshDeviceInfo = inject("refreshDeviceInfo") as () => Promise<void>;
const refreshAPIClient = inject("refreshAPIClient") as () => Promise<void>;

const hideAllAccounts = ref(false);

const showAbout = ref(false);

const accountClicked = async (account: Account) => {
  hideAboutView();

  activeAccountID.value = account.id;

  // If we clicked out of an unknown account, remove the unknown account
  if (account.type !== "unknown") {
    for (let i = 0; i < accounts.value.length; i++) {
      if (accounts.value[i].type === "unknown") {
        const accountIDToDelete = accounts.value[i].id;
        await window.electron.database.deleteAccount(accountIDToDelete);
        accounts.value = await window.electron.database.getAccounts();
        break;
      }
    }
  }
};

const addAccountClicked = async () => {
  hideAboutView();

  // Do we already have an unknown account?
  const unknownAccount = accounts.value.find(
    (account) => account.type === "unknown",
  );
  if (unknownAccount) {
    console.log("Already have an unknown account, setting it as active");
    activeAccountID.value = unknownAccount.id;
    return;
  }

  // Create a new account
  const account = await window.electron.database.createAccount();
  accounts.value = await window.electron.database.getAccounts();
  activeAccountID.value = account.id;
  console.log("Added new account", account);
};

const removeAccount = async (accountID: number) => {
  if (
    await window.electron.showQuestion(
      t("tabs.removeAccountConfirm"),
      t("tabs.yesRemoveIt"),
      t("tabs.noKeepIt"),
    )
  ) {
    console.log(`Removing account ${accountID}`);
    await window.electron.database.deleteAccount(accountID);
    accounts.value = await window.electron.database.getAccounts();

    if (accounts.value.length === 0) {
      console.log("No accounts left, adding an unknown account");
      await addAccountClicked();
    } else {
      console.log(`Setting active account to first account`);
      if (activeAccountID.value == accountID) {
        activeAccountID.value = accounts.value[0].id;
      }
    }

    console.log(
      "Accounts after removing",
      JSON.parse(JSON.stringify(accounts.value)),
    );
  }
};

const accountSelected = async (account: Account, accountType: string) => {
  hideAboutView();

  try {
    const newAccount = await window.electron.database.selectAccountType(
      account.id,
      accountType,
    );
    if (newAccount === null) {
      throw new Error("Failed to select account type");
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
};

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

const openDashboard = async () => {
  userBtnShowMenu.value = false;

  const dashURL = await window.electron.getDashURL();
  const nativeLoginURL = `${dashURL}/#/native-login/${deviceInfo.value?.userEmail}/${deviceInfo.value?.deviceToken}/manage`;
  openURL(nativeLoginURL);
};

emitter?.on("show-manage-account", openDashboard);

const openCydForTeams = async () => {
  userBtnShowMenu.value = false;

  const dashURL = await window.electron.getDashURL();
  const nativeLoginURL = `${dashURL}/#/native-login/${deviceInfo.value?.userEmail}/${deviceInfo.value?.deviceToken}/teams`;
  openURL(nativeLoginURL);
};

emitter?.on("show-manage-account-teams", openCydForTeams);

const manageAccountClicked = async () => {
  openDashboard();
};

const showAboutView = () => {
  userBtnShowMenu.value = false;
  showAbout.value = true;
  hideAllAccounts.value = true;
};

const hideAboutView = () => {
  showAbout.value = false;
  hideAllAccounts.value = false;
};

const aboutClicked = async () => {
  showAboutView();
};

const signInClicked = async () => {
  emitter?.emit("show-sign-in");
};

const signOutClicked = async () => {
  if (deviceInfo.value === null) {
    window.electron.showError(t("tabs.cannotSignOutWithoutDeviceInfo"));
    return;
  }

  // Delete the logged in device
  const deleteDeviceResp = await apiClient.value.deleteDevice({
    // this API route takes either a UUID or a device token
    uuid: deviceInfo.value.deviceToken,
  });
  if (deleteDeviceResp !== undefined && deleteDeviceResp.error) {
    console.log("Error deleting device", deleteDeviceResp.message);
  }

  // Delete the device from the local storage
  await window.electron.database.setConfig("userEmail", "");
  await window.electron.database.setConfig("apiToken", "");
  await window.electron.database.setConfig("deviceToken", "");
  await window.electron.database.setConfig("deviceUUID", "");

  // Refresh the device info and the API client
  await refreshDeviceInfo();
  await refreshAPIClient();

  userBtnShowMenu.value = false;

  emitter?.emit("signed-out");
};

const checkForUpdatesClicked = async () => {
  emit("checkForUpdatesClicked");
  userBtnShowMenu.value = false;
};

const advancedSettingsClicked = async () => {
  userBtnShowMenu.value = false;
  emitter?.emit("show-advanced-settings");
};

const reloadAccounts = async () => {
  accounts.value = await window.electron.database.getAccounts();
  console.log("Reloading accounts", JSON.parse(JSON.stringify(accounts.value)));
};

onMounted(async () => {
  await reloadAccounts();
  if (accounts.value.length === 0) {
    await addAccountClicked();
  } else {
    activeAccountID.value = accounts.value[0].id;
  }

  document.addEventListener("click", outsideUserMenuClicked);
  document.addEventListener("auxclick", outsideUserMenuClicked);

  emitter?.on("signed-in", openDashboard);
  emitter?.on("account-updated", reloadAccounts);
});

onUnmounted(async () => {
  document.removeEventListener("click", outsideUserMenuClicked);
  document.removeEventListener("auxclick", outsideUserMenuClicked);
});
</script>

<template>
  <div class="container-fluid">
    <div class="d-flex">
      <div class="sidebar col-auto d-flex flex-column gap-2">
        <div class="accounts-list flex-grow-1 d-flex flex-column gap-2 mt-3">
          <AccountButton
            v-for="account in accounts"
            :key="account.id"
            :class="['account-button', `account-button-${account.id}`]"
            :account="account"
            :active="account.id === activeAccountID"
            @click="accountClicked(account)"
            @on-remove-clicked="removeAccount(account.id)"
          />
        </div>

        <div class="btns-list d-flex flex-column gap-2 mb-3">
          <div class="btn-container">
            <div
              class="add-account-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="addAccountBtnShowInfo = true"
              @mouseleave="addAccountBtnShowInfo = false"
              @click="addAccountClicked"
            >
              <i class="fa-solid fa-plus" />
            </div>
            <div v-if="addAccountBtnShowInfo" class="info-popup">
              Add an account
            </div>
          </div>

          <div class="btn-container">
            <div
              ref="userMenuBtnEl"
              class="user-btn sidebar-btn d-flex justify-content-center align-items-center"
              @mouseover="userBtnShowInfo = true"
              @mouseleave="userBtnShowInfo = false"
              @click="userMenuClicked"
            >
              <i class="fa-solid fa-bars" />
            </div>
            <div v-if="userBtnShowInfo" class="info-popup">
              <template v-if="deviceInfo?.valid">
                You are signed in to Cyd as {{ deviceInfo?.userEmail }}
              </template>
              <template v-else> You are not signed in to Cyd </template>
            </div>
            <div
              v-if="userBtnShowMenu"
              ref="userMenuPopupEl"
              class="menu-popup"
            >
              <ul>
                <template v-if="deviceInfo?.valid">
                  <li class="menu-text">
                    Signed in as {{ deviceInfo?.userEmail }}
                  </li>
                  <li class="menu-line">
                    <hr />
                  </li>
                  <li class="menu-btn" @click="manageAccountClicked">
                    {{ t("tabs.manageMyAccount") }}
                  </li>
                  <li class="menu-btn" @click="signOutClicked">
                    {{ t("tabs.signOutOfAccount") }}
                  </li>
                </template>
                <template v-else>
                  <li class="menu-text">{{ t("tabs.notSignedIn") }}</li>
                  <li class="menu-line">
                    <hr />
                  </li>
                  <li class="menu-btn" @click="signInClicked">
                    {{ t("tabs.signInToAccessPremium") }}
                  </li>
                </template>
                <li class="menu-line">
                  <hr />
                </li>
                <li class="menu-btn" @click="checkForUpdatesClicked">
                  Check for updates
                </li>
                <li class="menu-btn" @click="advancedSettingsClicked">
                  Advanced settings
                </li>
                <li class="menu-btn" @click="aboutClicked">
                  {{ t("tabs.about") }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-grow-1">
        <!-- Accounts -->
        <AccountView
          v-for="account in accounts"
          :key="account.id"
          :account="account"
          :class="{ hide: hideAllAccounts || activeAccountID !== account.id }"
          @account-selected="accountSelected"
          @on-remove-clicked="removeAccount(account.id)"
        />

        <!-- About -->
        <AboutView :should-show="showAbout" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.container-fluid {
  padding-left: 0;
}

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
