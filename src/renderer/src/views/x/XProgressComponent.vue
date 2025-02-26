<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { XProgress, XRateLimitInfo } from '../../../../shared_types';
import XProgressErrorsOccuredComponent from './XProgressErrorsOccuredComponent.vue';

const intervalID = ref<number | null>(null);
const rateLimitSecondsLeft = ref<number | null>(null);

const props = defineProps<{
    progress: XProgress | null;
    rateLimitInfo: XRateLimitInfo | null;
    accountID: number;
}>();

const formatSeconds = (seconds: number | null) => {
    if (seconds === null) {
        return '';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes == 0) {
        return `${remainingSeconds} seconds`;
    }
    return `${minutes} minutes, ${remainingSeconds} seconds`;
};

onMounted(() => {
    // @ts-expect-error intervalID is a NodeJS.Interval, not a number
    intervalID.value = setInterval(() => {
        if (props.rateLimitInfo && props.rateLimitInfo.isRateLimited && props.rateLimitInfo.rateLimitReset) {
            const rateLimitReset = props.rateLimitInfo.rateLimitReset;
            const currentUTCTimestamp = Math.floor(Date.now() / 1000);
            rateLimitSecondsLeft.value = rateLimitReset - currentUTCTimestamp;
            if (rateLimitSecondsLeft.value <= 0) {
                rateLimitSecondsLeft.value = 0;
            }
        }
    }, 1000);
});

onUnmounted(() => {
    if (intervalID.value) {
        clearInterval(intervalID.value);
    }
});
</script>

