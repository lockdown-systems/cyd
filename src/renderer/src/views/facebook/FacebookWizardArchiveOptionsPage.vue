<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { FacebookViewModel, State } from '../../view_models/FacebookViewModel'
import type { FacebookDatabaseStats } from '../../../../shared_types';
import { emptyFacebookDatabaseStats } from '../../../../shared_types';
import { setJobsType } from '../../util';

// Props
const props = defineProps<{
    model: FacebookViewModel;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
}>()

// Settings
const archivePosts = ref(true);
const databaseStats = ref<FacebookDatabaseStats>(emptyFacebookDatabaseStats());

const loadSettings = async () => {
    console.log('FacebookWizardArchiveOptionsPage', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.facebookAccount) {
        archivePosts.value = account.facebookAccount.savePosts ?? true;
    }
};

const saveSettings = async () => {
    console.log('FacebookWizardArchiveOptionsPage', 'saveSettings');
    if (!props.model.account) {
        console.error('FacebookWizardArchiveOptionsPage', 'saveSettings', 'account is null');
        return;
    }
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.facebookAccount) {
        account.facebookAccount.saveMyData = true;
        account.facebookAccount.savePosts = true;
        account.facebookAccount.archiveMyData = true;
        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
    }
};

// Buttons
const nextClicked = async () => {
    await saveSettings();
    setJobsType(props.model.account.id, 'archive');
    emit('setState', State.WizardReview);
};

const backClicked = async () => {
    await saveSettings();
    emit('setState', State.WizardImporting);
};

onMounted(async () => {
    await loadSettings();
    const stats = await window.electron.Facebook.getDatabaseStats(props.model.account.id);
    databaseStats.value = stats;
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Archive options
            </h2>
        </div>

        <form @submit.prevent>
            <div class="mb-3">
                <div class="indent">
                    <div v-if="databaseStats.postsSaved > 0">
                        <p>Current database stats:</p>
                        <ul class="list-unstyled">
                            <li><i class="fa-solid fa-file-lines me-2"></i>Posts saved: {{ databaseStats.postsSaved }}</li>
                            <li><i class="fa-solid fa-share me-2"></i>Shared posts: {{ databaseStats.repostsSaved }}</li>
                        </ul>
                    </div>
                    <small v-else class="form-text text-muted">
                        <i class="fa-solid fa-triangle-exclamation" />
                        Your local database doesn't have any posts yet. You need to import your Facebook archive or
                        build your database from scratch.
                    </small>
                </div>
            </div>

            <div class="form-check mb-3">
                <input class="form-check-input" type="checkbox" v-model="archivePosts" id="archivePosts">
                <label class="form-check-label" for="archivePosts">
                    Archive posts and media
                </label>
                <small class="form-text text-muted d-block">
                    Create a static archive of your Facebook posts, including text, photos, and videos.
                </small>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Import or Build Database
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!archivePosts" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    Continue to Review (NOT IMPL YET)
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>