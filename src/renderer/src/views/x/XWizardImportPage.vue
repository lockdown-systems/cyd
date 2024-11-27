<script setup lang="ts">
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';

// Props
const props = defineProps<{
    model: AccountXViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

// Buttons

const downloadClicked = async () => {
    await props.model.defineJobsDownloadArchive();
    emit('setState', State.RunJobs);
};

const importClicked = async () => {
    emit('setState', State.WizardImportOptions);
};

const backClicked = async () => {
    emit('setState', State.WizardImportOrBuild);
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

            <div class="buttons mb-4">
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    model.account?.xAccount?.archiveTweets ||
                    model.account?.xAccount?.archiveLikes ||
                    model.account?.xAccount?.archiveDMs)" @click="downloadClicked">
                    <i class="fa-solid fa-download" />
                    Help Me Download My Archive
                </button>
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    model.account?.xAccount?.archiveTweets ||
                    model.account?.xAccount?.archiveLikes ||
                    model.account?.xAccount?.archiveDMs)" @click="importClicked">
                    <i class="fa-solid fa-folder-tree" />
                    I Have My Archive
                </button>
            </div>

            <XLastImportOrBuildComponent :account-i-d="model.account.id" :button-text="'Go to Delete Options'"
                :button-state="State.WizardDeleteOptions" @set-state="emit('setState', $event)" />

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Import or Build Database
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped></style>