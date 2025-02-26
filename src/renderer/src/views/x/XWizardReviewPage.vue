<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'
import { openPreventSleepURL, getJobsType } from '../../util';
import { XDeleteReviewStats, emptyXDeleteReviewStats, XMigrateTweetCounts, emptyXMigrateTweetCounts } from '../../../../shared_types';
import { xHasSomeData } from '../../util_x';

// Props
const props = defineProps<{
    model: XViewModel;
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

const jobsType = ref('');

const backClicked = async () => {
    if (jobsType.value == 'delete') {
        emit('setState', State.WizardDeleteOptions);
    } else if (jobsType.value == 'save') {
        emit('setState', State.WizardBuildOptions);
    } else if (jobsType.value == 'archive') {
        emit('setState', State.WizardArchiveOptions);
    } else if (jobsType.value == 'migrateBluesky' || jobsType.value == 'migrateBlueskyDelete') {
        emit('setState', State.WizardMigrateToBluesky);
    } else {
        // Display error
        console.error('Unknown review type:', jobsType.value);
        await window.electron.showError("Oops, this is awkward. You clicked back, but I'm not sure where to go.");
    }
};

const archiveClicked = async () => {
    emit('setState', State.WizardArchiveOptions);
};

// Settings
const deleteReviewStats = ref<XDeleteReviewStats>(emptyXDeleteReviewStats());
const hasSomeData = ref(false);
const tweetCounts = ref<XMigrateTweetCounts>(emptyXMigrateTweetCounts());

const deleteTweetsCountNotArchived = ref(0);

onMounted(async () => {
    jobsType.value = getJobsType(props.model.account.id) || '';

    await props.model.refreshDatabaseStats();
    deleteReviewStats.value = props.model.deleteReviewStats;
    hasSomeData.value = await xHasSomeData(props.model.account.id);
    tweetCounts.value = await window.electron.X.blueskyGetTweetCounts(props.model.account.id) || emptyXMigrateTweetCounts();

    if (jobsType.value == 'delete' && props.model.account?.xAccount?.deleteTweets) {
        deleteTweetsCountNotArchived.value = await window.electron.X.deleteTweetsCountNotArchived(props.model.account?.id, false);
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
            <div v-if="jobsType == 'save'">
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
                    <li v-if="model.account?.xAccount?.archiveBookmarks">
                        Save bookmarks
                    </li>
                    <li v-if="model.account?.xAccount?.archiveDMs">
                        Save direct messages
                    </li>
                </ul>
            </div>

            <div v-if="jobsType == 'archive'">
                <h3>
                    <i class="fa-solid fa-floppy-disk me-1" />
                    Archive my data
                </h3>
                <ul>
                    <li v-if="model.account?.xAccount?.archiveTweetsHTML">
                        Save HTML versions of tweets
                    </li>
                    <li v-if="model.account?.xAccount?.archiveBookmarks">
                        Save bookmarks
                    </li>
                    <li v-if="model.account?.xAccount?.archiveDMs">
                        Save direct messages
                    </li>
                </ul>
            </div>

            <div v-if="jobsType == 'delete'">
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
                            <small class="text-form">
                                <i class="fa-solid fa-triangle-exclamation" />
                                <em>
                                    <span v-if="deleteTweetsCountNotArchived == deleteReviewStats.tweetsToDelete">
                                        You haven't saved HTML versions of any of these tweets.
                                    </span>
                                    <span v-else>
                                        You haven't saved HTML versions of {{
                                            deleteTweetsCountNotArchived.toLocaleString()
                                        }}
                                        of these tweets.
                                    </span>
                                </em>
                                <span>
                                    If you care, <a href="#" @click="archiveClicked">archive your tweets</a>
                                    before you delete them. Otherwise, just delete them.
                                </span>
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
                    <li v-if="hasSomeData && model.account?.xAccount?.deleteBookmarks">
                        <b>{{ deleteReviewStats.bookmarksToDelete.toLocaleString() }} bookmarks</b>
                    </li>
                    <li v-if="model.account?.xAccount?.unfollowEveryone">
                        <b>Unfollow everyone</b>
                    </li>
                    <li v-if="model.account?.xAccount?.deleteDMs">
                        <b>All of your direct messages</b>
                    </li>
                </ul>
            </div>

            <div v-if="jobsType == 'migrateBluesky'">
                <h3>
                    <i class="fa-brands fa-bluesky me-1" />
                    Migrate to Bluesky
                </h3>
                <ul>
                    <li>
                        Migrate
                        <b>{{ tweetCounts.toMigrateTweetIDs.length.toLocaleString() }} tweets</b>
                        to Bluesky
                    </li>
                </ul>
            </div>

            <div v-if="jobsType == 'migrateBlueskyDelete'">
                <h3>
                    <i class="fa-brands fa-bluesky me-1" />
                    Delete Migrated Bluesky Posts
                </h3>
                <ul>
                    <li>
                        Delete
                        <b>{{ tweetCounts.alreadyMigratedTweetIDs.length.toLocaleString() }} posts</b>
                        from Bluesky
                    </li>
                </ul>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    <template v-if="jobsType == 'delete'">
                        Back to Delete Options
                    </template>
                    <template v-else-if="jobsType == 'save'">
                        Back to Build Options
                    </template>
                    <template v-else-if="jobsType == 'archive'">
                        Back to Archive Options
                    </template>
                    <template v-else-if="jobsType == 'migrateBluesky' || jobsType == 'migrateBlueskyDelete'">
                        Back to Migrate to Bluesky Options
                    </template>
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="!(model.account?.xAccount?.archiveTweets || model.account?.xAccount?.archiveLikes || model.account?.xAccount?.archiveBookmarks || model.account?.xAccount?.archiveDMs)"
                    @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="jobsType == 'save'">
                        Build Database
                    </template>
                    <template v-else-if="jobsType == 'archive'">
                        Start Archiving
                    </template>
                    <template v-else-if="jobsType == 'delete' || jobsType == 'migrateBlueskyDelete'">
                        Start Deleting
                    </template>
                    <template v-else-if="jobsType == 'migrateBluesky'">
                        Start Migrating
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