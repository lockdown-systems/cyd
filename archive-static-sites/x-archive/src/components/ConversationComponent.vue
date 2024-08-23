<script setup lang="ts">
import { Ref, defineProps, inject } from 'vue'
import { XArchive, Conversation } from '../types'
import UserComponent from './UserComponent.vue'

const archiveData = inject('archiveData') as Ref<XArchive>;

defineProps<{
    conversation: Conversation;
}>();
</script>

<template>
    <div class="conversation p-3 mb-3 border rounded">
        <div class="d-flex flex-column gap-1">
            <UserComponent v-for="userID in conversation.participants" :key="userID"
                :user="archiveData.users[userID]" />
        </div>
    </div>
</template>

<style scoped>
.conversation {
    overflow: hidden;
}
</style>