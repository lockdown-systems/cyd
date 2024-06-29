<script setup lang="ts">
import type { Account } from '../../../shared_types';

const props = defineProps<{
  account: Account;
}>();

const emit = defineEmits<{
  accountSelected: [account: Account, accountType: string]
}>()

const accountClicked = (accountType: string) => {
  emit('accountSelected', props.account, accountType);
};
</script>

<template>
  <div class="mt-3 bt-3 br-3">
    <template v-if="account.type == 'unknown'">
      <p class="lead">
        With Semiphemeral, you can automatically delete your data in tech platforms, except for
        what you want to keep.
      </p>
      <p class="lead fw-bold">
        Ready to get started? Choose a platform.
      </p>

      <div class="select-account d-flex flex-wrap">
        <div class="card m-2" @click="accountClicked('X')">
          <div class="card-body d-flex align-items-center">
            <div class="logo mr-2">
              <i class="fa-brands fa-x-twitter" />
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
    </template>

    <template v-else-if="account.type == 'X'">
      <p>Placeholder for X</p>
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