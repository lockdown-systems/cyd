<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AccountXView from './x/AccountXView.vue';
import { getAccountIcon } from '../util';
import type { Account } from '../../../shared_types';

import { getAccountRunning, setAccountRunning } from '../util';

import CydAvatarComponent from './shared_components/CydAvatarComponent.vue';

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits<{
  accountSelected: [account: Account, accountType: string],
  onRemoveClicked: []
}>()

const isRefreshing = ref(false);

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

onMounted(async () => {
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
          <CydAvatarComponent :height="200" />
        </div>
        <p class="lead">
          With <img src="/assets/wordmark.svg" class="cyd-wordmark" alt="Cyd">, you can automatically delete your data
          in tech platforms, except for what you want to keep.
        </p>
        <p class="lead fw-bold">
          Ready to get started? Add a new account.
        </p>

        <div class="select-account select-account-x d-flex flex-wrap" @click="accountClicked('X')">
          <div class="card m-2">
            <div class="card-body d-flex align-items-center">
              <div class="logo mr-2">
                <i :class="getAccountIcon('X')" />
              </div>
              <div class="description">
                <div class="name">
                  X
                </div>
                <div class="info text-muted">
                  Formerly Twitter, owned by Elon Musk
                </div>
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
    </template>

    <template v-else>
      <p>Unknown account type. Something is wrong.</p>
    </template>
  </div>
</template>

<style scoped>
.cyd-avatar {
  width: 150px;
}

.cyd-wordmark {
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

.select-account .description .name {
  font-size: 1.2rem;
  font-weight: bold;
}

.select-account .description .info {
  font-size: 1rem;
}
</style>