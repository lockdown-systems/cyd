<template>
    <div class="wizard-page">
        <div class="container">
            <div class="row">
                <div class="col-md-8 offset-md-2">
                    <h2>Import X Archive</h2>
                    <p>
                        You've chosen to import your X archive without logging in. This mode allows you to:
                    </p>
                    <ul>
                        <li>Import your X archive data</li>
                        <li>Save your tweets and bookmarks locally</li>
                        <li>Migrate your data to Bluesky (if you have a Premium plan)</li>
                    </ul>
                    <p>
                        <b>Note:</b> Some features like deleting DMs or managing your X account will not be available in this mode.
                    </p>

                    <div class="mt-4">
                        <button class="btn btn-primary" @click="importArchive">
                            Import X Archive
                        </button>
                        <button class="btn btn-secondary ms-2" @click="goBack">
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { XViewModel } from '../../view_models/XViewModel';

const props = defineProps<{
    model: XViewModel;
}>();

const emit = defineEmits(['set-state']);

const importArchive = async () => {
    // Set the account to archive-only mode
    if (props.model.account.xAccount) {
        props.model.account.xAccount.archiveOnly = true;
        await window.electron.database.saveAccount(JSON.stringify(props.model.account));
    }

    // Move to the import page
    emit('set-state', 'WizardImportStartDisplay');
};

const goBack = () => {
    emit('set-state', 'Login');
};
</script>

<style scoped>
.wizard-page {
    padding: 2rem 0;
}
</style>