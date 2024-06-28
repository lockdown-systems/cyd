<script setup lang="ts">
import type { Account } from '../../../shared_types';

defineProps<{
  account: Account;
}>();
</script>

<template>
  <div>
    <p class="lead">
      With Semiphemeral, you can automatically delete your data in tech platforms, except for
      what you want to keep.
    </p>
    <div class="p-3">
      <p>Ready to get started? Choose a platform.</p>
    </div>
  </div>
</template>

<style scoped></style>