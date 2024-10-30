<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { XProgress, XRateLimitInfo } from '../../../shared_types';

const intervalID = ref<number | null>(null);
const rateLimitSecondsLeft = ref<number | null>(null);

const props = defineProps<{
    progress: XProgress | null;
    rateLimitInfo: XRateLimitInfo | null;
    accountID: number;
}>();

const formatSeconds = (seconds: number | null) => {
    if (seconds === null) {
        return '';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes == 0) {
        return `${remainingSeconds} seconds`;
    }
    return `${minutes} minutes, ${remainingSeconds} seconds`;
};

onMounted(() => {
    // @ts-expect-error intervalID is a NodeJS.Interval, not a number
    intervalID.value = setInterval(() => {
        if (props.rateLimitInfo && props.rateLimitInfo.isRateLimited && props.rateLimitInfo.rateLimitReset) {
            const rateLimitReset = props.rateLimitInfo.rateLimitReset;
            const currentUTCTimestamp = Math.floor(Date.now() / 1000);
            rateLimitSecondsLeft.value = rateLimitReset - currentUTCTimestamp;
            if (rateLimitSecondsLeft.value <= 0) {
                rateLimitSecondsLeft.value = 0;
            }
        }
    }, 1000);
});

onUnmounted(() => {
    if (intervalID.value) {
        clearInterval(intervalID.value);
    }
});
</script>

<template>
    <template v-if="progress">
        <div class="progress-wrapper">
            <!-- Login -->
            <template v-if="progress.currentJob == 'login'">
                <p>Logging in</p>
            </template>

            <!-- Index tweets -->
            <template v-if="progress.currentJob == 'indexTweets'">
                <p>
                    Indexed
                    <b>{{ progress.tweetsIndexed.toLocaleString() }} tweets</b> and
                    <b>{{ progress.retweetsIndexed.toLocaleString() }} retweets</b>.
                    <template v-if="progress.isIndexTweetsFinished">
                        Indexing complete!
                    </template>
                </p>
            </template>

            <!-- Index conversations -->
            <template v-if="progress.currentJob == 'indexConversations'">
                <p>
                    Indexed
                    <b>{{ progress.conversationsIndexed.toLocaleString() }} conversations</b>.
                    <template v-if="progress.isIndexConversationsFinished">
                        Indexing complete!
                    </template>
                </p>
            </template>

            <!-- Index messages -->
            <template v-if="progress.currentJob == 'indexMessages'">
                <p v-if="progress.totalConversations">
                    Indexed <b>{{ progress.messagesIndexed.toLocaleString() }} messages</b> from <b>{{
                        progress.conversationMessagesIndexed.toLocaleString() }} out of {{
                            progress.totalConversations.toLocaleString() }} conversations</b>.
                    <template v-if="progress.isIndexMessagesFinished">
                        Indexing complete!
                    </template>
                </p>
                <div v-if="progress.totalConversations" class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.conversationMessagesIndexed / progress.totalConversations) * 100}%` }"
                            :aria-valuenow="(progress.conversationMessagesIndexed / progress.totalConversations) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.conversationMessagesIndexed / progress.totalConversations) * 100)
                            }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Index likes -->
            <template v-if="progress.currentJob == 'indexLikes'">
                <p>
                    Indexed
                    <b>{{ progress.likesIndexed.toLocaleString() }} likes</b>.
                    <template v-if="progress.isIndexLikesFinished">
                        Indexing complete!
                    </template>
                </p>
            </template>

            <!-- Archive Tweets -->
            <template v-if="progress.currentJob == 'archiveTweets'">
                <p>
                    Archived
                    <b>{{ progress.tweetsArchived.toLocaleString() }} out of
                        {{ progress.totalTweetsToArchive.toLocaleString() }} tweets</b>.
                    <template v-if="progress.isArchiveTweetsFinished">
                        Finished archiving tweets!
                    </template>
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.tweetsArchived / progress.totalTweetsToArchive) * 100}%` }"
                            :aria-valuenow="(progress.tweetsArchived / progress.totalTweetsToArchive) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.tweetsArchived / progress.totalTweetsToArchive) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete Tweets -->
            <template v-if="progress.currentJob == 'deleteTweets'">
                <p>
                    Deleted
                    <b>{{ progress.tweetsDeleted.toLocaleString() }} out of
                        {{ progress.totalTweetsToDelete.toLocaleString() }} tweets</b>.
                    <template v-if="progress.isDeleteTweetsFinished">
                        Finished deleting tweets!
                    </template>
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.tweetsDeleted / progress.totalTweetsToDelete) * 100}%` }"
                            :aria-valuenow="(progress.tweetsDeleted / progress.totalTweetsToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.tweetsDeleted / progress.totalTweetsToDelete) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete Retweets -->
            <template v-if="progress.currentJob == 'deleteRetweets'">
                <p>
                    Deleted
                    <b>{{ progress.retweetsDeleted.toLocaleString() }} out of
                        {{ progress.totalRetweetsToDelete.toLocaleString() }} retweets</b>.
                    <template v-if="progress.isDeleteRetweetsFinished">
                        Finished deleting retweets!
                    </template>
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.retweetsDeleted / progress.totalRetweetsToDelete) * 100}%` }"
                            :aria-valuenow="(progress.retweetsDeleted / progress.totalRetweetsToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.retweetsDeleted / progress.totalRetweetsToDelete) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete Likes -->
            <template v-if="progress.currentJob == 'deleteLikes'">
                <p>
                    Deleted
                    <b>{{ progress.likesDeleted.toLocaleString() }} out of
                        {{ progress.totalLikesToDelete.toLocaleString() }} likes</b>.
                    <template v-if="progress.isDeleteLikesFinished">
                        Finished deleting likes!
                    </template>
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.likesDeleted / progress.totalLikesToDelete) * 100}%` }"
                            :aria-valuenow="(progress.likesDeleted / progress.totalLikesToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.likesDeleted / progress.totalLikesToDelete) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete DMs -->
            <template v-if="progress.currentJob == 'deleteDMs'">
                <p>
                    Deleted
                    <b>{{ progress.conversationsDeleted.toLocaleString() }} out of
                        {{ progress.totalConversationsToDelete.toLocaleString() }} conversations</b> and <b>{{
                            progress.messagesDeleted.toLocaleString() }} out of
                        {{ progress.totalMessagesToDelete.toLocaleString() }} messages</b>.
                    <template v-if="progress.isDeleteDMsFinished">
                        Finished deleting direct messages!
                    </template>
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.conversationsDeleted / progress.totalConversationsToDelete) * 100}%` }"
                            :aria-valuenow="(progress.conversationsDeleted / progress.totalConversationsToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.conversationsDeleted / progress.totalConversationsToDelete) * 100)
                            }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Build archive -->
            <template v-if="progress.currentJob == 'archiveBuild'">
                <p>Building archive website</p>
            </template>

            <!-- Rate Limit -->
            <p v-if="rateLimitInfo?.isRateLimited" class="rate-limit">
                You have hit a rate limit! <b>Waiting {{ formatSeconds(rateLimitSecondsLeft) }} to retry.</b>
            </p>
        </div>
    </template>
</template>

<style scoped>
.progress-wrapper {
    text-align: center;
    font-size: 0.8em;
    border-top: 1px solid #d0d0d0;
    margin-top: 5px;
    padding-top: 8px;
    margin-bottom: 10px;
}

.progress-wrapper p {
    margin: 0;
}

.progress {
    height: 20px;
}

.rate-limit {
    color: red;
}
</style>