<script setup lang="ts">
import { ref, watch } from 'vue';
import { XViewModel, RunJobsState } from '../../view_models/XViewModel'
import { formattedDatetime } from '../../util';

import { XTweetItem } from '../../../../shared_types';

// Props
const props = defineProps<{
    model: XViewModel;
    mediaPath: string;
}>();

const imageDataURIs = ref<string[]>([]);

// Keep tweetItem updated
const tweetItem = ref<XTweetItem | null>(null);
watch(
    () => props.model.currentTweetItem,
    async (newCurrentTweetItem) => {
        if (newCurrentTweetItem) {
            tweetItem.value = newCurrentTweetItem;

            // Get data URIs for images
            imageDataURIs.value = [];
            for (const image of tweetItem.value.i) {
                imageDataURIs.value.push(await window.electron.getImageDataURIFromFile(`${props.mediaPath}/${image}`));
            }
        }
    },
    { deep: true, }
);

const getImageClass = (_index: number) => {
    if (imageDataURIs.value.length === 1) {
        return 'col-12 d-flex justify-content-center';
    } else if (imageDataURIs.value.length === 2) {
        return 'col-6';
    } else if (imageDataURIs.value.length === 3 || imageDataURIs.value.length === 4) {
        return 'col-6 col-md-6';
    }
    return 'col-6 col-md-4';
};
</script>

<template>
    <div class="parent d-flex justify-content-center align-items-start">
        <div v-if="tweetItem" class="tweet p-5">
            <div class="d-flex gap-3 justify-content-center align-items-center">
                <strong v-if="model.runJobsState == RunJobsState.DeleteTweets">
                    @{{ model.account.xAccount?.username }}
                </strong>
                <small v-if="tweetItem.d">
                    {{ formattedDatetime(tweetItem.d) }}
                </small>
            </div>
            <div v-if="tweetItem.t" class="mt-4 fs-3">
                <p class="tweet-text" v-html="tweetItem.t" />
            </div>
            <div v-else class="mt-4 fs-3">
                <p>Tweet ID: {{ tweetItem.id }}</p>
            </div>
            <div v-if="imageDataURIs.length > 0" class="mt-1 row images-container">
                <div v-for="(dataURI, index) in imageDataURIs" :key="dataURI" :class="getImageClass(index)">
                    <img :src="dataURI" class="img-fluid tweet-image">
                </div>
            </div>
            <div v-if="tweetItem.v.length > 0" class="mt-1 row">
                <div class="d-flex justify-content-center align-items-center">
                    <div class="video-placeholder d-flex justify-content-center align-items-center">
                        <span>Video Placeholder</span>
                    </div>
                </div>
            </div>
            <div v-if="model.runJobsState == RunJobsState.DeleteTweets"
                class="d-flex mt-4 gap-3 justify-content-center align-items-center">
                <div v-if="tweetItem.r">
                    <i class="fa-solid fa-retweet" /> {{ tweetItem.r.toLocaleString() }} retweets
                </div>
                <div v-if="tweetItem.l">
                    <i class="fa-solid fa-heart" /> {{ tweetItem.l.toLocaleString() }} likes
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.parent {
    height: 100%;
}

.tweet {
    text-align: center;
    margin-bottom: 100px;
}

.tweet-text {
    word-wrap: break-word;
    overflow-wrap: anywhere;
    text-align: left;
}

.images-container {
    overflow-y: auto;
}

.tweet-image {
    max-width: 100%;
    max-height: 400px;
    object-fit: cover;
}

.video-placeholder {
    width: 400px;
    height: 300px;
    background-color: #e9ecef;
    border: 2px dashed #6c757d;
    color: #6c757d;
    font-size: 1.5rem;
    text-align: center;
}
</style>