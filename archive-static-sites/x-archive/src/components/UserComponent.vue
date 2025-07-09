<script setup lang="ts">
import { defineProps } from "vue";
import { User } from "../types";

defineProps<{
  userID: string;
  user: User | undefined;
}>();
</script>

<template>
  <div v-if="user" class="user">
    <span class="avatar"
      ><img :src="user.profileImageDataURI" alt="Avatar"
    /></span>
    <span class="name">{{ user.name }}</span>
    <span class="username">@{{ user.username }}</span>
  </div>
  <div v-else>
    <span>{{ userID }}</span>
  </div>
</template>

<style scoped>
.user {
  display: flex;
  align-items: center;
}

.avatar img {
  border-radius: 50%;
  overflow: hidden;
  margin-right: 8px;
  width: 32px;
  height: 32px;
}

.name {
  font-weight: bold;
  margin-right: 8px;
}

.username {
  color: #777;
  font-size: 0.9em;
}
</style>
