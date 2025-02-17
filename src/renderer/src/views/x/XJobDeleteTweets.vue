<script setup lang="ts">
import { ref, watch } from 'vue';
import { XViewModel, RunJobsState } from '../../view_models/XViewModel'
import { formattedDatetime } from '../../util';

import { XTweetItem } from '../../../../shared_types';

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Keep tweetItem updated
const tweetItem = ref<XTweetItem | null>(null);
watch(
    () => props.model.currentTweetItem,
    (newCurrentTweetItem) => { if (newCurrentTweetItem) tweetItem.value = newCurrentTweetItem; },
    { deep: true, }
);
</script>

<template>
    <div class="parent d-flex justify-content-center align-items-center">
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
                <p>{{ tweetItem.t }}</p>
            </div>
            <div v-else class="mt-4 fs-3">
                <p>Tweet ID: {{ tweetItem.id }}</p>
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
</style>