<script setup lang="ts">
const props = defineProps<{
    accountID: number;
}>();

const openArchiveFolder = async () => {
    await window.electron.X.openFolder(props.accountID, "");
};

const openArchive = async () => {
    await window.electron.X.openFolder(props.accountID, "index.html");
};
</script>

<template>
    <p class="d-flex gap-2">
        <button class="btn btn-success btn-sm" @click="openArchive">
            Browse Archive
        </button>

        <button class="btn btn-secondary btn-sm" @click="openArchiveFolder">
            Open Folder
        </button>
    </p>
</template>

<style scoped></style>