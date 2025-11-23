<script setup lang="ts">
import { IpcRendererEvent } from "electron";
import {
  ref,
  Ref,
  inject,
  onMounted,
  onUnmounted,
  getCurrentInstance,
} from "vue";
import { useI18n } from "vue-i18n";
import { openURL } from "../../util";
import type { DeviceInfo } from "../../types";
import CydAPIClient from "../../../../cyd-api-client";
import { UserPremiumAPIResponse } from "../../../../cyd-api-client";

const { t } = useI18n();

const apiClient = inject("apiClient") as Ref<CydAPIClient>;
const deviceInfo = inject("deviceInfo") as Ref<DeviceInfo | null>;

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// User variables
const userAuthenticated = ref(false);
const userPremium = ref(false);
const userHasBusinessSubscription = ref(false);

const premiumClicked = async () => {
  if (!userAuthenticated.value) {
    emitter?.emit("show-sign-in");
    return;
  }
  emitter?.emit("show-manage-account");
};

const teamsClicked = async () => {
  if (!userAuthenticated.value) {
    emitter?.emit("show-sign-in");
    return;
  }
  emitter?.emit("show-manage-account-teams");
};

const donateClicked = () => {
  openURL("https://opencollective.com/lockdown-systems");
};

const collectiveClicked = () => {
  openURL("https://lockdown.systems/");
};

const openSourceClicked = () => {
  openURL("https://github.com/lockdown-systems/cyd");
};

const refreshPremium = async () => {
  // Check if the user is authenticated
  userAuthenticated.value =
    (await apiClient.value.ping()) && deviceInfo.value?.valid ? true : false;

  // Check if the user has premium access
  if (userAuthenticated.value) {
    let userPremiumResp: UserPremiumAPIResponse;
    const resp = await apiClient.value.getUserPremium();
    if (resp && "error" in resp === false) {
      userPremiumResp = resp;
      console.log("User premium response:", userPremiumResp);
      userPremium.value = userPremiumResp.premium_access;
      userHasBusinessSubscription.value =
        userPremiumResp.has_business_subscription;
    } else {
      console.error(`Error getting user premium status: ${resp}`);
      userPremium.value = false;
    }
  } else {
    userPremium.value = false;
  }
};

const cydOpenEventName = "cydOpen";
const isLoading = ref(false);

onMounted(async () => {
  isLoading.value = true;
  await refreshPremium();
  isLoading.value = false;

  emitter?.on("signed-in", refreshPremium);
  emitter?.on("signed-out", refreshPremium);

  // If the user clicks "Open Cyd" from the Cyd dashboard website, it should open Cyd and refresh premium here
  window.electron.ipcRenderer.on(
    cydOpenEventName,
    async (_event: IpcRendererEvent, _queryString: string) => {
      await refreshPremium();
    },
  );
});

onUnmounted(async () => {
  window.electron.ipcRenderer.removeAllListeners(cydOpenEventName);
});
</script>

