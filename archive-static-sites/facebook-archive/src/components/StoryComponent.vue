<script setup lang="ts">
import { defineProps, computed } from 'vue'
import { formattedDatetime, formattedDate, formatDateToYYYYMMDD, newslinesToBrs } from '../helpers'
import { Story } from '../types'
import MediaComponent from './MediaComponent.vue';

const props = defineProps<{
    story: Story;
}>();

const formattedText = computed(() => {
    const text = props.story.text ? props.story.text : '';
    return newslinesToBrs(text);
});

const formattedAttachedStoryText = computed(() => {
    const text = props.story.attachedStory?.text ? props.story.attachedStory.text : '';
    return newslinesToBrs(text);
});
</script>

<template>
    <div class="post p-3 mb-3 border rounded">
        <div class="d-flex justify-content-between">
            <strong>{{ story.user.name }}</strong>
            <a v-if="story.archivedAt"
                :href="`./Archived Posts/${formatDateToYYYYMMDD(story.createdAt)}_${story.storyID}.html`"
                target="_blank">archived</a>
            <a v-if="story.url" :href="story.url" target="_blank">original</a>
            <small v-if="story.createdAt">{{ formattedDatetime(story.createdAt) }}</small>
            <small v-else class="text-muted">unknown date</small>
        </div>
        <div class="mt-2">
            <!-- Display title (like "Chase Westbrook updated his cover photo.") -->
            <h3 v-if="story.title">{{ story.title }}</h3>

            <!-- Display life event (like "Born on February 12, 1983") -->
            <h3 v-if="story.lifeEventTitle">{{ story.lifeEventTitle }}</h3>

            <!-- Text -->
            <p v-if="story.text" v-html="formattedText"></p>

            <!-- Attached story -->
            <div v-if="story.attachedStory" class="attached-story">
                <span class="badge bg-secondary text-light">Attached Story</span>
                <div class="attached-story-item p-1 border rounded">
                    <p v-if="story.attachedStory.text" :html="formattedAttachedStoryText"></p>
                    <div v-if="story.attachedStory.media" class="media-container mt-2">
                        <div v-for="media in story.attachedStory.media" :key="media.mediaID" class="mb-2">
                            <MediaComponent :media="media" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Media -->
            <div v-if="story.media" class="media-container mt-2">
                <div v-for="media in story.media" :key="media.mediaID" class="mb-2">
                    <MediaComponent :media="media" />
                </div>
            </div>

            <!-- TODO: Shares -->
        </div>

        <div class="meta d-flex gap-2">
            <span v-if="story.archivedAt" class="date text-muted ms-2">
                archived {{ formattedDate(story.archivedAt) }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.media-container {
    max-width: 100%;
}
</style>
