<script setup lang="ts">
import { ref, onMounted } from "vue";

const currentYear = new Date().getFullYear();
const appVersion = ref("");

defineProps<{
    shouldShow: boolean;
}>();

onMounted(async () => {
    appVersion.value = await window.electron.getVersion();
});
</script>

<template>
    <div v-if="shouldShow" class="d-flex flex-column justify-content-between vh-100">
        <div class="d-flex justify-content-center align-items-center flex-grow-1">
            <div class="text-center">
                <div>
                    <img src="/avatar-tmkf.svg" alt="Cyd Logo" class="kills-fascists">
                </div>
            </div>
        </div>
        <div class="text-center">
            <p class="text-muted">
                <img src="/logotext.svg" class="cyd-logotext mr-2" alt="Cyd">
                version {{ appVersion }}
            </p>
            <p class="text-muted">
                Copyright © Lockdown Systems LLC {{ currentYear }}
            </p>
        </div>
    </div>
</template>

<style scoped>
.kills-fascists {
    width: 300px;
}

.cyd-logotext {
    height: 2em;
}
</style>