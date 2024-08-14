<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { XProgress } from '../../../shared_types';

const intervalID = ref<number | null>(null);
const rateLimitSecondsLeft = ref<number | null>(null);

const props = defineProps<{
    progress: XProgress | null;
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

const archivedTweetsOpenFolder = async () => {
    await window.electron.X.openFolder(props.accountID, "Archived Tweets");
};

onMounted(() => {
    // @ts-expect-error intervalID is a NodeJS.Interval, not a number
    intervalID.value = setInterval(() => {
        if (props.progress && props.progress.isRateLimited && props.progress.rateLimitReset) {
            const rateLimitReset = props.progress?.rateLimitReset;
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
                <p v-if="progress.isRateLimited" class="rate-limit">
                    You have a hit a rate limit! <b>Waiting {{ formatSeconds(rateLimitSecondsLeft) }} to retry.</b>
                </p>
            </template>
            <!-- Index direct messages -->
            <template v-if="progress.currentJob == 'indexDMs'">
                <p>
                    Indexed
                    <b>{{ progress.dmUsersIndexed.toLocaleString() }} users</b> and
                    <b>{{ progress.dmConversationsIndexed.toLocaleString() }} conversations</b>.
                    <template v-if="progress.isIndexDMsFinished">
                        Indexing complete!
                    </template>
                </p>
                <p v-if="progress.isRateLimited" class="rate-limit">
                    You have a hit a rate limit! <b>Waiting {{ formatSeconds(rateLimitSecondsLeft) }} to retry.</b>
                </p>
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
                <p v-if="progress.isRateLimited" class="rate-limit">
                    You have a hit a rate limit! <b>Waiting {{ formatSeconds(rateLimitSecondsLeft) }} to retry.</b>
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
                    <button class="btn btn-primary" @click="archivedTweetsOpenFolder">
                        Open Folder
                    </button>
                </div>
            </template>
        </div>
    </template>
</template>

<style scoped>
.progress-wrapper {
    text-align: center;
    font-size: 0.8em;
    padding-bottom: 10px;
}

.progress-wrapper p {
    margin: 0;
}

.progress {
    height: 30px;
}

.rate-limit {
    color: red;
}
</style>