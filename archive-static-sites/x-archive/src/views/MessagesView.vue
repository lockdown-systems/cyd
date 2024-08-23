<script setup lang="ts">
import { Ref, inject, ref, computed } from 'vue'
import { XArchive } from '../types'
import ConversationComponent from '../components/ConversationComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;

const selectedConversationID = ref(null);
const conversationFilterText = ref('');
const messageFilterText = ref('');

const filteredConversations = computed(() => {
  return archiveData.value.conversations.filter(conversation =>
    conversation.participantSearchString.toLowerCase().includes(conversationFilterText.value.toLowerCase())
  );
});

const filteredMessages = computed(() => {
  return archiveData.value.messages.filter(message =>
    message.text.toLowerCase().includes(messageFilterText.value.toLowerCase()) && message.conversationID === selectedConversationID.value ? selectedConversationID.value : ''
  );
});
</script>

<template>
  <div class="container">
    <div class="row">
      <div class="col-md-5">
        <div class="conversations">
          <div class="mb-3">
            <input type="text" v-model="conversationFilterText" class="form-control"
              placeholder="Filter your conversations">
          </div>

          <p>Showing {{ filteredConversations.length.toLocaleString() }} conversations</p>

          <ConversationComponent v-for="conversation in filteredConversations" :key="conversation.conversationID"
            :conversation="conversation" />
        </div>
      </div>

      <div class="col-md-7">
        <div class="messages">
          <div class="mb-3">
            <input type="text" v-model="messageFilterText" class="form-control" placeholder="Filter your messages">
          </div>

          <p>Showing {{ filteredMessages.length.toLocaleString() }} messages</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>