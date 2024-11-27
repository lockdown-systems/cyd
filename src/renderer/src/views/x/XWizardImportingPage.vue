<script setup lang="ts">
import {
    ref,
    getCurrentInstance
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'
import { XImportArchiveResponse } from '../../../../shared_types'

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

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
    emit('setState', State.WizardDeleteOptions);
};

const createCountString = (importCount: number, skipCount: number) => {
    if (importCount > 0 && skipCount > 0) {
        return `${importCount.toLocaleString()} imported, ${skipCount.toLocaleString()} skipped`;
    } else if (importCount > 0 && skipCount == 0) {
        return `${importCount.toLocaleString()} imported`;
    } else if (importCount == 0 && skipCount > 0) {
        return `${skipCount.toLocaleString()} skipped`;
    } else {
        return 'nothing imported';
    }
}

const startClicked = async () => {
    importStarted.value = true;

    // Verify that the archive is valid
    statusValidating.value = ImportStatus.Active;
    const verifyResp: string | null = await window.electron.X.verifyXArchive(props.model.account.id, importFromArchivePath.value);
    if (verifyResp !== null) {
        statusValidating.value = ImportStatus.Failed;
        errorMessage.value = verifyResp;
        importFailed.value = true;
        return;
    }
    statusValidating.value = ImportStatus.Finished;

    // Import tweets
    statusImportingTweets.value = ImportStatus.Active;
    const tweetsResp: XImportArchiveResponse = await window.electron.X.importXArchive(props.model.account.id, importFromArchivePath.value, 'tweets');
    tweetCountString.value = createCountString(tweetsResp.importCount, tweetsResp.skipCount);
    if (tweetsResp.status == 'error') {
        statusImportingTweets.value = ImportStatus.Failed;
        errorMessage.value = tweetsResp.errorMessage;
        importFailed.value = true;
        return;
    }
    statusImportingTweets.value = ImportStatus.Finished;
    emitter.emit(`x-update-database-stats-${props.model.account.id}`);

    // Import likes
    statusImportingLikes.value = ImportStatus.Active;
    const likesResp: XImportArchiveResponse = await window.electron.X.importXArchive(props.model.account.id, importFromArchivePath.value, 'likes');
    likeCountString.value = createCountString(likesResp.importCount, likesResp.skipCount);
    if (likesResp.status == 'error') {
        statusImportingLikes.value = ImportStatus.Failed;
        errorMessage.value = likesResp.errorMessage;
        importFailed.value = true;
        return;
    }
    statusImportingLikes.value = ImportStatus.Finished;
    emitter.emit(`x-update-database-stats-${props.model.account.id}`);

    // Import DM groups
    statusImportingDMGroups.value = ImportStatus.Active;
    const dmGroupsResp: XImportArchiveResponse = await window.electron.X.importXArchive(props.model.account.id, importFromArchivePath.value, 'dmGroups');
    dmGroupCountString.value = createCountString(dmGroupsResp.importCount, dmGroupsResp.skipCount);
    if (dmGroupsResp.status == 'error') {
        statusImportingDMGroups.value = ImportStatus.Failed;
        errorMessage.value = dmGroupsResp.errorMessage;
        importFailed.value = true;
        return;
    }
    statusImportingDMGroups.value = ImportStatus.Finished;
    emitter.emit(`x-update-database-stats-${props.model.account.id}`);

    // Import DMs
    statusImportingDMs.value = ImportStatus.Active;
    const dmsResp: XImportArchiveResponse = await window.electron.X.importXArchive(props.model.account.id, importFromArchivePath.value, 'dms');
    dmCountString.value = createCountString(dmsResp.importCount, dmsResp.skipCount);
    if (dmsResp.status == 'error') {
        statusImportingDMs.value = ImportStatus.Failed;
        errorMessage.value = dmsResp.errorMessage;
        importFailed.value = true;
        return;
    }
    statusImportingDMs.value = ImportStatus.Finished;
    emitter.emit(`x-update-database-stats-${props.model.account.id}`);

    // Build Cyd archive
    statusBuildCydArchive.value = ImportStatus.Active;
    try {
        await window.electron.X.archiveBuild(props.model.account.id);
    } catch (e) {
        statusBuildCydArchive.value = ImportStatus.Failed;
        errorMessage.value = `${e}`;
        importFailed.value = true;
        return;
    }
    emitter.emit(`x-update-archive-info-${props.model.account.id}`);
    statusBuildCydArchive.value = ImportStatus.Finished;

    importFinished.value = true;
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
const statusBuildCydArchive = ref(ImportStatus.Pending);

const tweetCountString = ref('');
const likeCountString = ref('');
const dmGroupCountString = ref('');
const dmCountString = ref('');

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
                    <span v-if="tweetCountString != ''" class="text-muted">
                        ({{ tweetCountString }})
                    </span>
                </li>
                <li :class="statusImportingLikes == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusImportingLikes)]" />
                    Importing likes
                    <span v-if="likeCountString != ''" class="text-muted">
                        ({{ likeCountString }})
                    </span>
                </li>
                <li :class="statusImportingDMGroups == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusImportingDMGroups)]" />
                    Importing direct message groups
                    <span v-if="dmGroupCountString != ''" class="text-muted">
                        ({{ dmGroupCountString }})
                    </span>
                </li>
                <li :class="statusImportingDMs == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusImportingDMs)]" />
                    Importing one-to-one direct messages
                    <span v-if="dmCountString != ''" class="text-muted">
                        ({{ dmCountString }})
                    </span>
                </li>
                <li :class="statusBuildCydArchive == ImportStatus.Pending ? 'text-muted' : ''">
                    <i :class="['fa', iconFromStatus(statusBuildCydArchive)]" />
                    Build Cyd archive
                </li>
            </ul>

            <template v-if="importFinished">
                <div class="alert alert-success mt-3">
                    <i class="fa-solid fa-check" />
                    Import finished successfully!
                </div>
                <div class="buttons">
                    <button type="submit" class="btn btn-primary text-nowrap m-1" @click="nextClicked">
                        <i class="fa-solid fa-forward" />
                        Continue to Delete Options
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