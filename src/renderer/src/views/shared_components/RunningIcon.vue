<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const runningIconIndex = ref(0);
const runningIcons = [
    'fa-solid fa-hourglass-start',
    'fa-solid fa-hourglass-half',
    'fa-solid fa-hourglass-end'
];

const runningIcon = computed(() => runningIcons[runningIconIndex.value]);

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
    <i :class="runningIcon" />
</template>
