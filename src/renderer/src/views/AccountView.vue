<script setup lang="ts">
import { ref } from 'vue'
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

const refresh = () => {
  await setAccountRunning(props.account.id, false);
  isRefreshing.value = true;
  setTimeout(() => {
    isRefreshing.value = false;
  }, 1);
};

const accountClicked = (accountType: string) => {
  emit('accountSelected', props.account, accountType);
};
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
</style>