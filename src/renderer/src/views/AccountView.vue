<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AccountXView from './AccountXView.vue';
import { getAccountIcon } from '../util';
import type { Account } from '../../../shared_types';

import { getAccountRunning, setAccountRunning, openPreventSleepURL } from '../util';

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits<{
  accountSelected: [account: Account, accountType: string],
  onRemoveClicked: []
}>()

const isRefreshing = ref(false);

const showPreventSleepMessage = ref(false);

const refresh = async () => {
  await setAccountRunning(props.account.id, false);
  isRefreshing.value = true;
  setTimeout(() => {
    isRefreshing.value = false;
  }, 1);
};

const accountClicked = (accountType: string) => {
  emit('accountSelected', props.account, accountType);
};

const preventSleepLearnMore = async () => {
  await openPreventSleepURL();
};

const preventSleepDontShowAgain = async () => {
  showPreventSleepMessage.value = false;
  await window.electron.database.setConfig("showPreventSleepMessage", "false");
};

const preventSleepDismiss = async () => {
  showPreventSleepMessage.value = false;
};

onMounted(async () => {
  // See if we should show the prevent sleep message
  const showPreventSleepMessageConfig = await window.electron.database.getConfig("showPreventSleepMessage");
  if (showPreventSleepMessageConfig === null) {
    showPreventSleepMessage.value = true;
    await window.electron.database.setConfig("showPreventSleepMessage", "true");
  } else if (showPreventSleepMessageConfig == "true") {
    showPreventSleepMessage.value = true;
  } else {
    showPreventSleepMessage.value = false;
  }

  // Check if this account was already running and got interrupted
  if (await getAccountRunning(props.account.id)) {
    console.error('Account was running and got interrupted');
    await setAccountRunning(props.account.id, false);
  }
});
</script>

<template>
  <div v-if="!isRefreshing">
    <template v-if="account.type == 'unknown'">
      <div class="container mt-5">
        <div class="text-center mb-3">
          <img src="/avatar2.svg" class="cyd-avatar" alt="Cyd Avatar">
        </div>
        <p class="lead">
          With <img src="/logotext.svg" class="cyd-logotext" alt="Cyd">, you can automatically delete your data in tech
          platforms, except for
          what you want to keep.
        </p>
        <p class="lead fw-bold">
          Ready to get started? Choose a platform.
        </p>

        <div class="select-account select-account-x d-flex flex-wrap" @click="accountClicked('X')">
          <div class="card m-2">
            <div class="card-body d-flex align-items-center">
              <div class="logo mr-2">
                <i :class="getAccountIcon('X')" />
              </div>
              <div class="name">
                X (formerly Twitter)
              </div>
            </div>
          </div>
        </div>

        <p class="text-muted mt-3">
          More platforms coming soon.
        </p>
      </div>
    </template>

    <template v-else-if="account.type == 'X'">
      <AccountXView :account="account" @on-refresh-clicked="refresh" @on-remove-clicked="emit('onRemoveClicked')" />

      <div v-if="showPreventSleepMessage" class="prevent-sleep alert d-flex align-items-center">
        <div>
          <p class="mb-2">
            Your computer needs to be awake to use Cyd. Don't close the
            lid, keep it plugged in, and disable sleep while plugged in.
          </p>
          <p class="text-center">
            <span class="fw-bold"><a href="#" @click="preventSleepLearnMore">Learn more</a></span>
            <span><a href="#" @click="preventSleepDontShowAgain">Don't show this again</a></span>
            <span><a href="#" @click="preventSleepDismiss">Dismiss</a></span>
          </p>
        </div>
      </div>
    </template>

    <template v-else>
      <p>Unknown account type. Something is wrong.</p>
    </template>
  </div>
</template>

<style scoped>
.cyd-avatar {
  width: 130px;
}

.cyd-logotext {
  height: 1em;
}

.card:hover {
  cursor: pointer;
  background-color: #e8f7ff;
}

.select-account .logo {
  font-size: 3rem;
  background-color: #e0e0e0;
  border-radius: 20%;
  padding: 0 0.8rem;
}

.select-account .name {
  font-size: 1.2rem;
  font-weight: bold;
}

.prevent-sleep {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  font-size: 0.8em;
  min-width: 500px;
  background-color: #f8a81223;
  border-color: #f8a712;
}

.prevent-sleep p {
  margin: 0;
}

.prevent-sleep span a {
  margin: 0 10px;
  text-wrap: nowrap;
}
</style>