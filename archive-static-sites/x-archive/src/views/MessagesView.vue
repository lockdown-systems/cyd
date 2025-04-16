<script setup lang="ts">
import { Ref, inject, ref, computed } from 'vue'

import { XArchive } from '../types'
import ConversationComponent from '../components/ConversationComponent.vue'
import MessageComponent from '../components/MessageComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;

const selectedConversationID = ref<string | null>(null);
const conversationFilterText = ref('');
const messageFilterText = ref('');

const filteredConversations = computed(() => {
  return archiveData.value.conversations.filter(conversation =>
    conversation.participantSearchString.toLowerCase().includes(conversationFilterText.value.toLowerCase()) &&
    conversation.participants.length > 0
  );
});

const filteredMessages = computed(() => {
  return archiveData.value.messages.filter(message =>
    message.text.toLowerCase().includes(messageFilterText.value.toLowerCase()) &&
      message.conversationID === selectedConversationID.value ? selectedConversationID.value : ''
  );
});

const selectConversation = (conversationID: string) => {
  // If it's already selected, deselect it
  if (selectedConversationID.value === conversationID) {
    selectedConversationID.value = null;
    return;
  }
  selectedConversationID.value = conversationID;
};
</script>

<template>
  <div class="container">
    <div class="row">
      <div class="col-md-5">
        <div class="conversations-container">
          <div class="filter-container">
            <p><input type="text" v-model="conversationFilterText" class="form-control"
                placeholder="Filter your conversations"></p>
            <p class="text-center text-muted small">Showing {{ filteredConversations.length.toLocaleString() }}
              conversations</p>
          </div>

          <div class="items-list">
            <ConversationComponent v-for="conversation in filteredConversations" :key="conversation.conversationID"
              :conversation="conversation" :is-selected="selectedConversationID == conversation.conversationID"
              @click="selectConversation(conversation.conversationID)" />
          </div>
        </div>
      </div>

      <div class="col-md-7">
        <div class="messages-container">
          <div class="filter-container">
            <p><input type="text" v-model="messageFilterText" class="form-control" placeholder="Filter your messages">
            </p>
            <p class="text-center text-muted small">Showing {{ filteredMessages.length.toLocaleString() }} messages</p>
          </div>

          <div class="items-list">
            <MessageComponent v-for="message in filteredMessages" :key="message.messageID" :message="message" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conversations-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 150px);
  margin: 0 auto;
}

.messages-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 150px);
  margin: 0 auto;
}

.items-list {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0 20px;
}
</style>
