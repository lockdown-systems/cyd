<template>
    <div class="wizard-content">
        <BreadcrumbsComponent :buttons="[
            { label: 'Dashboard', action: () => emit('set-state', 'WizardDashboard'), icon: getBreadcrumbIcon('dashboard') },
        ]" label="Import X Archive" :icon="getBreadcrumbIcon('import')" />

        <div class="wizard-scroll-content">
            <h2>Import X Archive</h2>
            <p>
                If you've deleted your X account, or otherwise can't sign into it, you can still migrate your
                tweets to Bluesky! You'll need the following:
            </p>
            <ul>
                <li>A copy of your X archive that you downloaded earlier, for importing into Cyd</li>
                <li>A Cyd <strong>Premium plan</strong>, for migrating to Bluesky</li>
            </ul>
            <p>
                When you're ready, <a href="#" @click="importArchive">continue to import your X archive</a>.
            </p>
        </div>

        <ButtonsComponent :back-buttons="[
            { label: 'Back to Dashboard', action: goBack, icon: 'fa-solid fa-backward' },
        ]" :next-buttons="[
            {
                label: 'Continue to Import X Archive',
                action: importArchive,
            },
        ]" />
    </div>
</template>

<script setup lang="ts">
import { getBreadcrumbIcon } from '../../util';
import BreadcrumbsComponent from '../shared_components/BreadcrumbsComponent.vue';
import ButtonsComponent from '../shared_components/ButtonsComponent.vue';

const emit = defineEmits(['set-state', 'update-account']);

const importArchive = async () => {
    // Move to the import page
    emit('set-state', 'WizardImporting');
};

const goBack = () => {
    emit('set-state', 'WizardDashboard');
};
</script>
