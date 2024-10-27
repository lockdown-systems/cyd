<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AccountXView from './AccountXView.vue';
import { getAccountIcon } from '../util';
import type { Account } from '../../../shared_types';

import { setAccountRunning } from '../util';

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
  const platform = await window.electron.getPlatform();
  let url: string;
  if (platform === 'darwin') {
    url = 'https://semiphemeral.com/docs-disable-sleep-in-macos/';
  } else if(platform == 'win32') {
    url = 'https://semiphemeral.com/docs-disable-sleep-in-windows/';
  } else if(platform == 'linux') {
    url = 'https://semiphemeral.com/docs-disable-sleep-in-linux/';
  } else {
    url = 'https://semiphemeral.com/';
  }
  await window.electron.openURL(url);
};

const preventSleepDontShowAgain = async () => {
  showPreventSleepMessage.value = false;
  await window.electron.database.setConfig("showPreventSleepMessage", "false");
};

const preventSleepDismiss = async () => {
  showPreventSleepMessage.value = false;
};

onMounted(async () => {
  const showPreventSleepMessageConfig = await window.electron.database.getConfig("showPreventSleepMessage");
  if(showPreventSleepMessageConfig === null) {
    showPreventSleepMessage.value = true;
    await window.electron.database.setConfig("showPreventSleepMessage", "true");
  } else if(showPreventSleepMessageConfig == "true") {
    showPreventSleepMessage.value = true;
  } else {
    showPreventSleepMessage.value = false;
  }
});
</script>

<template>
  <div v-if="!isRefreshing">
    <template v-if="account.type == 'unknown'">
      <div class="container mt-5">
        <div class="text-center">
          <img src="/logo.png" class="logo mb-3" alt="Semiphemeral Bird" style="width: 120px;">
        </div>
        <p class="lead">
          With Semiphemeral, you can automatically delete your data in tech platforms, except for
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

      <div v-if="showPreventSleepMessage" class="prevent-sleep">
        <p>You must disable sleep on your computer while running Semiphemeral or it will get interrupted.</p>
        <ul>
          <li class="fw-bold"><a href="#" @click="preventSleepLearnMore">Learn more</a></li>
          <li><a href="#" @click="preventSleepDontShowAgain">Don't show this again</a></li>
          <li><a href="#" @click="preventSleepDismiss">Dismiss</a></li>
        </ul>
      </div>
    </template>

    <template v-else>
      <p>Unknown account type. Something is wrong.</p>
    </template>
  </div>
</template>

<style scoped>
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
  ;
}

.prevent-sleep {
  border: 1px solid #666;
  background-color: #f0f0f0;
  padding: 10px;
  text-align: right;
  height: 70px;
  width: 700px;
  position: absolute;
  bottom: 10px;
  right: 10px;
  z-index: 1;
}

.prevent-sleep p {
  margin: 0;
}

.prevent-sleep ul {
  list-style-type: none;
  padding: 0;
}

.prevent-sleep li {
  display: inline;
  margin-left: 20px;
}
</style>