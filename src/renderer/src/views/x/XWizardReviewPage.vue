<script setup lang="ts">
import {
    ref,
    onMounted,
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
    startStateLoop: []
    startJobs: [deleteFromDatabase: boolean, chanceToReview: boolean]
}>()

// Buttons
const nextClicked = async () => {
    await saveSettings();
    emit('startJobs', deleteFromDatabase.value, chanceToReview.value);
};

const backClicked = async () => {
    await saveSettings();
    if (props.model.account?.xAccount?.deleteMyData) {
        emit('setState', State.WizardDeleteOptions);
    } else {
        emit('setState', State.WizardSaveOptions);
    }
    emit('startStateLoop');
};

// Settings
const deleteFromDatabase = ref(false);
const chanceToReview = ref(false);

const loadSettings = async () => {
    console.log('XWizardDeleteOptionsPage', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        deleteFromDatabase.value = account.xAccount.deleteFromDatabase;
        chanceToReview.value = account.xAccount.chanceToReview;
    }
};

const saveSettings = async () => {
    console.log('XWizardDeleteOptionsPage', 'saveSettings');
    if (!props.model.account) {
        console.error('XWizardDeleteOptionsPage', 'saveSettings', 'account is null');
        return;
    }
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        account.xAccount.deleteFromDatabase = deleteFromDatabase.value;
        account.xAccount.chanceToReview = chanceToReview.value;
        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
    }
};

onMounted(async () => {
    await loadSettings();
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
        <div class="mb-4">
            <h2>
                Review your choices
            </h2>
        </div>
        <form @submit.prevent>
            <div v-if="model.account?.xAccount?.saveMyData">
                <h3>
                    <i class="fa-solid fa-floppy-disk me-1" />
                    Save my data
                </h3>
                <ul>
                    <li v-if="model.account?.xAccount?.archiveTweets">
                        Save tweets
                        <ul>
                            <li v-if="model.account?.xAccount?.archiveTweetsHTML">
                                Save HTML versions of tweets
                            </li>
                        </ul>
                    </li>
                    <li v-if="model.account?.xAccount?.archiveLikes">
                        Save likes
                    </li>
                    <li v-if="model.account?.xAccount?.archiveDMs">
                        Save direct messages
                    </li>
                </ul>
            </div>

            <div v-if="model.account?.xAccount?.deleteMyData">
                <h3>
                    <i class="fa-solid fa-fire me-1" />
                    Delete my data
                    <span class="premium badge badge-primary">Premium</span>
                </h3>
                <ul class="mb-4">
                    <li v-if="model.account?.xAccount?.deleteTweets">
                        Delete tweets older than {{ model.account?.xAccount?.deleteTweetsDaysOld }} days
                        <ul>
                            <li v-if="model.account?.xAccount?.deleteTweetsRetweetsThresholdEnabled">
                                Keep tweets with at least {{
                                    model.account?.xAccount?.deleteTweetsRetweetsThreshold }}
                                retweets
                            </li>
                            <li v-if="model.account?.xAccount?.deleteTweetsLikesThresholdEnabled">
                                Keep tweets with at least {{
                                    model.account?.xAccount?.deleteTweetsLikesThreshold }} likes
                            </li>
                            <li v-if="model.account?.xAccount?.deleteTweetsArchiveEnabled">
                                Save an HTML version of each tweet before deleting it
                            </li>
                        </ul>
                    </li>
                    <li v-if="model.account?.xAccount?.deleteRetweets">
                        Unretweet tweets older than {{ model.account?.xAccount?.deleteRetweetsDaysOld }} days
                    </li>
                    <li v-if="model.account?.xAccount?.deleteLikes">
                        Unlike tweets older than {{ model.account?.xAccount?.deleteLikesDaysOld }} days
                    </li>
                    <li v-if="model.account?.xAccount?.deleteDMs">
                        Delete direct messages
                    </li>
                </ul>

                <div v-if="!model.account?.xAccount?.saveMyData" class="mb-2">
                    <div class="form-check">
                        <input id="deleteFromDatabase" v-model="deleteFromDatabase" type="checkbox"
                            class="form-check-input">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteFromDatabase">
                            Use my existing database
                        </label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            Delete data based on what Cyd has already saved in your local database. If
                            you don't check this box, Cyd will save a new copy of your data.
                        </small>
                    </div>
                </div>

                <div class="mb-2">
                    <div class="form-check">
                        <input id="chanceToReview" v-model="chanceToReview" type="checkbox" class="form-check-input">
                        <label class="form-check-label mr-1 text-nowrap" for="chanceToReview">
                            Give me a chance to review my data before deleting it
                        </label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            If you don't check this box, your data will be deleted as soon Cyd
                            builds your local database.
                        </small>
                    </div>
                </div>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    <template v-if="model.account?.xAccount?.deleteMyData">
                        Back to Delete Options
                    </template>
                    <template v-else>
                        Back to Save Options
                    </template>
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!(model.account?.xAccount?.archiveTweets || model.account?.xAccount?.archiveLikes || model.account?.xAccount?.archiveDMs)"
                    @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="model.account?.xAccount?.saveMyData">
                        <template v-if="deleteFromDatabase">
                            Review Before Deleting
                        </template>
                        <template v-else>
                            Build Database
                        </template>
                    </template>
                    <template v-else>
                        <template v-if="deleteFromDatabase">
                            Start Deleting
                        </template>
                        <template v-else>
                            Build Database and Start Deleting
                        </template>
                    </template>
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>