<template>
  <div v-if="!isLoading" class="upsell">
    <div v-if="userPremium">
      <h1 class="text-center">
        {{ t('upsell.thanksForSupporting') }}
        <img src="/assets/wordmark.svg" class="cyd-wordmark" alt="Cyd" />!
      </h1>
      <p class="text-center text-muted small mb-0">
        <template v-if="userHasBusinessSubscription">
          Cyd is <a href="#" @click="openSourceClicked">{{ t('upsell.openSource') }}</a> and made by a
          <a href="#" @click="collectiveClicked">{{ t('upsell.collective') }}</a>.
          {{ t('upsell.thanksForPremium') }} If you'd like to support us even more,
          <a href="#" @click="donateClicked">{{ t('upsell.donation') }}</a>.
        </template>
        <template v-else>
          Cyd is <a href="#" @click="openSourceClicked">{{ t('upsell.openSource') }}</a> and made by a
          <a href="#" @click="collectiveClicked">{{ t('upsell.collective') }}</a>.
          {{ t('upsell.thanksForPremium') }} {{ t('upsell.premiumForTeamsQuestion') }}
          <a
            href="#"
            @click="openURL('https://docs.cyd.social/docs/cyd-for-teams/intro')"
            >{{ t('upsell.teamsLink') }}</a
          >. {{ t('upsell.andIfYouLikeToSupport') }}
          <a href="#" @click="donateClicked">{{ t('upsell.donation') }}</a>.
        </template>
      </p>
    </div>
    <div v-else>
      <div class="container">
        <div class="row">
          <div class="col-md-4 flex justify-between items-center">
            <h1 class="text-center text-nowrap">
              {{ t('upsell.support') }}
              <img src="/assets/wordmark.svg" class="cyd-wordmark" alt="Cyd" />!
            </h1>
          </div>
          <div class="col-md-8 flex align-items-start">
            <p class="text-start text-muted small">
              Cyd is <a href="#" @click="openSourceClicked">{{ t('upsell.openSource') }}</a> and
              made by a
              <a href="#" @click="collectiveClicked">{{ t('upsell.collective') }}</a
              >. {{ t('upsell.waysToSupport') }}
            </p>
          </div>
        </div>
      </div>

      <div class="container">
        <div class="row">
          <div class="col-md-5 upsell-col">
            <button
              class="card premium-card text-center"
              @click="premiumClicked"
            >
              <div class="card-header">{{ t('upsell.upgradeToPremium') }}</div>
              <div class="card-body small">
                <p>
                  {{ t('upsell.premiumDescription') }}
                </p>
                <p class="fw-bold text-center mb-0 action-text">
                  <template v-if="!userAuthenticated">
                    {{ t('upsell.signInToStart') }}
                  </template>
                  <template v-else> {{ t('upsell.upgradeToPremium') }} </template>
                </p>
              </div>
            </button>
          </div>
          <div class="col-md-5 upsell-col">
            <button class="card text-center" @click="teamsClicked">
              <div class="card-header">{{ t('upsell.cydForTeams') }}</div>
              <div class="card-body small">
                <p>
                  {{ t('upsell.teamsDescription') }}
                </p>
                <p class="fw-bold text-center mb-0 action-text">
                  <template v-if="!userAuthenticated">
                    {{ t('upsell.signInToStart') }}
                  </template>
                  <template v-else> {{ t('upsell.startATeam') }} </template>
                </p>
              </div>
            </button>
          </div>
          <div class="col-md-5 upsell-col">
            <button class="card text-center" @click="donateClicked">
              <div class="card-header">{{ t('upsell.donate') }}</div>
              <div class="card-body small">
                <p>{{ t('upsell.donateDescription') }}</p>
                <p class="fw-bold text-center mb-0 action-text">
                  {{ t('upsell.clickToDonate') }}
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upsell {
  max-width: 600px;
  margin: 0.2em auto;
  padding: 1em;
  border: 1px solid #198754;
  border-radius: 0.5em;
  background-color: #f5fffa;
}

.upsell .row {
  display: flex;
  align-items: stretch;
}

.upsell .upsell-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-left: calc(var(--bs-gutter-x) * 0.1);
  padding-right: calc(var(--bs-gutter-x) * 0.1);
}

.upsell .cyd-wordmark {
  height: 1em;
}

.upsell .card {
  border-radius: 0.5rem;
  cursor: pointer;
  flex: 1;
  padding: 0;
}

.upsell .card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.upsell .card-header {
  padding: 0.2em;
  font-weight: bold;
  width: 100%;
}

.upsell .card-body {
  padding: 0.5em 0.7em;
  text-align: left;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.upsell .card-body .action-text {
  margin-top: auto;
}

.upsell a {
  color: var(--bs-secondary-color);
  text-decoration: underline;
}

.upsell .premium-card {
  border-color: #198754;
  color: #12603b;
}
</style>
