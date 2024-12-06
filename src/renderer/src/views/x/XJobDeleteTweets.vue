<script setup lang="ts">
import { ref, watch } from 'vue';
import { AccountXViewModel } from '../../view_models/AccountXViewModel'
import { formattedDatetime } from '../../util';

import { XTweetItem } from '../../../../shared_types';

// Props
const props = defineProps<{
    model: AccountXViewModel;
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
                <strong>
                    @{{ model.account.xAccount?.username }}
                </strong>
                <small>
                    {{ formattedDatetime(tweetItem.d) }}
                </small>
            </div>
            <div class="mt-4 fs-3">
                <p>{{ tweetItem.t }}</p>
            </div>
            <div class="d-flex mt-4 gap-3 justify-content-center align-items-center">
                <div>
                    <i class="fa-solid fa-retweet" /> {{ tweetItem.r.toLocaleString() }} retweets
                </div>
                <div>
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