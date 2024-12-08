<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'
import { openPreventSleepURL } from '../../util';
import { emptyXDeleteReviewStats } from '../../../../shared_types';
import type { XDeleteReviewStats } from '../../../../shared_types';
import { xHasSomeData } from '../../util_x';

// Props
const props = defineProps<{
    model: AccountXViewModel;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
    startJobs: []
}>()

// Buttons
const nextClicked = async () => {
    emit('startJobs');
};

const backClicked = async () => {
    if (props.model.account?.xAccount?.deleteMyData) {
        emit('setState', State.WizardDeleteOptions);
    } else {
        emit('setState', State.WizardBuildOptions);
    }
};

// Settings
const deleteReviewStats = ref<XDeleteReviewStats>(emptyXDeleteReviewStats());

const hasSomeData = ref(false);

const deleteTweetsCountNotArchived = ref(0);

onMounted(async () => {
    await props.model.refreshDatabaseStats();
    deleteReviewStats.value = props.model.deleteReviewStats;
    hasSomeData.value = await xHasSomeData(props.model.account.id);

    if (props.model.account?.xAccount?.deleteMyData && props.model.account?.xAccount?.deleteTweets) {
        deleteTweetsCountNotArchived.value = await window.electron.X.deleteTweetsCountNotArchived(props.model.account?.id);
        console.log("deleteTweetsCountNotArchived", deleteTweetsCountNotArchived.value);
    }
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
                    Build a local database
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

            <div v-if="model.account?.xAccount?.archiveMyData">
                <h3>
                    <i class="fa-solid fa-floppy-disk me-1" />
                    Archive my data
                </h3>
                <ul>
                    <li v-if="model.account?.xAccount?.archiveTweetsHTML">
                        Save HTML versions of tweets
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
                </h3>
                <ul>
                    <li v-if="hasSomeData && model.account?.xAccount?.deleteTweets">
                        <b>{{ deleteReviewStats.tweetsToDelete.toLocaleString() }} tweets</b>
                        <span v-if="model.account?.xAccount?.deleteTweetsDaysOldEnabled">
                            that are older than {{ model.account?.xAccount?.deleteTweetsDaysOld }} days
                        </span>
                        <span
                            v-if="model.account?.xAccount?.deleteTweetsRetweetsThresholdEnabled && !model.account?.xAccount?.deleteTweetsLikesThresholdEnabled">
                            unless they have at least {{ model.account?.xAccount?.deleteTweetsRetweetsThreshold }}
                            retweets
                        </span>
                        <span
                            v-if="!model.account?.xAccount?.deleteTweetsRetweetsThresholdEnabled && model.account?.xAccount?.deleteTweetsLikesThresholdEnabled">
                            unless they have at least {{ model.account?.xAccount?.deleteTweetsLikesThreshold }} likes
                        </span>
                        <span
                            v-if="model.account?.xAccount?.deleteTweetsRetweetsThresholdEnabled && model.account?.xAccount?.deleteTweetsLikesThresholdEnabled">
                            unless they have at least {{ model.account?.xAccount?.deleteTweetsRetweetsThreshold }}
                            retweets
                            or {{
                                model.account?.xAccount?.deleteTweetsLikesThreshold }} likes
                        </span>
                        <div v-if="deleteTweetsCountNotArchived > 0">
                            <small v-if="deleteTweetsCountNotArchived == deleteReviewStats.tweetsToDelete"
                                class="text-form">
                                <i class="fa-solid fa-circle-info" />
                                You haven't saved an HTML version of any of these tweets.
                            </small>
                            <small v-else class="text-form">
                                <i class="fa-solid fa-circle-info" />
                                You haven't saved an HTML version of {{ deleteTweetsCountNotArchived.toLocaleString() }}
                                of these tweets.
                            </small>
                        </div>
                        <div v-if="deleteTweetsCountNotArchived > 0">
                            <small class="text-form">
                                <i class="fa-solid fa-triangle-exclamation" />
                                If you want an HTML version of your each tweet, <a href="#">archive your tweets</a>
                                before you delete them. This takes a lot of time, so if you don't care, you should just
                                delete them.
                            </small>
                        </div>
                    </li>
                    <li v-if="hasSomeData && model.account?.xAccount?.deleteRetweets">
                        <b>{{ deleteReviewStats.retweetsToDelete.toLocaleString() }} retweets</b>
                        <span v-if="model.account?.xAccount?.deleteRetweetsDaysOldEnabled">
                            that are older than {{ model.account?.xAccount?.deleteRetweetsDaysOld }} days
                        </span>
                    </li>
                    <li v-if="hasSomeData && model.account?.xAccount?.deleteLikes">
                        <b>{{ deleteReviewStats.likesToDelete.toLocaleString() }} likes</b>
                    </li>
                    <li v-if="model.account?.xAccount?.unfollowEveryone">
                        <b>Unfollow everyone</b>
                    </li>
                    <li v-if="model.account?.xAccount?.deleteDMs">
                        <b>All of your direct messages</b>
                    </li>
                </ul>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    <template v-if="model.account?.xAccount?.deleteMyData">
                        Back to Delete Options
                    </template>
                    <template v-else>
                        Back to Build Options
                    </template>
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!(model.account?.xAccount?.archiveTweets || model.account?.xAccount?.archiveLikes || model.account?.xAccount?.archiveDMs)"
                    @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="model.account?.xAccount?.saveMyData">
                        Build Database
                    </template>
                    <template v-if="model.account?.xAccount?.archiveMyData">
                        Start Archiving
                    </template>
                    <template v-else>
                        Start Deleting
                    </template>
                </button>
            </div>
        </form>

        <div class="alert alert-info mt-4" role="alert">
            <p class="fw-bold mb-0">
                X restricts how fast you can access your data using <span class="fst-italic">rate limits</span>.
            </p>
            <p class="alert-details mb-0">
                You might hit rate limits while Cyd works. Cyd will pause and wait for the rate limit to reset before
                continuing.
            </p>
        </div>
        <div class="alert alert-info" role="alert">
            <p class="fw-bold mb-0">
                Your computer needs to be awake to use Cyd.
            </p>
            <p class="alert-details mb-0">
                Don't close the lid, keep it plugged in, and disable sleep while plugged in.
                <a href="#" @click="openPreventSleepURL">Learn more.</a>
            </p>
        </div>
    </div>
</template>

<style scoped></style>