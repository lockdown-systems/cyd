<script setup lang="ts">
import { Ref, defineProps, inject } from 'vue'
import { XArchive, Conversation } from '../types'
import UserComponent from './UserComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;

defineProps<{
    conversation: Conversation;
    isSelected: boolean;
}>();
</script>

<template>
    <div class="conversation p-3 mb-3 border rounded" :class="isSelected ? 'selected' : ''">
        <div class="d-flex flex-column gap-1">
            <UserComponent v-for="userID in conversation.participants" :key="userID"
                :user="archiveData.users[userID]" />
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