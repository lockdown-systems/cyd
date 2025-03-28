<script setup lang="ts">
import {
    ref,
    getCurrentInstance,
    onMounted
} from 'vue';
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'
import { XImportArchiveResponse } from '../../../../shared_types'
import RunningIcon from '../shared_components/RunningIcon.vue'

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
}>()

// Keep track of platform
// Mac users can browse for both ZIP or unzipped folder at once, but Windows and Linux users need two separate buttons
const platform = ref('');

// Buttons
const backClicked = async () => {
    emit('setState', State.WizardImportStart);
};

const archiveClicked = async () => {
    emit('setState', State.WizardArchiveOptions);
};

const deleteClicked = async () => {
    emit('setState', State.WizardDeleteOptions);
};

const createCountString = (importCount: number, skipCount: number) => {
    if (importCount > 0 && skipCount > 0) {
        return `${importCount.toLocaleString()} imported, ${skipCount.toLocaleString()} already imported`;
    } else if (importCount > 0 && skipCount == 0) {
        return `${importCount.toLocaleString()} imported`;
    } else if (importCount == 0 && skipCount > 0) {
        return `${skipCount.toLocaleString()} already imported`;
    } else {
        return 'nothing imported';
    }
}

const startClicked = async () => {
    errorMessages.value = [];
    importStarted.value = true;
    let unzippedPath: string | null = null;
    let isZip: boolean = false;

    // Does importFromArchivePath end with .zip?
    if (!importFromArchivePath.value.endsWith('.zip')) {
        unzippedPath = importFromArchivePath.value;
    } else {
        // Unarchive the zip
        isZip = true;
        statusValidating.value = ImportStatus.Active;
        try {
            unzippedPath = await window.electron.X.unzipXArchive(props.model.account.id, importFromArchivePath.value);
        } catch (e) {
            statusValidating.value = ImportStatus.Failed;
            errorMessages.value.push(`${e}`);
            importFailed.value = true;
            return;
        }
        if (unzippedPath === null) {
            statusValidating.value = ImportStatus.Failed;
            errorMessages.value.push(unzippedPath);
            importFailed.value = true;
            return;
        }
    }

    // Verify that the archive is valid
    statusValidating.value = ImportStatus.Active;
    let verifyResp: string | null = null;
    try {
        verifyResp = await window.electron.X.verifyXArchive(props.model.account.id, unzippedPath);
    } catch (e) {
        statusValidating.value = ImportStatus.Failed;
        errorMessages.value.push(`${e}`);
        importFailed.value = true;
        await window.electron.X.deleteUnzippedXArchive(props.model.account.id, unzippedPath);
        return;
    }
    if (verifyResp !== null) {
        statusValidating.value = ImportStatus.Failed;
        errorMessages.value.push(verifyResp);
        importFailed.value = true;
        await window.electron.X.deleteUnzippedXArchive(props.model.account.id, unzippedPath);
        return;
    }
    statusValidating.value = ImportStatus.Finished;

    // Import tweets
    statusImportingTweets.value = ImportStatus.Active;
    const tweetsResp: XImportArchiveResponse = await window.electron.X.importXArchive(props.model.account.id, unzippedPath, 'tweets');
    tweetCountString.value = createCountString(tweetsResp.importCount, tweetsResp.skipCount);
    if (tweetsResp.status == 'error') {
        statusImportingTweets.value = ImportStatus.Failed;
        errorMessages.value.push(tweetsResp.errorMessage);
        importFailed.value = true;
    } else {
        statusImportingTweets.value = ImportStatus.Finished;
    }
    emitter.emit(`x-update-database-stats-${props.model.account.id}`);

    // Import likes
    statusImportingLikes.value = ImportStatus.Active;
    const likesResp: XImportArchiveResponse = await window.electron.X.importXArchive(props.model.account.id, unzippedPath, 'likes');
    likeCountString.value = createCountString(likesResp.importCount, likesResp.skipCount);
    if (likesResp.status == 'error') {
        statusImportingLikes.value = ImportStatus.Failed;
        errorMessages.value.push(likesResp.errorMessage);
        importFailed.value = true;
    } else {
        statusImportingLikes.value = ImportStatus.Finished;
    }
    emitter.emit(`x-update-database-stats-${props.model.account.id}`);

    // Build Cyd archive
    statusBuildCydArchive.value = ImportStatus.Active;
    try {
        await window.electron.X.archiveBuild(props.model.account.id);
    } catch (e) {
        statusBuildCydArchive.value = ImportStatus.Failed;
        errorMessages.value.push(`${e}`);
        importFailed.value = true;
        await window.electron.X.deleteUnzippedXArchive(props.model.account.id, unzippedPath);
        return;
    }
    emitter.emit(`x-update-archive-info-${props.model.account.id}`);
    statusBuildCydArchive.value = ImportStatus.Finished;

    // If we unarchived it, delete the unarchived folder whether it's success or fail
    if (isZip) {
        await window.electron.X.deleteUnzippedXArchive(props.model.account.id, unzippedPath);
    }

    // Success
    if (!importFailed.value) {
        await window.electron.X.setConfig(props.model.account.id, 'lastFinishedJob_importArchive', new Date().toISOString());
        importFinished.value = true;
    }

};

