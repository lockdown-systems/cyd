<script setup lang="ts">
import {
    ref,
    getCurrentInstance,
    onMounted,
} from 'vue';
import {
    ArchiveInfo, emptyArchiveInfo
} from '../../../../shared_types';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    accountID: number;
    accountType: string;
}>();

// Keep archiveInfo in sync
const archiveInfo = ref<ArchiveInfo>(emptyArchiveInfo());
emitter?.on(`${props.accountType.toLowerCase()}-update-archive-info-${props.accountID}`, async () => {
    archiveInfo.value = await window.electron.archive.getInfo(props.accountID);
});

// Buttons
const openArchiveFolder = async () => {
    await window.electron.archive.openFolder(props.accountID, "");
};

const openArchive = async () => {
    await window.electron.archive.openFolder(props.accountID, "index.html");
};

onMounted(async () => {
    archiveInfo.value = await window.electron.archive.getInfo(props.accountID);
});
</script>

<template>
    <p v-if="archiveInfo.indexHTMLExists" class="d-flex gap-2 justify-content-center">
        <button class="btn btn-outline-success btn-sm" @click="openArchive">
            Browse Archive
        </button>

        <button class="btn btn-outline-secondary btn-sm" @click="openArchiveFolder">
            Open Folder
        </button>
    </p>
</template>

<style scoped></style>