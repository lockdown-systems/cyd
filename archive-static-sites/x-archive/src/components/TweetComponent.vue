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
            <strong v-if="tweet.username">{{ tweet.username }}</strong>
            <small v-else class="text-muted">unknown user</small>
            <a v-if="tweet.archivedAt"
                :href="`./Archived Tweets/${formatDateToYYYYMMDD(tweet.createdAt)}_${tweet.tweetID}.html`"
                target="_blank">archived</a>
            <a :href="`https://x.com/${tweet.path}`" target="_blank">original</a>
            <small v-if="tweet.createdAt">{{ formattedDatetime(tweet.createdAt) }}</small>
            <small v-else class="text-muted">unknown date</small>
        </div>
        <div class="mt-2">
            <p>{{ tweet.text }}</p>
        </div>
        <div v-if="tweet.replyCount != undefined || tweet.retweetCount != undefined || tweet.likeCount != undefined"
            class="d-flex mt-2 gap-3">
            <div v-if="tweet.replyCount != undefined">
                <i class="fa-solid fa-comment" /> {{ tweet.replyCount.toLocaleString() }} replies
            </div>
            <div v-if="tweet.retweetCount != undefined">
                <i class="fa-solid fa-retweet" /> {{ tweet.retweetCount.toLocaleString() }} retweets
            </div>
            <div v-if="tweet.likeCount != undefined">
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