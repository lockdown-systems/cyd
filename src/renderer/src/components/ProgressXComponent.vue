<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { XProgress } from '../../../shared_types';

const intervalID = ref<number | null>(null);
const rateLimitSecondsLeft = ref<number | null>(null);

const props = defineProps<{
    progress: XProgress | null;
}>();

const formatSeconds = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes == 0) {
        return `${remainingSeconds} seconds`;
    }
    return `${minutes} minutes, ${remainingSeconds} seconds`;
};

onMounted(() => {
    intervalID.value = setInterval(() => {
        if (props.progress && props.progress.isRateLimited) {
            const currentUTCTimestamp = Math.floor(Date.now() / 1000);
            rateLimitSecondsLeft.value = props.progress.rateLimitReset - currentUTCTimestamp;
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
            <!-- Index -->
            <template v-if="progress.currentJob == 'index'">
                <p>
                    Indexed
                    <b>{{ progress.tweetsIndexed.toLocaleString() }} tweets</b> and
                    <b>{{ progress.retweetsIndexed.toLocaleString() }} retweets</b>.
                    <template v-if="progress.isIndexFinished">
                        Indexing complete!
                    </template>
                </p>
                <p v-if="progress.isRateLimited" class="rate-limit">
                    You have a hit a rate limit! <b>Waiting {{ formatSeconds(rateLimitSecondsLeft) }} to retry.</b>
                </p>
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

.rate-limit {
    color: red;
}
</style>