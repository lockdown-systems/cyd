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

const startClicked = async () => {
    importStarted.value = true;

    // Verify that the archive is valid
    statusValidating.value = ImportStatus.Active;
    const resp: string | null = await window.electron.X.verifyXArchive(props.model.account.id, importFromArchivePath.value);
    if (resp !== null) {
        statusValidating.value = ImportStatus.Failed;
        errorMessage.value = resp;
        importFailed.value = true;
        return;
    }
    statusValidating.value = ImportStatus.Finished;
};

const importFromArchiveBrowserClicked = async () => {
    const path = await window.electron.showSelectFolderDialog();
    if (path) {
        importFromArchivePath.value = path;
    }
};

// Keep track of import status

const importFromArchivePath = ref('');
const errorMessage = ref('');

const importStarted = ref(false);
const importFinished = ref(false);
const importFailed = ref(false);

enum ImportStatus {
    Pending,
    Active,
    Finished,
    Failed
}

const statusValidating = ref(ImportStatus.Pending);
const statusImportingTweets = ref(ImportStatus.Pending);
const statusImportingLikes = ref(ImportStatus.Pending);
const statusImportingDMGroups = ref(ImportStatus.Pending);
const statusImportingDMs = ref(ImportStatus.Pending);

const iconFromStatus = (status: ImportStatus) => {
    switch (status) {
        case ImportStatus.Pending:
            return 'fa-solid fa-ellipsis text-primary';
        case ImportStatus.Active:
            return 'fa-solid fa-hourglass-half';
        case ImportStatus.Finished:
            return 'fa-solid fa-square-check text-success';
        case ImportStatus.Failed:
            return 'fa-solid fa-circle-exclamation text-danger';
    }
};

</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <h2>
            Import your X archive
        </h2>
        <p class="text-muted">
            <template v-if="!importStarted">
                Unzip your archive and choose the folder that it's in.
            </template>
            <template v-else>
                Importing your archive...
            </template>
        </p>

        <template v-if="!importStarted">
            <div class="input-group">
                <input v-model="importFromArchivePath" type="text" class="form-control"
                    placeholder="Import your X archive" readonly>
                <button class="btn btn-secondary" @click="importFromArchiveBrowserClicked">
                    Browse for Archive
                </button>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="importFromArchivePath == ''"
                    @click="startClicked">
                    <i class="fa-solid fa-forward" />
                    Start Import
                </button>
            </div>
        </template>
        <template v-else>
            <ul class="import-status">
                <li :class="statusValidating == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusValidating)]" />
                    Validating X archive
                </li>
                <li :class="statusImportingTweets == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusImportingTweets)]" />
                    Importing tweets
                </li>
                <li :class="statusImportingLikes == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusImportingLikes)]" />
                    Importing likes
                </li>
                <li :class="statusImportingDMGroups == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusImportingDMGroups)]" />
                    Importing direct message groups
                </li>
                <li :class="statusImportingDMs == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusImportingDMs)]" />
                    Importing one-to-one direct messages
                </li>
            </ul>

            <template v-if="importFinished">
                <div class="alert alert-success mt-3">
                    <i class="fa-solid fa-check" />
                    Import finished successfully!
                </div>
                <div class="buttons">
                    <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                        <i class="fa-solid fa-backward" />
                        Back
                    </button>
                </div>
            </template>
            <template v-if="importFailed">
                <div class="alert alert-danger mt-3">
                    <strong>Import failed.</strong> {{ errorMessage }}
                </div>
                <div class="buttons">
                    <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                        <i class="fa-solid fa-backward" />
                        Back
                    </button>
                </div>
            </template>
        </template>
    </div>
</template>

<style scoped>
ul.import-status {
    list-style-type: none;
    padding: 1rem 3rem;
}

ul.import-status li {
    margin-bottom: 0.5rem;
}

ul.import-status li i {
    margin-right: 0.5rem;
}
</style>