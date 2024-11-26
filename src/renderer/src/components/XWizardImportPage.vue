<script setup lang="ts">
import {
    AccountXViewModel,
    State
} from '../view_models/AccountXViewModel'

// Props
const props = defineProps<{
    model: AccountXViewModel | null;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    startStateLoop: []
}>()

// Buttons

const downloadClicked = async () => {
    await props.model?.defineJobsDownloadArchive();
    emit('setState', State.RunJobs);
    emit('startStateLoop');
};

const importClicked = async () => {
    emit('setState', State.WizardImportOptions);
    emit('startStateLoop');
};

const backClicked = async () => {
    emit('setState', State.WizardStart);
    emit('startStateLoop');
};
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Import your X archive
            </h2>
            <p class="text-muted">
                Before you can import your X archive, you need to download it. Have you already done
                this?
            </p>

            <div class="buttons">
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    model?.account.xAccount?.archiveTweets ||
                    model?.account.xAccount?.archiveLikes ||
                    model?.account.xAccount?.archiveDMs)" @click="downloadClicked">
                    <i class="fa-solid fa-download" />
                    Help Me Download My Archive from X
                </button>
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    model?.account.xAccount?.archiveTweets ||
                    model?.account.xAccount?.archiveLikes ||
                    model?.account.xAccount?.archiveDMs)" @click="importClicked">
                    <i class="fa-solid fa-folder-tree" />
                    I've Already Downloaded My Archive
                </button>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Start
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped></style>