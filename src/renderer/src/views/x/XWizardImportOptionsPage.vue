<script setup lang="ts">
import {
    ref,
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'

// Props
const props = defineProps<{
    model: AccountXViewModel;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
}>()

// Buttons

const backClicked = async () => {
    emit('setState', State.WizardImportStart);
};

const nextClicked = async () => {
    // Verify that the archive is valid
    const resp: string | null = await window.electron.X.verifyXArchive(props.model.account.id, importFromArchivePath.value);
    if (resp == null) {
        console.log('Archive is valid')
        // TODO: import it
        return;
    } else {
        console.log('Archive is invalid', resp)
        await window.electron.showError(resp);
        return;
    }
};

const importFromArchiveBrowserClicked = async () => {
    const path = await window.electron.showSelectFolderDialog();
    if (path) {
        importFromArchivePath.value = path;
    }
};

// Settings
const importFromArchivePath = ref('');
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <h2>
            Import options
        </h2>
        <p class="text-muted">
            Unzip your archive and choose the folder that it's in.
        </p>

        <div class="input-group">
            <input v-model="importFromArchivePath" type="text" class="form-control" placeholder="Import your X archive"
                readonly>
            <button class="btn btn-secondary" @click="importFromArchiveBrowserClicked">
                Browse for Archive
            </button>
        </div>

        <div class="buttons">
            <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                <i class="fa-solid fa-backward" />
                Back
            </button>

            <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                model.account?.xAccount?.archiveTweets ||
                model.account?.xAccount?.archiveLikes ||
                model.account?.xAccount?.archiveDMs)" @click="nextClicked">
                <i class="fa-solid fa-forward" />
                Start Import
            </button>
        </div>
    </div>
</template>

<style scoped></style>