<template>
    <template v-if="progress">
        <div class="progress-wrapper">
            <!-- Login -->
            <template v-if="progress.currentJob == 'login'">
                <p>Logging in</p>
            </template>

            <!-- Index tweets -->
            <template v-if="progress.currentJob == 'indexTweets'">
                <p>
                    Saved
                    <b>{{ progress.tweetsIndexed.toLocaleString() }} tweets</b> and
                    <b>{{ progress.retweetsIndexed.toLocaleString() }} retweets</b>.
                    <span v-if="progress.unknownIndexed > 0" class="text-muted">
                        Also saved {{ progress.unknownIndexed.toLocaleString() }} other tweets.
                    </span>
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isIndexTweetsFinished">
                        Saving complete!
                    </template>
                </p>
            </template>

            <!-- Index conversations -->
            <template v-if="progress.currentJob == 'indexConversations'">
                <p>
                    Saved
                    <b>{{ progress.conversationsIndexed.toLocaleString() }} conversations</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isIndexConversationsFinished">
                        Saving complete!
                    </template>
                </p>
            </template>

            <!-- Index messages -->
            <template v-if="progress.currentJob == 'indexMessages'">
                <p v-if="progress.totalConversations">
                    Saved <b>{{ progress.messagesIndexed.toLocaleString() }} messages</b> from <b>{{
                        progress.conversationMessagesIndexed.toLocaleString() }} of {{
                            progress.totalConversations.toLocaleString() }} conversations</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isIndexMessagesFinished">
                        Saving complete!
                    </template>
                </p>
                <div v-if="progress.totalConversations" class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.conversationMessagesIndexed / progress.totalConversations) * 100}%` }"
                            :aria-valuenow="(progress.conversationMessagesIndexed / progress.totalConversations) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.conversationMessagesIndexed / progress.totalConversations) * 100)
                            }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Index likes -->
            <template v-if="progress.currentJob == 'indexLikes'">
                <p>
                    Saved
                    <b>{{ progress.likesIndexed.toLocaleString() }} likes</b>.
                    <span v-if="progress.unknownIndexed > 0" class="text-muted">
                        Also saved {{ progress.unknownIndexed.toLocaleString() }} other tweets.
                    </span>
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isIndexLikesFinished">
                        Saving complete!
                    </template>
                </p>
            </template>

            <!-- Index bookmarks -->
            <template v-if="progress.currentJob == 'indexBookmarks'">
                <p>
                    Saved
                    <b>{{ progress.bookmarksIndexed.toLocaleString() }} bookmarks</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isIndexBookmarksFinished">
                        Saving complete!
                    </template>
                </p>
            </template>

            <!-- Archive Tweets -->
            <template v-if="progress.currentJob == 'archiveTweets'">
                <p>
                    Saved
                    <b>{{ progress.tweetsArchived.toLocaleString() }} of
                        {{ progress.totalTweetsToArchive.toLocaleString() }} tweets</b> as HTML.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isArchiveTweetsFinished">
                        Finished saving tweets as HTML!
                    </template>
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.tweetsArchived / progress.totalTweetsToArchive) * 100}%` }"
                            :aria-valuenow="(progress.tweetsArchived / progress.totalTweetsToArchive) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.tweetsArchived / progress.totalTweetsToArchive) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete Tweets -->
            <template v-if="progress.currentJob == 'deleteTweets'">
                <p>
                    Deleted
                    <b>{{ progress.tweetsDeleted.toLocaleString() }} of
                        {{ progress.totalTweetsToDelete.toLocaleString() }} tweets</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.tweetsDeleted / progress.totalTweetsToDelete) * 100}%` }"
                            :aria-valuenow="(progress.tweetsDeleted / progress.totalTweetsToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.tweetsDeleted / progress.totalTweetsToDelete) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete Retweets -->
            <template v-if="progress.currentJob == 'deleteRetweets'">
                <p>
                    Deleted
                    <b>{{ progress.retweetsDeleted.toLocaleString() }} of
                        {{ progress.totalRetweetsToDelete.toLocaleString() }} retweets</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.retweetsDeleted / progress.totalRetweetsToDelete) * 100}%` }"
                            :aria-valuenow="(progress.retweetsDeleted / progress.totalRetweetsToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.retweetsDeleted / progress.totalRetweetsToDelete) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete Likes -->
            <template v-if="progress.currentJob == 'deleteLikes'">
                <p>
                    Deleted
                    <b>{{ progress.likesDeleted.toLocaleString() }} of
                        {{ progress.totalLikesToDelete.toLocaleString() }} likes</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.likesDeleted / progress.totalLikesToDelete) * 100}%` }"
                            :aria-valuenow="(progress.likesDeleted / progress.totalLikesToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.likesDeleted / progress.totalLikesToDelete) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete Bookmarks -->
            <template v-if="progress.currentJob == 'deleteBookmarks'">
                <p>
                    Deleted
                    <b>{{ progress.bookmarksDeleted.toLocaleString() }} of
                        {{ progress.totalBookmarksToDelete.toLocaleString() }} bookmarks</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${(progress.bookmarksDeleted / progress.totalBookmarksToDelete) * 100}%` }"
                            :aria-valuenow="(progress.bookmarksDeleted / progress.totalBookmarksToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round((progress.bookmarksDeleted / progress.totalBookmarksToDelete) * 100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Delete DMs -->
            <template v-if="progress.currentJob == 'deleteDMs'">
                <p>
                    Deleted
                    <b>{{ progress.conversationsDeleted.toLocaleString() }} conversations</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isDeleteDMsFinished">
                        Finished deleting direct messages!
                    </template>
                </p>
            </template>

            <!-- Unfollow everyone -->
            <template v-if="progress.currentJob == 'unfollowEveryone'">
                <p>
                    Unfollowed
                    <b>{{ progress.accountsUnfollowed.toLocaleString() }} accounts</b>.
                    <XProgressErrorsOccuredComponent :errors-occured="progress.errorsOccured" />
                    <template v-if="progress.isUnfollowEveryoneFinished">
                        Finished unfollowing everyone!
                    </template>
                </p>
            </template>

            <!-- Build archive -->
            <template v-if="progress.currentJob == 'archiveBuild'">
                <p>Building archive website</p>
            </template>

            <!-- Migrate to Bluesky -->
            <template v-if="progress.currentJob == 'migrateBluesky'">
                <p>
                    Migrated
                    <b>{{ progress.migrateTweetsCount.toLocaleString() }} of
                        {{ progress.totalTweetsToMigrate.toLocaleString() }} tweets</b>.
                    <XProgressErrorsOccuredComponent
                        :errors-occured="Object.keys(progress.migrateSkippedTweetsErrors).length" />
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${((progress.migrateTweetsCount + Object.keys(progress.migrateSkippedTweetsErrors).length) / progress.totalTweetsToMigrate) * 100}%` }"
                            :aria-valuenow="((progress.migrateTweetsCount + Object.keys(progress.migrateSkippedTweetsErrors).length) / progress.totalTweetsToMigrate) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round(((progress.migrateTweetsCount +
                                Object.keys(progress.migrateSkippedTweetsErrors).length) / progress.totalTweetsToMigrate) *
                            100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Migrate to Bluesky (delete posts) -->
            <template v-if="progress.currentJob == 'migrateBlueskyDelete'">
                <p>
                    Deleted
                    <b>{{ progress.migrateDeletePostsCount.toLocaleString() }} of
                        {{ progress.totalMigratedPostsToDelete.toLocaleString() }} posts</b>.
                    <XProgressErrorsOccuredComponent
                        :errors-occured="Object.keys(progress.migrateSkippedTweetsErrors).length" />
                </p>
                <div class="d-flex align-items-center justify-content-between">
                    <div class="progress flex-grow-1 me-2">
                        <div class="progress-bar" role="progressbar"
                            :style="{ width: `${((progress.migrateDeletePostsCount + Object.keys(progress.migrateSkippedTweetsErrors).length) / progress.totalMigratedPostsToDelete) * 100}%` }"
                            :aria-valuenow="((progress.migrateDeletePostsCount + Object.keys(progress.migrateSkippedTweetsErrors).length) / progress.totalMigratedPostsToDelete) * 100"
                            aria-valuemin="0" aria-valuemax="100">
                            {{ Math.round(((progress.migrateDeletePostsCount +
                                Object.keys(progress.migrateSkippedTweetsErrors).length) /
                                progress.totalMigratedPostsToDelete) *
                            100) }}%
                        </div>
                    </div>
                </div>
            </template>

            <!-- Rate Limit -->
            <p v-if="rateLimitInfo?.isRateLimited" class="rate-limit">
                You have hit a rate limit! <b>Waiting {{ formatSeconds(rateLimitSecondsLeft) }} to retry.</b>
            </p>
        </div>
    </template>
</template>

<style scoped>
.progress-wrapper {
    text-align: center;
    font-size: 0.8em;
    border-top: 1px solid #d0d0d0;
    margin-top: 5px;
    padding-top: 8px;
    margin-bottom: 10px;
}

.progress-wrapper p {
    margin: 0;
}

.progress {
    height: 20px;
}

.rate-limit {
    color: red;
}
</style>