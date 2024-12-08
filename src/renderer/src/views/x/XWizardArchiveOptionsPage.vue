<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AccountXViewModel, State } from '../../view_models/AccountXViewModel'
import type { XDatabaseStats } from '../../../../shared_types';
import { emptyXDatabaseStats } from '../../../../shared_types';
import { xGetUnarchivedTweetsCount } from '../../util_x';

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
const nextClicked = async () => {
    await saveSettings();
    emit('setState', State.WizardReview);
};

const backClicked = async () => {
    await saveSettings();
    emit('setState', State.WizardImportOrBuild);
};

// Settings
const archiveTweetsHTML = ref(false);
const archiveDMs = ref(false);

const databaseStats = ref<XDatabaseStats>(emptyXDatabaseStats());

const loadSettings = async () => {
    console.log('XWizardBuildOptionsPage', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        archiveTweetsHTML.value = account.xAccount.archiveTweetsHTML;
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
        account.xAccount.archiveDMs = archiveDMs.value;
        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
    }
};

const unarchivedTweetsCount = ref(0);

onMounted(async () => {
    await loadSettings();
    databaseStats.value = await window.electron.X.getDatabaseStats(props.model.account.id);
    unarchivedTweetsCount.value = await xGetUnarchivedTweetsCount(props.model.account.id);
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Archive options
            </h2>
            <p class="text-muted">
                You can save an HTML version of each tweet, and you can save your direct messages.
            </p>
        </div>

        <form @submit.prevent>
            <div class="mb-3">
                <div class="form-check">
                    <input id="archiveTweetsHTML" v-model="archiveTweetsHTML" type="checkbox" class="form-check-input">
                    <label class="form-check-label" for="archiveTweetsHTML">Save an HTML version of each tweet</label>
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
                <div v-if="unarchivedTweetsCount > 0" class="indent">
                    <small>
                        <i class="fa-solid fa-circle-info" />
                        You have <strong>{{ unarchivedTweetsCount }} tweets</strong> that haven't been archived yet
                    </small>
                </div>
            </div>
            <div class="mb-3">
                <div class="form-check">
                    <input id="archiveDMs" v-model="archiveDMs" type="checkbox" class="form-check-input">
                    <label class="form-check-label" for="archiveDMs">Save my direct messages</label>
                </div>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Import or Build Database
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!(archiveTweetsHTML || archiveDMs)" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    Continue to Review
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>