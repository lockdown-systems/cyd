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
            <button v-for="(button, index) in backButtons" :key="'back-' + index" class="btn btn-secondary text-nowrap"
                :class="button.hide ? 'hidden' : ''" :disabled="button.disabled" @click="button.action">
                <i class="fa-solid fa-backward" />
                {{ button.label }}
            </button>
            <button v-for="(button, index) in nextButtons" :key="'next-' + index" class="btn text-nowrap" :class="[
                button.dangerStyle ? 'btn-danger' : 'btn-primary',
                button.hide ? 'hidden' : ''
            ]" :disabled="button.disabled" @click="button.action">
                <i class="fa-solid fa-forward" />
                {{ button.label }}
            </button>
        </div>
    </nav>
</template>

<style scoped>
.hidden {
    display: none;
}
</style>
