<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'
import { getBreadcrumbIcon, openURL, getJobsType } from '../../util';
import { XDeleteReviewStats, emptyXDeleteReviewStats, XMigrateTweetCounts, emptyXMigrateTweetCounts } from '../../../../shared_types';
import { xHasSomeData } from '../../util_x';
import type { ButtonInfo } from '../../types';
import BreadcrumbsComponent from '../shared_components/BreadcrumbsComponent.vue';
import ButtonsComponent from '../shared_components/ButtonsComponent.vue';
import LoadingComponent from '../shared_components/LoadingComponent.vue';
import AlertStayAwake from '../shared_components/AlertStayAwake.vue';

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

const loading = ref(true);
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

const breadcrumbButtons = ref<ButtonInfo[]>([]);

onMounted(async () => {
    loading.value = true;

    jobsType.value = getJobsType(props.model.account.id) || '';

    deleteReviewStats.value = await window.electron.X.getDeleteReviewStats(props.model.account.id);
    hasSomeData.value = await xHasSomeData(props.model.account.id);
    tweetCounts.value = await window.electron.X.blueskyGetTweetCounts(props.model.account.id) || emptyXMigrateTweetCounts();

    if (jobsType.value == 'delete' && props.model.account?.xAccount?.deleteTweets) {
        deleteTweetsCountNotArchived.value = await window.electron.X.deleteTweetsCountNotArchived(props.model.account?.id, false);
    }

    // Define the breadcrumb buttons
    const localDatabaseButton: ButtonInfo = {
        label: 'Local Database',
        action: () => emit('setState', State.WizardDatabase),
        icon: getBreadcrumbIcon('database')
    };
    breadcrumbButtons.value = [
        { label: 'Dashboard', action: () => emit('setState', State.WizardDashboard), icon: 'fa-solid fa-house' },
    ];
    if (jobsType.value == 'delete') {
        breadcrumbButtons.value.push({
            label: 'Delete Options',
            action: () => emit('setState', State.WizardDeleteOptions),
            icon: getBreadcrumbIcon('delete')
        });
    } else if (jobsType.value == 'save') {
        breadcrumbButtons.value.push(localDatabaseButton);
        breadcrumbButtons.value.push({
            label: 'Build Options',
            action: () => emit('setState', State.WizardBuildOptions),
            icon: getBreadcrumbIcon('build')
        });
    } else if (jobsType.value == 'archive') {
        breadcrumbButtons.value.push(localDatabaseButton);
        breadcrumbButtons.value.push({
            label: 'Archive Options',
            action: () => emit('setState', State.WizardArchiveOptions),
            icon: getBreadcrumbIcon('build')
        });
    } else if (jobsType.value == 'migrateBluesky' || jobsType.value == 'migrateBlueskyDelete') {
        breadcrumbButtons.value.push({
            label: 'Migrate to Bluesky Options',
            action: () => emit('setState', State.WizardMigrateToBluesky),
            icon: getBreadcrumbIcon('bluesky')
        });
    }

    loading.value = false;
});
</script>

<template>
    <div class="wizard-content">
        <BreadcrumbsComponent :buttons="breadcrumbButtons" label="Review" :icon="getBreadcrumbIcon('review')" />

        <div class="wizard-scroll-content">
            <div class="mb-4">
                <h2>
                    Review your choices
                </h2>
            </div>

            <template v-if="loading">
                <LoadingComponent />
            </template>
            <template v-else>
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
                                    unless they have at least {{ model.account?.xAccount?.deleteTweetsRetweetsThreshold
                                    }}
                                    retweets
                                </span>
                                <span
                                    v-if="!model.account?.xAccount?.deleteTweetsRetweetsThresholdEnabled && model.account?.xAccount?.deleteTweetsLikesThresholdEnabled">
                                    unless they have at least {{ model.account?.xAccount?.deleteTweetsLikesThreshold }}
                                    likes
                                </span>
                                <span
                                    v-if="model.account?.xAccount?.deleteTweetsRetweetsThresholdEnabled && model.account?.xAccount?.deleteTweetsLikesThresholdEnabled">
                                    unless they have at least {{ model.account?.xAccount?.deleteTweetsRetweetsThreshold
                                    }}
                                    retweets
                                    or {{
                                        model.account?.xAccount?.deleteTweetsLikesThreshold }} likes
                                </span>
                                <div v-if="deleteTweetsCountNotArchived > 0">
                                    <small class="text-form">
                                        <i class="fa-solid fa-triangle-exclamation" />
                                        <em>
                                            <span
                                                v-if="deleteTweetsCountNotArchived == deleteReviewStats.tweetsToDelete">
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
                                <b>{{ tweetCounts.toMigrateTweets.length.toLocaleString() }} tweets</b>
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
                                <b>{{ tweetCounts.alreadyMigratedTweets.length.toLocaleString() }} posts</b>
                                from Bluesky
                            </li>
                        </ul>
                    </div>
                </form>

                <div v-if="jobsType == 'save' || jobsType == 'archive' || jobsType == 'delete'"
                    class="alert alert-info mt-4" role="alert">
                    <p class="fw-bold mb-0">
                        X restricts how fast you can access your data using <span class="fst-italic">rate limits</span>.
                    </p>
                    <p class="alert-details mb-0">
                        You might hit rate limits while Cyd works. Cyd will pause and wait for the rate limit to reset
                        before
                        continuing.
                    </p>
                </div>

                <div v-if="jobsType == 'migrateBluesky' || jobsType == 'migrateBlueskyDelete'"
                    class="alert alert-info mt-4" role="alert">
                    <p class="fw-bold mb-0">
                        Bluesky restricts how fast you create or delete posts using <span class="fst-italic">rate
                            limits</span>.
                    </p>
                    <p class="alert-details mb-0">
                        You might hit rate limits while Cyd works. Cyd will pause and wait for the rate limit to reset
                        before continuing. <a href="#"
                            @click="openURL('https://docs.bsky.app/docs/advanced-guides/rate-limits')">Learn
                            more.</a>
                    </p>
                </div>

                <AlertStayAwake />
            </template>
        </div>

        <ButtonsComponent :back-buttons="[
            {
                label: (jobsType == 'delete' ? 'Back to Delete Options' :
                    (jobsType == 'save' ? 'Back to Build Options' : (jobsType == 'archive' ? 'Back to Archive Options' : (jobsType == 'migrateBluesky' || jobsType == 'migrateBlueskyDelete' ? 'Back to Migrate to Bluesky Options' : '')))),
                action: backClicked,
                icon: 'fa-solid fa-backward'
            },
        ]" :next-buttons="[
            {
                label: (jobsType == 'save' ? 'Build Database' :
                    (jobsType == 'archive' ? 'Start Archiving' : (jobsType == 'delete' || jobsType == 'migrateBlueskyDelete' ? 'Start Deleting' : (jobsType == 'migrateBluesky' ? 'Start Migrating' : '')))),
                action: nextClicked,
                icon: 'fa-solid fa-forward',
                disabled: !(model.account?.xAccount?.archiveTweets || model.account?.xAccount?.archiveLikes || model.account?.xAccount?.archiveBookmarks || model.account?.xAccount?.archiveDMs) && (jobsType == 'save' || jobsType == 'archive' || jobsType == 'delete')
            },
        ]" />
    </div>
</template>

<style scoped></style>
