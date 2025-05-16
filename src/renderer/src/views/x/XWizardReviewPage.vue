<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
    XViewModel,
    State,
    tombstoneUpdateBioCreditCydText
} from '../../view_models/XViewModel'
import { openURL, getJobsType } from '../../util';
import { XDeleteReviewStats, emptyXDeleteReviewStats, XMigrateTweetCounts, emptyXMigrateTweetCounts } from '../../../../shared_types';
import { xHasSomeData } from '../../util_x';
import LoadingComponent from '../shared_components/LoadingComponent.vue';
import AlertStayAwake from '../shared_components/AlertStayAwake.vue';
import XTombstoneBannerComponent from './XTombstoneBannerComponent.vue';
import { TombstoneBannerBackground, TombstoneBannerSocialIcons } from '../../types_x';

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
    } else if (jobsType.value == 'tombstone') {
        emit('setState', State.WizardTombstone);
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

const tombstoneUpdateBannerBackground = ref<TombstoneBannerBackground>(TombstoneBannerBackground.Night);
const tombstoneUpdateBannerSocialIcons = ref<TombstoneBannerSocialIcons>(TombstoneBannerSocialIcons.None);

const deleteTweetsCountNotArchived = ref(0);

onMounted(async () => {
    loading.value = true;

    jobsType.value = getJobsType(props.model.account.id) || '';

    deleteReviewStats.value = await window.electron.X.getDeleteReviewStats(props.model.account.id);
    hasSomeData.value = await xHasSomeData(props.model.account.id);
    tweetCounts.value = await window.electron.X.blueskyGetTweetCounts(props.model.account.id) || emptyXMigrateTweetCounts();

    if (jobsType.value == 'delete' && props.model.account?.xAccount?.deleteTweets) {
        deleteTweetsCountNotArchived.value = await window.electron.X.deleteTweetsCountNotArchived(props.model.account?.id, false);
    }

    if (jobsType.value == 'tombstone') {
        if (props.model.account?.xAccount?.tombstoneUpdateBannerBackground == 'morning') {
            tombstoneUpdateBannerBackground.value = TombstoneBannerBackground.Morning;
        } else {
            tombstoneUpdateBannerBackground.value = TombstoneBannerBackground.Night;
        }

        if (props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons == 'bluesky') {
            tombstoneUpdateBannerSocialIcons.value = TombstoneBannerSocialIcons.Bluesky;
        } else if (props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons == 'mastodon') {
            tombstoneUpdateBannerSocialIcons.value = TombstoneBannerSocialIcons.Mastodon;
        } else if (props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons == 'bluesky-mastodon') {
            tombstoneUpdateBannerSocialIcons.value = TombstoneBannerSocialIcons.BlueskyMastodon;
        } else if (props.model.account?.xAccount?.tombstoneUpdateBannerSocialIcons == 'mastodon-bluesky') {
            tombstoneUpdateBannerSocialIcons.value = TombstoneBannerSocialIcons.MastodonBluesky;
        } else {
            tombstoneUpdateBannerSocialIcons.value = TombstoneBannerSocialIcons.None;
        }
    }

    loading.value = false;
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
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
                                unless they have at least {{ model.account?.xAccount?.deleteTweetsRetweetsThreshold }}
                                retweets
                            </span>
                            <span
                                v-if="!model.account?.xAccount?.deleteTweetsRetweetsThresholdEnabled && model.account?.xAccount?.deleteTweetsLikesThresholdEnabled">
                                unless they have at least {{ model.account?.xAccount?.deleteTweetsLikesThreshold }}
                                likes
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

                <div v-if="jobsType == 'tombstone'">
                    <h3>
                        <i class="fa-solid fa-skull me-1" />
                        Tombstone
                    </h3>
                    <ul>
                        <li v-if="model.account?.xAccount?.tombstoneUpdateBanner">
                            <div>Update your banner</div>
                            <XTombstoneBannerComponent :update-banner="model.account?.xAccount?.tombstoneUpdateBanner"
                                :update-banner-background="tombstoneUpdateBannerBackground"
                                :update-banner-social-icons="tombstoneUpdateBannerSocialIcons"
                                :update-banner-show-text="model.account?.xAccount?.tombstoneUpdateBannerShowText" />
                        </li>
                        <li v-if="model.account?.xAccount?.tombstoneUpdateBio">
                            <div>Update your bio</div>
                            <p class="text-center text-muted small mb-1">
                                Bio Preview
                            </p>
                            <p class="small">
                                {{ model.account?.xAccount?.tombstoneUpdateBioText }}
                                <span v-if="model.account?.xAccount?.tombstoneUpdateBioCreditCyd">
                                    {{ tombstoneUpdateBioCreditCydText }}
                                </span>
                            </p>
                        </li>
                        <li v-if="model.account?.xAccount?.tombstoneLockAccount">
                            Lock your account
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
                        <template v-else-if="jobsType == 'tombstone'">
                            Back to Tombstone Options
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
                        <template v-else-if="jobsType == 'tombstone'">
                            Update Profile
                        </template>
                    </button>
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

            <div v-if="jobsType == 'migrateBluesky' || jobsType == 'migrateBlueskyDelete'" class="alert alert-info mt-4"
                role="alert">
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
</template>

<style scoped></style>
