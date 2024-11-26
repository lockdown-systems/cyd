<script setup lang="ts">
import {
    ref,
    watch,
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../view_models/AccountXViewModel'
import { emptyXDeleteReviewStats } from '../../../shared_types';
import type { XDeleteReviewStats } from '../../../shared_types';

// Props
const props = defineProps<{
    model: AccountXViewModel | null;
    // eslint-disable-next-line vue/prop-name-casing
    failureStateIndexTweets_FailedToRetryAfterRateLimit: boolean;
    // eslint-disable-next-line vue/prop-name-casing
    failureStateIndexLikes_FailedToRetryAfterRateLimit: boolean;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    startStateLoop: []
    startJobsDeleteReview: []
}>()

// Keep deleteReviewStats in sync
const deleteReviewStats = ref<XDeleteReviewStats>(emptyXDeleteReviewStats());
watch(
    () => props.model?.deleteReviewStats,
    (newDeleteReviewStats) => {
        if (newDeleteReviewStats) {
            deleteReviewStats.value = newDeleteReviewStats as XDeleteReviewStats;
        }
    },
    { deep: true, }
);

// Buttons
const nextClicked = async () => {
    emit('startJobsDeleteReview');
};

const backClicked = async () => {
    emit('setState', State.WizardDeleteOptions);
    emit('startStateLoop');
};
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
        <h2>
            Based on your settings, you will delete:
        </h2>
        <form @submit.prevent>
            <ul>
                <li v-if="model?.account.xAccount?.deleteTweets">
                    <b>{{ deleteReviewStats.tweetsToDelete.toLocaleString() }} tweets</b>
                    that are older than {{ model?.account.xAccount?.deleteTweetsDaysOld }} days
                    <span
                        v-if="model?.account.xAccount?.deleteTweetsRetweetsThresholdEnabled && !model?.account.xAccount?.deleteTweetsLikesThresholdEnabled">
                        unless they have at least {{ model?.account.xAccount?.deleteTweetsRetweetsThreshold }} retweets
                    </span>
                    <span
                        v-if="!model?.account.xAccount?.deleteTweetsRetweetsThresholdEnabled && model?.account.xAccount?.deleteTweetsLikesThresholdEnabled">
                        unless they have at least {{ model?.account.xAccount?.deleteTweetsLikesThreshold }} likes
                    </span>
                    <span
                        v-if="model?.account.xAccount?.deleteTweetsRetweetsThresholdEnabled && model?.account.xAccount?.deleteTweetsLikesThresholdEnabled">
                        unless they have at least {{ model?.account.xAccount?.deleteTweetsRetweetsThreshold }} retweets
                        or {{
                            model?.account.xAccount?.deleteTweetsLikesThreshold }} likes
                    </span>
                </li>
                <li v-if="model?.account.xAccount?.deleteRetweets">
                    <b>{{ deleteReviewStats.retweetsToDelete.toLocaleString() }} retweets</b>
                    that are older than {{ model?.account.xAccount?.deleteRetweetsDaysOld }} days
                </li>
                <li v-if="model?.account.xAccount?.deleteLikes">
                    <b>{{ deleteReviewStats.likesToDelete.toLocaleString() }} likes</b>
                    that are older than {{ model?.account.xAccount?.deleteLikesDaysOld }} days
                </li>
                <li v-if="model?.account.xAccount?.deleteDMs">
                    <b>All of your direct messages</b>
                </li>
            </ul>

            <div v-if="
                (
                    failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                    (model?.account.xAccount?.archiveTweets || model?.account.xAccount?.deleteTweets)
                ) || (
                    failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                    (model?.account.xAccount?.archiveLikes || model?.account.xAccount?.deleteLikes)
                )" class="alert alert-danger mt-4" role="alert">
                <p v-if="
                    (
                        failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                        (model?.account.xAccount?.archiveTweets || model?.account.xAccount?.deleteTweets)
                    ) && (failureStateIndexLikes_FailedToRetryAfterRateLimit && (model?.account.xAccount?.archiveLikes || model?.account.xAccount?.deleteLikes))"
                    class="fw-bold mb-0">
                    Cyd wasn't able to scroll through all of your tweets and likes this time.
                </p>
                <p v-if="(
                    failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                    (model?.account.xAccount?.archiveTweets || model?.account.xAccount?.deleteTweets)
                ) && !(failureStateIndexLikes_FailedToRetryAfterRateLimit && (model?.account.xAccount?.archiveLikes || model?.account.xAccount?.deleteLikes))"
                    class="fw-bold mb-0">
                    Cyd wasn't able to scroll through all of your tweets this time.
                </p>
                <p v-if="
                    !(
                        failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                        (model?.account.xAccount?.archiveTweets || model?.account.xAccount?.deleteTweets)
                    ) && (failureStateIndexLikes_FailedToRetryAfterRateLimit && (model?.account.xAccount?.archiveLikes || model?.account.xAccount?.deleteLikes))"
                    class="fw-bold mb-0">
                    Cyd wasn't able to scroll through all of your likes this time.
                </p>
                <p class="alert-details mb-0">
                    Sorry, X can be annoying sometimes. Go ahead and delete some of your data now, and
                    then run Cyd again to delete more.
                </p>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Delete Options
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!(model?.account.xAccount?.archiveTweets || model?.account.xAccount?.archiveLikes || model?.account.xAccount?.archiveDMs)"
                    @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    Start Deleting
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>