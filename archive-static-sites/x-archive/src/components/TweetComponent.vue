<script setup lang="ts">
import { defineProps } from 'vue'
import { formattedDatetime, formattedDate, formatDateToYYYYMMDD } from '../helpers'
import { Tweet } from '../types'

defineProps<{
    tweet: Tweet;
}>();
</script>

<template>
    <div class="tweet p-3 mb-3 border rounded">
        <div class="d-flex justify-content-between">
            <strong>{{ tweet.username }}</strong>
            <a v-if="tweet.archivedAt"
                :href="`./Archived Tweets/${formatDateToYYYYMMDD(tweet.createdAt)}_${tweet.tweetID}.html`"
                target="_blank">archived</a>
            <a :href="`https://x.com/${tweet.path}`" target="_blank">original</a>
            <small>{{ formattedDatetime(tweet.createdAt) }}</small>
        </div>
        <div class="mt-2">
            <p>{{ tweet.text }}</p>
        </div>
        <div class="d-flex mt-2 gap-3">
            <div>
                <i class="fa-solid fa-comment" /> {{ tweet.replyCount.toLocaleString() }} replies
            </div>
            <div>
                <i class="fa-solid fa-retweet" /> {{ tweet.retweetCount.toLocaleString() }} retweets
            </div>
            <div>
                <i class="fa-solid fa-heart" /> {{ tweet.likeCount.toLocaleString() }} likes
            </div>
        </div>
        <div class="meta d-flex gap-2">
            <span v-if="tweet.deletedAt" class="date text-muted ms-2">
                deleted {{ formattedDate(tweet.deletedAt) }}
            </span>
            <span v-if="tweet.archivedAt" class="date text-muted ms-2">
                archived {{ formattedDate(tweet.archivedAt) }}
            </span>
        </div>

    </div>
</template>

<style scoped>
.meta {
    font-size: 0.8rem;
}
</style>