<script setup lang="ts">
import type { ButtonInfo } from '../../types';

defineProps<{
    backButtons: ButtonInfo[];
    nextButtons: ButtonInfo[];
}>();
</script>

<template>
    <nav class="buttons d-flex align-items-center mt-2 justify-content-end">
        <div class="d-flex gap-2">
            <button v-for="(button, index) in backButtons" :key="index" class="btn btn-secondary text-nowrap"
                @click="button.action">
                <i v-if="button.icon" :class="button.icon" />
                {{ button.label }}
            </button>
            <button v-for="(button, index) in nextButtons" :key="index" class="btn btn-primary text-nowrap"
                @click="button.action">
                <i v-if="button.icon" :class="button.icon" />
                {{ button.label }}
            </button>
        </div>
    </nav>
</template>

<style scoped></style>
