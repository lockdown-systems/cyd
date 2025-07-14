<script setup lang="ts">
import { defineProps, inject, Ref } from "vue";
import { XArchive, Conversation } from "../types";
import UserComponent from "./UserComponent.vue";

defineProps<{
  conversation: Conversation;
  isSelected: boolean;
}>();

const archiveData = inject("archiveData") as Ref<XArchive>;
</script>

<template>
  <div
    class="conversation p-3 mb-3 border rounded"
    :class="isSelected ? 'selected' : ''"
  >
    <div class="d-flex flex-column gap-1">
      <template v-for="userID in conversation.participants" :key="userID">
        <UserComponent
          v-if="archiveData.users[userID].username != archiveData.username"
          :user="archiveData.users[userID]"
          :user-i-d="userID"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.conversation {
  overflow: hidden;
  cursor: pointer;
  transition: background-color 0.3s;
}

.conversation:hover {
  background-color: #f0f0f0;
}

.selected {
  background-color: #f0f0f0;
}
</style>
