<template>
    <div class="wizard-content">
        <BreadcrumbsComponent :buttons="[
            { label: 'Dashboard', action: () => emit('set-state', 'WizardDashboard'), icon: getBreadcrumbIcon('dashboard') },
        ]" label="Import X Archive" :icon="getBreadcrumbIcon('import')" />

        <div class="wizard-scroll-content">
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
</template>

<script setup lang="ts">
import { getBreadcrumbIcon } from '../../util';
import BreadcrumbsComponent from '../shared_components/BreadcrumbsComponent.vue';

const emit = defineEmits(['set-state', 'update-account']);

const importArchive = async () => {
    // Move to the import page
    emit('set-state', 'WizardImporting');
};

const goBack = () => {
    emit('set-state', 'WizardDashboard');
};
</script>
