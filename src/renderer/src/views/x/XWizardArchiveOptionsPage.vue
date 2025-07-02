<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { XViewModel, State } from '../../view_models/XViewModel'
import type { XDatabaseStats } from '../../../../shared_types';
import { emptyXDatabaseStats } from '../../../../shared_types';
import { setJobsType } from '../../util';

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
}>()

// Buttons
const nextClicked = async () => {
    await saveSettings();
    setJobsType(props.model.account.id, 'archive');
    emit('setState', State.WizardReview);
};

const backClicked = async () => {
    await saveSettings();
    emit('setState', State.WizardDatabase);
};

// Settings
const archiveTweetsHTML = ref(false);
const archiveBookmarks = ref(false);
const archiveDMs = ref(false);

const databaseStats = ref<XDatabaseStats>(emptyXDatabaseStats());

const loadSettings = async () => {
    console.log('XWizardBuildOptionsPage', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        archiveTweetsHTML.value = account.xAccount.archiveTweetsHTML;
        archiveBookmarks.value = account.xAccount.archiveBookmarks;
        archiveDMs.value = account.xAccount.archiveDMs;
    }
};

const saveSettings = async () => {
    console.log('XWizardBuildOptionsPage', 'saveSettings');
    if (!props.model.account) {
        console.error('XWizardBuildOptionsPage', 'saveSettings', 'account is null');
        return;
    }
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        account.xAccount.saveMyData = false;
        account.xAccount.deleteMyData = false;
        account.xAccount.archiveMyData = true;

        account.xAccount.archiveTweetsHTML = archiveTweetsHTML.value;
        account.xAccount.archiveBookmarks = archiveBookmarks.value;
        account.xAccount.archiveDMs = archiveDMs.value;
        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
    }
};

const deleteTweetsCountNotArchived = ref(0);

onMounted(async () => {
    await loadSettings();
    databaseStats.value = await window.electron.X.getDatabaseStats(props.model.account.id);
    deleteTweetsCountNotArchived.value = await window.electron.X.deleteTweetsCountNotArchived(props.model.account?.id, true);
});
</script>

<template>
    <div class="wizard-content">
        <div class="back-buttons">
            <button type="submit" class="btn btn-secondary text-nowrap m-1" @click="backClicked">
                <i class="fa-solid fa-backward" />
                Back to Local Database
            </button>
        </div>

        <div class="wizard-scroll-content">
            <div class="mb-4">
                <h2>
                    Archive options
                </h2>
                <p class="text-muted">
                    You can save an HTML version of each tweet, and you can save your bookmarks and your direct
                    messages.
                </p>
            </div>

            <form @submit.prevent>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveTweetsHTML" v-model="archiveTweetsHTML" type="checkbox"
                            class="form-check-input">
                        <label class="form-check-label" for="archiveTweetsHTML">Save an HTML version of each
                            tweet</label>
                    </div>
                    <div class="indent">
                        <small v-if="databaseStats.tweetsSaved == 0" class="form-text text-muted">
                            <i class="fa-solid fa-triangle-exclamation" />
                            Your local database doesn't have any tweets yet. You need to import your X archive or build
                            your database from scratch before you can save HTML versions of your tweets.
                        </small>
                        <small v-else class="form-text text-muted">
                            Make an HTML archive of each tweet, including its replies, which is good
                            for taking screenshots <em>(takes much longer than just deleting them)</em>
                        </small>
                    </div>
                    <div v-if="deleteTweetsCountNotArchived > 0" class="indent">
                        <small>
                            <i class="fa-solid fa-circle-info" />
                            You have <strong>{{ deleteTweetsCountNotArchived }} tweets</strong> that haven't been
                            archived
                            yet
                        </small>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveBookmarks" v-model="archiveBookmarks" type="checkbox"
                            class="form-check-input">
                        <label class="form-check-label" for="archiveBookmarks">Save my bookmarks</label>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveDMs" v-model="archiveDMs" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveDMs">Save my direct messages</label>
                    </div>
                </div>
            </form>
        </div>
        <div class="next-buttons">
            <button type="submit" class="btn btn-primary text-nowrap m-1"
                :disabled="!(archiveTweetsHTML || archiveBookmarks || archiveDMs)" @click="nextClicked">
                <i class="fa-solid fa-forward" />
                Continue to Review
            </button>
        </div>
    </div>
</template>

<style scoped></style>
