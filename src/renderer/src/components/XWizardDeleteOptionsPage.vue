<script setup lang="ts">
import {
    ref,
    onMounted,
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../view_models/AccountXViewModel'
import type { Account } from '../../../shared_types';

// Props
const props = defineProps<{
    model: AccountXViewModel | null;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
    startStateLoop: []
}>()

// Buttons
const nextClicked = async () => {
    await saveSettings();
    if (props.model?.isDeleteReviewActive) {
        emit('setState', State.WizardDeleteReview);
    } else {
        emit('setState', State.WizardReview);
    }
    emit('startStateLoop');
};

const backClicked = async () => {
    await saveSettings();
    if (props.model?.account.xAccount?.saveMyData) {
        emit('setState', State.WizardSaveOptions);
    } else {
        emit('setState', State.WizardStart);
    }
    emit('startStateLoop');
};

// Settings
const deleteTweets = ref(true);
const deleteTweetsDaysOld = ref(0);
const deleteTweetsRetweetsThresholdEnabled = ref(true);
const deleteTweetsRetweetsThreshold = ref(0);
const deleteTweetsLikesThresholdEnabled = ref(true);
const deleteTweetsLikesThreshold = ref(0);
const deleteTweetsArchiveEnabled = ref(true);
const deleteRetweets = ref(true);
const deleteRetweetsDaysOld = ref(0);
const deleteLikes = ref(true);
const deleteLikesDaysOld = ref(0);
const deleteDMs = ref(true);

const loadSettings = async () => {
    if (props.model && props.model.account.xAccount !== null) {
        deleteTweets.value = props.model.account.xAccount.deleteTweets;
        deleteTweetsDaysOld.value = props.model.account.xAccount.deleteTweetsDaysOld;
        deleteTweetsRetweetsThresholdEnabled.value = props.model.account.xAccount.deleteTweetsRetweetsThresholdEnabled;
        deleteTweetsRetweetsThreshold.value = props.model.account.xAccount.deleteTweetsRetweetsThreshold;
        deleteTweetsLikesThresholdEnabled.value = props.model.account.xAccount.deleteTweetsLikesThresholdEnabled;
        deleteTweetsLikesThreshold.value = props.model.account.xAccount.deleteTweetsLikesThreshold;
        deleteTweetsArchiveEnabled.value = props.model.account.xAccount.deleteTweetsArchiveEnabled;
        deleteRetweets.value = props.model.account.xAccount.deleteRetweets;
        deleteRetweetsDaysOld.value = props.model.account.xAccount.deleteRetweetsDaysOld;
        deleteLikes.value = props.model.account.xAccount.deleteLikes;
        deleteLikesDaysOld.value = props.model.account.xAccount.deleteLikesDaysOld;
        deleteDMs.value = props.model.account.xAccount.deleteDMs;
    }
};

const saveSettings = async () => {
    if (props.model?.account.xAccount == null) {
        console.error('saveSettings', 'Account is null');
        return;
    }
    const updatedAccount: Account = {
        ...props.model?.account,
        xAccount: {
            ...props.model?.account.xAccount,
            deleteTweets: deleteTweets.value,
            deleteTweetsDaysOld: deleteTweetsDaysOld.value,
            deleteTweetsRetweetsThresholdEnabled: deleteTweetsRetweetsThresholdEnabled.value,
            deleteTweetsRetweetsThreshold: deleteTweetsRetweetsThreshold.value,
            deleteTweetsLikesThresholdEnabled: deleteTweetsLikesThresholdEnabled.value,
            deleteTweetsLikesThreshold: deleteTweetsLikesThreshold.value,
            deleteTweetsArchiveEnabled: deleteTweetsArchiveEnabled.value,
            deleteRetweets: deleteRetweets.value,
            deleteRetweetsDaysOld: deleteRetweetsDaysOld.value,
            deleteLikes: deleteLikes.value,
            deleteLikesDaysOld: deleteLikesDaysOld.value,
            deleteDMs: deleteDMs.value
        }
    };
    await window.electron.database.saveAccount(JSON.stringify(updatedAccount));
    emit('updateAccount');
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
            <div class="indent">
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
                        Likes are private on X. If you've liked a lot of tweets, it might take a
                        long time to delete them all.
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
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    <template v-if="model?.account.xAccount?.saveMyData">
                        Back to Save Options
                    </template>
                    <template v-else>
                        Back to Start
                    </template>
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(
                    model?.account.xAccount?.archiveTweets ||
                    model?.account.xAccount?.archiveLikes ||
                    model?.account.xAccount?.archiveDMs)" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    Continue to Review
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>