const importFromArchiveBrowseClicked = async () => {
    const path = await window.electron.showOpenDialog(true, true, [{ name: 'ZIP Archive', extensions: ['zip'] }]);
    if (path) {
        importFromArchivePath.value = path;
    }
};

const importFromArchiveBrowseZipClicked = async () => {
    const path = await window.electron.showOpenDialog(false, true, [{ name: 'ZIP Archive', extensions: ['zip'] }]);
    if (path) {
        importFromArchivePath.value = path;
    }
};

const importFromArchiveBrowseFolderClicked = async () => {
    const path = await window.electron.showOpenDialog(true, false, undefined);
    if (path) {
        importFromArchivePath.value = path;
    }
};

// Keep track of import status

const importFromArchivePath = ref('');
const errorMessages = ref();

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
const statusBuildCydArchive = ref(ImportStatus.Pending);

const tweetCountString = ref('');
const likeCountString = ref('');

const iconFromStatus = (status: ImportStatus) => {
    switch (status) {
        case ImportStatus.Pending:
            return 'fa-solid fa-ellipsis text-primary';
        case ImportStatus.Finished:
            return 'fa-solid fa-square-check text-success';
        case ImportStatus.Failed:
            return 'fa-solid fa-circle-exclamation text-danger';
    }
};

onMounted(async () => {
    platform.value = await window.electron.getPlatform();
});

</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <h2>
            Import your X archive
        </h2>
        <p class="text-muted">
            <template v-if="!importStarted">
                Browse for the ZIP file of the X archive you downloaded, or the folder where you have already extracted
                it.
            </template>
            <template v-else>
                Importing your archive...
            </template>
        </p>

        <template v-if="!importStarted">
            <div class="input-group">
                <input v-model="importFromArchivePath" type="text" class="form-control"
                    placeholder="Import your X archive" readonly>
                <template v-if="platform == 'darwin'">
                    <button class="btn btn-secondary" @click="importFromArchiveBrowseClicked">
                        Browse for Archive
                    </button>
                </template>
                <template v-else>
                    <button class="btn btn-secondary me-1" @click="importFromArchiveBrowseZipClicked">
                        Browse for ZIP
                    </button>
                    <button class="btn btn-secondary" @click="importFromArchiveBrowseFolderClicked">
                        Browse for Unzipped Folder
                    </button>
                </template>
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
                    <i v-if="statusValidating != ImportStatus.Active"
                        :class="['fa', iconFromStatus(statusValidating)]" />
                    <i v-else>
                        <RunningIcon />
                    </i>
                    Validating X archive
                </li>
                <li :class="statusImportingTweets == ImportStatus.Pending ? 'text-muted' : ''">
                    <i v-if="statusImportingTweets != ImportStatus.Active"
                        :class="['fa', iconFromStatus(statusImportingTweets)]" />
                    <i v-else>
                        <RunningIcon />
                    </i>
                    Importing tweets
                    <span v-if="tweetCountString != ''" class="text-muted">
                        ({{ tweetCountString }})
                    </span>
                </li>
                <li :class="statusImportingLikes == ImportStatus.Pending ? 'text-muted' : ''">
                    <i v-if="statusImportingLikes != ImportStatus.Active"
                        :class="['fa', iconFromStatus(statusImportingLikes)]" />
                    <i v-else>
                        <RunningIcon />
                    </i>
                    Importing likes
                    <span v-if="likeCountString != ''" class="text-muted">
                        ({{ likeCountString }})
                    </span>
                </li>
                <li :class="statusBuildCydArchive == ImportStatus.Pending ? 'text-muted' : ''">
                    <i v-if="statusBuildCydArchive != ImportStatus.Active"
                        :class="['fa', iconFromStatus(statusBuildCydArchive)]" />
                    <i v-else>
                        <RunningIcon />
                    </i>
                    Build Cyd archive
                </li>
            </ul>

            <template v-if="importFinished">
                <div class="alert alert-success mt-3">
                    <i class="fa-solid fa-check" />
                    Import finished successfully!
                </div>
                <div class="buttons d-flex flex-column flex-md-row justify-content-between">
                    <div class="d-flex flex-column align-items-center mb-3 mb-md-0">
                        <button type="submit" class="btn btn-primary text-nowrap m-1" @click="archiveClicked">
                            <i class="fa-solid fa-forward" />
                            Continue to Archive Options
                        </button>
                        <small class="text-center text-muted">
                            Save tweets as HTML, backup DMs and bookmarks
                        </small>
                    </div>
                    <div class="d-flex flex-column align-items-center">
                        <button type="submit" class="btn btn-primary text-nowrap m-1" @click="deleteClicked">
                            <i class="fa-solid fa-forward" />
                            Continue to Delete Options
                        </button>
                        <small class="text-center text-muted">
                            Start deleting now
                        </small>
                    </div>
                </div>
            </template>
            <template v-if="importFailed">
                <div v-for="errorMessage in errorMessages" :key="errorMessage"
                    class="alert alert-danger mt-3 text-break">
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
