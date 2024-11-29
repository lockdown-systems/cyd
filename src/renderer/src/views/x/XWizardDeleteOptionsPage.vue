<script setup lang="ts">
import {
    ref,
    onMounted,
    computed,
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';

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

// Show more
const deleteTweetsShowMore = ref(false);
const deleteTweetsShowMoreButtonText = computed(() => deleteTweetsShowMore.value ? 'Hide more options' : 'Show more options');

const deleteTweetsShowMoreClicked = () => {
    deleteTweetsShowMore.value = !deleteTweetsShowMore.value;
};

// Settings
const deleteTweets = ref(false);
const deleteTweetsDaysOld = ref(0);
const deleteTweetsRetweetsThresholdEnabled = ref(false);
const deleteTweetsRetweetsThreshold = ref(0);
const deleteTweetsLikesThresholdEnabled = ref(false);
const deleteTweetsLikesThreshold = ref(0);
const deleteTweetsArchiveEnabled = ref(false);
const deleteRetweets = ref(false);
const deleteRetweetsDaysOld = ref(0);
const deleteLikes = ref(false);
const deleteLikesDaysOld = ref(0);
const deleteDMs = ref(false);
const unfollowEveryone = ref(false);

const loadSettings = async () => {
    console.log('XWizardDeleteOptionsPage', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.xAccount) {
        deleteTweets.value = account.xAccount.deleteTweets;
        deleteTweetsDaysOld.value = account.xAccount.deleteTweetsDaysOld;
        deleteTweetsRetweetsThresholdEnabled.value = account.xAccount.deleteTweetsRetweetsThresholdEnabled;
        deleteTweetsRetweetsThreshold.value = account.xAccount.deleteTweetsRetweetsThreshold;
        deleteTweetsLikesThresholdEnabled.value = account.xAccount.deleteTweetsLikesThresholdEnabled;
        deleteTweetsLikesThreshold.value = account.xAccount.deleteTweetsLikesThreshold;
        deleteTweetsArchiveEnabled.value = account.xAccount.deleteTweetsArchiveEnabled;
        deleteRetweets.value = account.xAccount.deleteRetweets;
        deleteRetweetsDaysOld.value = account.xAccount.deleteRetweetsDaysOld;
        deleteLikes.value = account.xAccount.deleteLikes;
        deleteLikesDaysOld.value = account.xAccount.deleteLikesDaysOld;
        deleteDMs.value = account.xAccount.deleteDMs;
        unfollowEveryone.value = account.xAccount.unfollowEveryone;
    }

    if (deleteTweets.value && (deleteTweetsRetweetsThresholdEnabled.value || deleteTweetsLikesThresholdEnabled.value || deleteTweetsArchiveEnabled.value)) {
        deleteTweetsShowMore.value = true;
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
        // don't save data, yes delete data
        account.xAccount.saveMyData = false;
        account.xAccount.deleteMyData = true;

        account.xAccount.deleteTweets = deleteTweets.value;
        account.xAccount.deleteTweetsDaysOld = deleteTweetsDaysOld.value;
        account.xAccount.deleteTweetsRetweetsThresholdEnabled = deleteTweetsRetweetsThresholdEnabled.value;
        account.xAccount.deleteTweetsRetweetsThreshold = deleteTweetsRetweetsThreshold.value;
        account.xAccount.deleteTweetsLikesThresholdEnabled = deleteTweetsLikesThresholdEnabled.value;
        account.xAccount.deleteTweetsLikesThreshold = deleteTweetsLikesThreshold.value;
        account.xAccount.deleteTweetsArchiveEnabled = deleteTweetsArchiveEnabled.value;
        account.xAccount.deleteRetweets = deleteRetweets.value;
        account.xAccount.deleteRetweetsDaysOld = deleteRetweetsDaysOld.value;
        account.xAccount.deleteLikes = deleteLikes.value;
        account.xAccount.deleteLikesDaysOld = deleteLikesDaysOld.value;
        account.xAccount.deleteDMs = deleteDMs.value;
        account.xAccount.unfollowEveryone = unfollowEveryone.value;

        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
    }
};

onMounted(async () => {
    await loadSettings();
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Delete options
                <span class="premium badge badge-primary">Premium</span>
            </h2>
            <p class="text-muted">
                Delete your data from X, except for what you want to keep.
            </p>
        </div>

        <XLastImportOrBuildComponent :account-i-d="model.account.id" :button-text="'Import or Build Database Again'"
            :button-state="State.WizardImportOrBuild" @set-state="emit('setState', $event)" />

        <form @submit.prevent>
            <div class="d-flex align-items-center">
                <div class="form-check mb-2">
                    <input id="deleteTweets" v-model="deleteTweets" type="checkbox" class="form-check-input">
                    <label class="form-check-label mr-1 text-nowrap" for="deleteTweets">
                        Delete tweets
                    </label>
                </div>
                <div class="d-flex align-items-center mb-2">
                    <label class="form-check-label mr-1 no-wrap text-nowrap" for="deleteTweetsDaysOld">
                        older than
                    </label>
                    <div class="input-group flex-nowrap">
                        <input id="deleteTweetsDaysOld" v-model="deleteTweetsDaysOld" type="text"
                            class="form-control form-short">
                        <div class="input-group-append">
                            <span class="input-group-text">days</span>
                        </div>
                    </div>
                    <span class="ms-2 text-muted">(recommended)</span>
                </div>
            </div>
            <button class="btn btn-sm btn-link show-more-button" @click="deleteTweetsShowMoreClicked">
                {{ deleteTweetsShowMoreButtonText }}
            </button>
            <div v-if="deleteTweetsShowMore" class="indent">
                <div class="d-flex align-items-center">
                    <div class="form-check mb-2">
                        <input id="deleteTweetsRetweetsThresholdEnabled" v-model="deleteTweetsRetweetsThresholdEnabled"
                            type="checkbox" class="form-check-input" :disabled="!deleteTweets">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteTweetsRetweetsThresholdEnabled">
                            Unless they have at least
                        </label>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-check-label mr-1 sr-only" for="deleteTweetsRetweetsThreshold">
                            retweets
                        </label>
                        <div class="input-group flex-nowrap">
                            <input id="deleteTweetsRetweetsThreshold" v-model="deleteTweetsRetweetsThreshold"
                                type="text" class="form-control form-short" :disabled="!deleteTweets">
                            <div class="input-group-append">
                                <span class="input-group-text">retweets</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="form-check mb-2">
                        <input id="deleteTweetsLikesThresholdEnabled" v-model="deleteTweetsLikesThresholdEnabled"
                            type="checkbox" class="form-check-input" :disabled="!deleteTweets">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteTweetsLikesThresholdEnabled">
                            Or at least
                        </label>
                    </div>
                    <div class="d-flex align-items-center mb-2">
                        <label class="form-check-label mr-1 sr-only" for="deleteTweetsLikesThreshold">
                            likes
                        </label>
                        <div class="input-group flex-nowrap">
                            <input id="deleteTweetsLikesThreshold" v-model="deleteTweetsLikesThreshold" type="text"
                                class="form-control form-short" :disabled="!deleteTweets">
                            <div class="input-group-append">
                                <span class="input-group-text">likes</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="mb-2">
                        <div class="form-check">
                            <input id="deleteTweetsArchiveEnabled" v-model="deleteTweetsArchiveEnabled" type="checkbox"
                                class="form-check-input" :disabled="!deleteTweets">
                            <label class="form-check-label mr-1 text-nowrap" for="deleteTweetsArchiveEnabled">
                                Save an HTML version of each tweet before deleting it
                            </label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                Make an HTML archive of each tweet, including its replies, which is
                                good for taking
                                screenshots <em>(takes longer)</em>
                            </small>
                        </div>
                    </div>
                </div>
            </div>
            <div class="d-flex align-items-center">
                <div class="form-check mb-2">
                    <input id="deleteRetweets" v-model="deleteRetweets" type="checkbox" class="form-check-input">
                    <label class="form-check-label mr-1 text-nowrap" for="deleteRetweets">
                        Unretweet tweets
                    </label>
                </div>
                <div class="d-flex align-items-center mb-2">
                    <label class="form-check-label mr-1 no-wrap text-nowrap" for="deleteRetweetsDaysOld">
                        older than
                    </label>
                    <div class="input-group flex-nowrap">
                        <input id="deleteRetweetsDaysOld" v-model="deleteRetweetsDaysOld" type="text"
                            class="form-control form-short">
                        <div class="input-group-append">
                            <span class="input-group-text">days</span>
                        </div>
                    </div>
                    <span class="ms-2 text-muted">(recommended)</span>
                </div>
            </div>
            <div class="d-flex align-items-center">
                <div class="form-check mb-2">
                    <input id="unfollowEveryone" v-model="unfollowEveryone" type="checkbox" class="form-check-input">
                    <label class="form-check-label mr-1 text-nowrap" for="unfollowEveryone">
                        Unfollow everyone
                    </label>
                    <span class="ms-2 text-muted">(recommended)</span>
                </div>
            </div>
            <div class="mb-2">
                <div class="d-flex align-items-center">
                    <div class="form-check">
                        <input id="deleteLikes" v-model="deleteLikes" type="checkbox" class="form-check-input">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteLikes">
                            Unlike tweets
                        </label>
                    </div>
                    <div class="d-flex align-items-center">
                        <label class="form-check-label mr-1 no-wrap text-nowrap" for="deleteLikesDaysOld">
                            older than
                        </label>
                        <div class="input-group flex-nowrap">
                            <input id="deleteLikesDaysOld" v-model="deleteLikesDaysOld" type="text"
                                class="form-control form-short">
                            <div class="input-group-append">
                                <span class="input-group-text">days</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="indent">
                    <small class="form-text text-muted">
                        Likes are private on X. If you have a lot of likes, this will take a long time.
                    </small>
                </div>
            </div>
            <div class="d-flex align-items-center">
                <div class="mb-2">
                    <div class="form-check">
                        <input id="deleteDMs" v-model="deleteDMs" type="checkbox" class="form-check-input">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteDMs">
                            Delete all direct messages
                        </label>
                    </div>
                    <div class="indent">
                        <small class="form-text text-muted">
                            This will only delete DMs from your account. The people you've sent
                            messages to will still have them unless they delete their DMs as well.
                        </small>
                    </div>
                </div>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    deleteTweets ||
                    deleteRetweets ||
                    deleteLikes ||
                    unfollowEveryone ||
                    deleteDMs)" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    Continue to Review
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.form-short {
    width: 55px;
}

.show-more-button {
    margin-left: 1rem;
    margin-top: -1.5rem;
}
</style>