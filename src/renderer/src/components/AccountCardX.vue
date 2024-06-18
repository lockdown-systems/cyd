<script setup lang="ts">
import type { XAccount } from '../types';
defineEmits(['clicked']);

defineProps<{
  account: XAccount;
}>();
</script>

<template>
  <div class="card m-2" @click="$emit('clicked')">
    <div class="card-body">
      <h6 class="card-title text-muted">
        <i class="fa-brands fa-square-x-twitter" /> X/Twitter
      </h6>
      <template v-if="account.username == null">
        <h5 class="card-subtitle mb-2 text-muted">
          not logged in yet
        </h5>
      </template>
      <template v-else>
        <h5 class="card-subtitle mb-2">
          @{{ account.username }}
        </h5>
      </template>
    </div>
  </div>
</template>

<style scoped>
.card {
  width: 18rem;
}

.card-title .title-color {
  color: #154b5d;
}

.card-body {
  cursor: pointer;
}

.card-body:hover {
  background-color: #bbe2f2;
}

.coming-soon {
  position: relative;
  filter: grayscale(100%);
  opacity: 0.6;
}

.coming-soon::after {
  content: "Coming Soon";
  position: absolute;
  bottom: 0;
  right: 0;
  width: auto;
  height: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-weight: bold;
  font-size: 1rem;
  padding: 5px 10px;
}
</style>