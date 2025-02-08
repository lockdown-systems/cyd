<script setup lang="ts">
defineProps<{
    showBrowser: boolean;
    showAutomationNotice: boolean;
}>();
</script>

<template>
    <!-- Automation notice -->
    <p v-if="showBrowser && showAutomationNotice" class="text-muted text-center automation-notice">
        <i class="fa-solid fa-robot" /> I'm following your instructions. Feel free to switch windows and use
        your computer for other things.
    </p>

    <!-- Ready for input -->
    <p v-if="showBrowser && !showAutomationNotice" class="text-muted text-center ready-for-input">
        <i class="fa-solid fa-computer-mouse" /> Ready for input.
    </p>
</template>

<style scoped></style>