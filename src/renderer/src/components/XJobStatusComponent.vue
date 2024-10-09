<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { XJob } from '../../../shared_types';

defineProps<{
    jobs: XJob[],
    isPaused: boolean
}>();

const emit = defineEmits(['onPause', 'onResume', 'onCancel']);

const runningIconIndex = ref(0);
const runningIcons = [
    'fa-solid fa-hourglass-start',
    'fa-solid fa-hourglass-half',
    'fa-solid fa-hourglass-end'
];

const runningIcon = computed(() => runningIcons[runningIconIndex.value]);

const getStatusIcon = (status: string) => {
    const statusIcons: { [key: string]: string } = {
        pending: 'fa-solid fa-ellipsis text-primary',
        finished: 'fa-solid fa-square-check text-success',
        canceled: 'fa-solid fa-circle-exclamation text-danger'
    };
    return statusIcons[status] || '';
};

const getJobTypeText = (jobType: string) => {
    const jobTypeTexts: { [key: string]: string } = {
        login: 'Logging in',
        indexTweets: 'Indexing tweets',
        indexLikes: 'Indexing likes',
        indexConversations: 'Indexing conversations',
        indexMessages: 'Indexing messages',
        archiveTweets: 'Archiving tweets',
        archiveBuild: 'Building archive',
        deleteTweets: 'Deleting tweets',
        deleteRetweets: 'Deleting retweets',
        deleteLikes: 'Deleting likes',
        deleteDMs: 'Deleting DMs'
    };
    return jobTypeTexts[jobType] || jobType;
};

const cycleRunningIcon = () => {
    runningIconIndex.value = (runningIconIndex.value + 1) % runningIcons.length;
};

let runningIconInterval: number | undefined;

onMounted(() => {
    // @ts-expect-error intervalID is a NodeJS.Interval, not a number
    runningIconInterval = setInterval(cycleRunningIcon, 1000);
});

onBeforeUnmount(() => {
    clearInterval(runningIconInterval);
});
</script>

<template>
    <div class="job-status-list">
        <div v-for="job in jobs" :key="job.id ?? 0" class="job-status-item d-flex align-items-center">
            <div class="status-icon me-2">
                <i v-if="job.status !== 'running'" :class="getStatusIcon(job.status)" />
                <i v-else-if="isPaused" class="fa-solid fa-pause" />
                <i v-else :class="runningIcon" />
            </div>
            <div class="job-type">
                {{ getJobTypeText(job.jobType) }}
            </div>
        </div>
        <div class="d-flex justify-content-center mt-2">
            <button v-if="!isPaused" class="btn btn-secondary btn-sm" @click="emit('onPause')">
                <i class="fa-solid fa-pause" /> Pause
            </button>
            <button v-if="isPaused" class="btn btn-primary btn-sm" @click="emit('onResume')">
                <i class="fa-solid fa-play" /> Resume
            </button>
            <button class="btn btn-danger btn-sm btn-cancel" @click="emit('onCancel')">
                <i class="fa-regular fa-circle-xmark" /> Cancel
            </button>
        </div>
    </div>
</template>

<style scoped>
.job-status-list {
    padding: 10px;
}

.job-status-item {
    display: flex;
    align-items: center;
}

.status-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.job-type {
    font-size: 16px;
}

.btn-cancel {
    margin-left: 5px;
}
</style>