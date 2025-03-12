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

const shouldShowText = computed(() => {
    if (!props.post.text) return false;
    if (!props.post.media || props.post.media.length === 0) return true;

    // Show text if it's different from all media descriptions
    return !props.post.media.some(media => media.description === props.post.text);
});
</script>

<template>
    <div class="post p-3 mb-3 border rounded">
        <div class="d-flex justify-content-between">
            <strong v-if="archiveData.username">{{ archiveData.username }}</strong>
            <small v-else class="text-muted">unknown user</small>
            <small v-if="post.isReposted" class="text-muted ms-2">
                <i class="bi bi-share"></i> repost
            </small>
            <a v-if="post.archivedAt"
                :href="`./Archived Posts/${formatDateToYYYYMMDD(post.createdAt)}_${post.postID}.html`"
                target="_blank">archived</a>
            <small v-if="post.createdAt">{{ formattedDatetime(post.createdAt) }}</small>
            <small v-else class="text-muted">unknown date</small>
        </div>
        <div class="mt-2">
            <!-- Text (only show if it's different from media description) -->
            <p v-if="shouldShowText" v-html="formattedText"></p>

            <!-- Media -->
            <div v-if="post.media" class="media-container mt-2">
                <div v-for="media in post.media" :key="media.mediaId" class="media-item mb-2">
                    <img v-if="media.type === 'photo'"
                         :src="`./media/${media.uri}`"
                         :alt="media.description || ''"
                         class="img-fluid rounded">
                    <video v-else-if="media.type === 'video'"
                           controls
                           class="w-100 rounded">
                        <source :src="`./media/${media.uri}`" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                    <p v-if="media.description" class="text-muted small mt-1">{{ media.description }}</p>
                </div>
            </div>

            <!-- URLs -->
            <div v-if="post.urls?.length" class="urls-container mt-2">
                <div v-for="urlData in post.urls" :key="urlData.url" class="url-item">
                    <a :href="urlData.url" target="_blank" rel="noopener noreferrer">
                        <i class="bi bi-link-45deg"></i>
                        {{ urlData.url }}
                    </a>
                </div>
            </div>
        </div>

        <div class="meta d-flex gap-2">
            <span v-if="post.archivedAt" class="date text-muted ms-2">
                archived {{ formattedDate(post.archivedAt) }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.media-container {
    max-width: 100%;
}
.media-item img,
.media-item video {
    max-height: 400px;
    object-fit: contain;
}

.url-item {
    margin: 0.5rem 0;
    word-break: break-all;
}

.url-item a {
    color: #0d6efd;
    text-decoration: none;
}

.url-item a:hover {
    text-decoration: underline;
}

.bi-link-45deg {
    margin-right: 0.3em;
}
</style>