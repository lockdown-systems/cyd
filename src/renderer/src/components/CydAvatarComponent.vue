<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';

defineProps({
    height: {
        type: Number,
        default: 200,
    }
});

const stance = ref('plain');
const isBlinking = ref(false);
const isLooking = ref(false);

const imageUrl = computed(() => {
    let filename = `./cyd-${stance.value}`;
    if (isBlinking.value) {
        filename = `${filename}-blink`;
    }
    if (isLooking.value) {
        filename = `${filename}-look`;
    }
    return new URL(`${filename}.svg`, import.meta.url).href;
});

onMounted(async () => {
    // Change the stance every 3 to 8 seconds
    setTimeout(async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 5000));
            const random = Math.floor(Math.random() * 5);
            if (random == 0) {
                stance.value = 'plain';
            } else if (random == 1) {
                stance.value = 'akimbo';
            } else if (random == 2) {
                stance.value = 'wing';
            } else if (random == 3) {
                stance.value = 'point';
            } else {
                stance.value = 'shrug';
            }
        }
    }, 1);

    // Blink or look every 3 to 8 seconds
    setTimeout(async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 5000));
            if (Math.floor(Math.random() * 2) == 0) {
                isBlinking.value = true;
                setTimeout(() => {
                    isBlinking.value = false;
                }, 500);
            } else {
                setTimeout(() => {
                    isLooking.value = false;
                }, 500);
                isLooking.value = true;
            }
        }
    }, 1);
});
</script>

<template>
    <div>
        <img :src="imageUrl" :height="height" alt="Cyd">
    </div>
</template>

<style scoped></style>