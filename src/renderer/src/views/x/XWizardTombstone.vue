<script setup lang="ts">
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'

// Props
defineProps<{
    model: XViewModel;
}>();

// Emits
defineEmits<{
    setState: [value: State]
}>()

// Buttons
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Hello, darkness, my old friend
            </h2>
            <p class="text-muted">
                It's time to move on from X. How can I help you?
            </p>

            <div class="buttons mb-4">
                <p>todo: add buttons</p>
            </div>
        </div>
    </div>
</template>

<style scoped>
</style>
