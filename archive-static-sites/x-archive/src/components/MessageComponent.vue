<script setup lang="ts">
import { Ref, defineProps, inject } from "vue";
import { XArchive, Message } from "../types";
import { formattedDate, formattedDatetime } from "../helpers";

defineProps<{
  message: Message;
}>();

const archiveData = inject("archiveData") as Ref<XArchive>;
</script>

<template>
  <template
    v-if="
      archiveData.users[message.senderID] &&
      archiveData.users[message.senderID].username == archiveData.username
    "
  >
    <div class="message message-self d-flex align-items-start mb-3">
      <div class="content ms-auto me-2">
        <div class="message bg-primary text-light p-2 rounded-top rounded-end">
          {{ message.text }}
        </div>
        <div class="details">
          <span
            v-if="archiveData.users[message.senderID]"
            class="name fw-bold"
            >{{ archiveData.users[message.senderID].name }}</span
          >
          <span class="date text-muted ms-2">{{
            formattedDatetime(message.createdAt)
          }}</span>
        </div>
        <div v-if="message.deletedAt" class="details">
          <span class="date text-muted ms-2"
            >Deleted {{ formattedDate(message.deletedAt) }}</span
          >
        </div>
      </div>
      <div class="avatar">
        <img
          v-if="archiveData.users[message.senderID]"
          :src="archiveData.users[message.senderID].profileImageDataURI"
          alt="Avatar"
        />
      </div>
    </div>
  </template>
  <template v-else-if="archiveData.users[message.senderID]">
    <div class="message d-flex align-items-start mb-3">
      <div class="avatar">
        <img
          v-if="archiveData.users[message.senderID]"
          :src="archiveData.users[message.senderID].profileImageDataURI"
          alt="Avatar"
        />
      </div>
      <div class="content ms-2">
        <div class="message bg-light text-dark p-2 rounded-top rounded-end">
          {{ message.text }}
        </div>
        <div class="details">
          <span
            v-if="archiveData.users[message.senderID]"
            class="name fw-bold"
            >{{ archiveData.users[message.senderID].name }}</span
          >
          <span class="date text-muted ms-2">{{
            formattedDatetime(message.createdAt)
          }}</span>
        </div>
        <div v-if="message.deletedAt" class="details">
          <span class="date text-muted ms-2"
            >Deleted {{ formattedDate(message.deletedAt) }}</span
          >
        </div>
      </div>
    </div>
  </template>
  <template v-else>
    <div class="message d-flex align-items-start mb-3">
      <div class="content ms-2">
        <div class="message bg-light text-dark p-2 rounded-top rounded-end">
          {{ message.text }}
        </div>
        <div class="details">
          <span
            v-if="archiveData.users[message.senderID]"
            class="name fw-bold"
            >{{ archiveData.users[message.senderID].name }}</span
          >
          <span class="date text-muted ms-2">{{
            formattedDatetime(message.createdAt)
          }}</span>
        </div>
        <div v-if="message.deletedAt" class="details">
          <span class="date text-muted ms-2"
            >Deleted {{ formattedDate(message.deletedAt) }}</span
          >
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.avatar img {
  border-radius: 50%;
  overflow: hidden;
  width: 32px;
  height: 32px;
}

.content .details {
  font-size: 0.8em;
}

.message-self .details {
  text-align: right;
}
</style>
