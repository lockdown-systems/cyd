<script setup lang="ts">
import {
    ref,
    onMounted,
} from 'vue';
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'
import { setJobsType } from '../../util';

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';

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
    setJobsType(props.model.account.id, 'save');
    emit('setState', State.WizardReview);
};

const backClicked = async () => {
    await saveSettings();
    emit('setState', State.WizardDatabase);
};

// Settings
const archiveTweets = ref(false);
const archiveTweetsHTML = ref(false);
const archiveLikes = ref(false);
const archiveBookmarks = ref(false);
const archiveDMs = ref(false);

const loadSettings = async () => {
    console.log('XWizardBuildOptionsPage', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        archiveTweets.value = account.xAccount.archiveTweets;
        archiveTweetsHTML.value = account.xAccount.archiveTweetsHTML;
        archiveLikes.value = account.xAccount.archiveLikes;
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
        account.xAccount.saveMyData = true;
        account.xAccount.deleteMyData = false;
        account.xAccount.archiveMyData = false;

        account.xAccount.archiveTweets = archiveTweets.value;
        account.xAccount.archiveTweetsHTML = archiveTweetsHTML.value;
        account.xAccount.archiveLikes = archiveLikes.value;
        account.xAccount.archiveBookmarks = archiveBookmarks.value;
        account.xAccount.archiveDMs = archiveDMs.value;
        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
    }
};

onMounted(async () => {
    await loadSettings();
});
</script>

<template>
    <div class="wizard-content">
        <div class="back-buttons">
            <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                <i class="fa-solid fa-backward" />
                Back to Import or Build Database
            </button>
        </div>

        <div class="wizard-scroll-content">
            <div class="mb-4">
                <h2>
                    Build options
                </h2>
                <p class="text-muted">
                    You can save tweets, likes, and direct messages.
                </p>
            </div>

            <XLastImportOrBuildComponent :account-i-d="model.account.id" :show-button="false"
                :show-no-data-warning="false" @set-state="emit('setState', $event)" />

            <form @submit.prevent>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveTweets" v-model="archiveTweets" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveTweets">Save my tweets</label>
                    </div>
                </div>
                <div class="indent">
                    <div class="mb-3">
                        <div class="form-check">
                            <input id="archiveTweetsHTML" v-model="archiveTweetsHTML" type="checkbox"
                                class="form-check-input" :disabled="!archiveTweets">
                            <label class="form-check-label" for="archiveTweetsHTML">
                                Save an HTML version of each tweet
                            </label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                Make an HTML archive of each tweet, including its replies, which is good
                                for
                                taking screenshots
                                <em>(takes longer)</em>
                            </small>
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="archiveLikes" v-model="archiveLikes" type="checkbox" class="form-check-input">
                        <label class="form-check-label" for="archiveLikes">Save my likes</label>
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
                :disabled="!(archiveTweets || archiveLikes || archiveBookmarks || archiveDMs)" @click="nextClicked">
                <i class="fa-solid fa-forward" />
                Continue to Review
            </button>
        </div>
    </div>
</template>

<style scoped></style>
