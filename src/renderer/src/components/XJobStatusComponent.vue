<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineProps } from 'vue';
import type { XJob } from '../../../shared_types';

defineProps<{ jobs: XJob[] }>();

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
        indexDirectMessages: 'Indexing DMs',
        archiveTweets: 'Archiving tweets',
        archiveDirectMessages: 'Archiving DMs',
        deleteTweets: 'Deleting tweets',
        deleteLikes: 'Deleting likes',
        deleteDirectMessages: 'Deleting DMs'
    };
    return jobTypeTexts[jobType] || '';
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
        <div v-for="job in jobs" :key="job.id ?? 0" class="job-status-item d-flex align-items-center mb-2">
            <div class="status-icon me-2">
                <i v-if="job.status !== 'running'" :class="getStatusIcon(job.status)" />
                <i v-else :class="runningIcon" />
            </div>
            <div class="job-type">
                {{ getJobTypeText(job.jobType) }}
            </div>
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
</style>