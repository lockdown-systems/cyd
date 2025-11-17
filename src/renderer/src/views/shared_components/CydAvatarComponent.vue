<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from "vue";

defineProps({
  height: {
    type: Number,
    default: 200,
  },
});

const stance = ref("plain");
const isBlinking = ref(false);
const isLooking = ref(false);

const imageUrl = computed(() => {
  let filename = `cyd-${stance.value}`;
  if (isBlinking.value) {
    filename = `${filename}-blink`;
  }
  if (isLooking.value) {
    filename = `${filename}-look`;
  }

  if (import.meta.env.MODE === "production") {
    return new URL(`${filename}.svg`, import.meta.url).href;
  } else {
    return `/assets/${filename}.svg`;
  }
});

const activeTimeouts = new Set<ReturnType<typeof setTimeout>>();
const trackTimeout = (callback: () => void, delay: number) => {
  const timeout = setTimeout(() => {
    activeTimeouts.delete(timeout);
    callback();
  }, delay);
  activeTimeouts.add(timeout);
  return timeout;
};

let destroyed = false;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    trackTimeout(() => {
      resolve();
    }, ms);
  });

const runStanceLoop = async () => {
  while (!destroyed) {
    await wait(Math.random() * 3000 + 5000);
    if (destroyed) {
      break;
    }
    const random = Math.floor(Math.random() * 5);
    if (random === 0) {
      stance.value = "plain";
    } else if (random === 1) {
      stance.value = "akimbo";
    } else if (random === 2) {
      stance.value = "wing";
    } else if (random === 3) {
      stance.value = "point";
    } else {
      stance.value = "shrug";
    }
  }
};

const runBlinkLoop = async () => {
  while (!destroyed) {
    await wait(Math.random() * 3000 + 5000);
    if (destroyed) {
      break;
    }
    if (Math.floor(Math.random() * 2) === 0) {
      isBlinking.value = true;
      trackTimeout(() => {
        isBlinking.value = false;
      }, 500);
    } else {
      isLooking.value = true;
      trackTimeout(() => {
        isLooking.value = false;
      }, 500);
    }
  }
};

onMounted(async () => {
  runStanceLoop();
  runBlinkLoop();
});

onBeforeUnmount(() => {
  destroyed = true;
  activeTimeouts.forEach((timeout) => clearTimeout(timeout));
  activeTimeouts.clear();
});
</script>

<template>
  <div>
    <img :src="imageUrl" :height="height" alt="Cyd" />
  </div>
</template>

<style scoped></style>
