<script setup lang="ts">
import { defineProps, computed, inject, Ref } from 'vue'
import { formattedDatetime, formattedDate, formatDateToYYYYMMDD } from '../helpers'
import { FacebookArchive, Post } from '../types'

const props = defineProps<{
    post: Post;
}>();

const archiveData = inject('archiveData') as Ref<FacebookArchive>;

const formattedText = computed(() => {
    let text = props.post.text;
    text = text.replace(/(?:\r\n|\r|\n)/g, '<br>');
    return text.trim();
});
</script>

<template>
    <div class="post p-3 mb-3 border rounded">
        <div class="d-flex justify-content-between">
            <strong v-if="archiveData.username">{{ archiveData.username }}</strong>
            <small v-else class="text-muted">unknown user</small>
            <a v-if="post.archivedAt"
                :href="`./Archived Posts/${formatDateToYYYYMMDD(post.createdAt)}_${post.postID}.html`"
                target="_blank">archived</a>
            <small v-if="post.createdAt">{{ formattedDatetime(post.createdAt) }}</small>
            <small v-else class="text-muted">unknown date</small>
        </div>
        <div class="mt-2">
            <!-- Text -->
            <p v-html="formattedText"></p>
        </div>
        <div class="meta d-flex gap-2">
            <span v-if="post.archivedAt" class="date text-muted ms-2">
                archived {{ formattedDate(post.archivedAt) }}
            </span>
        </div>

    </div>
</template>

<style scoped>
.meta {
    font-size: 0.8rem;
}
</style>