<script setup lang="ts">
import {
    ref,
    onMounted,
    getCurrentInstance,
} from 'vue';
import {
    XViewModel,
    State,
    FailureState
} from '../../view_models/XViewModel'
import { openURL, getJobsType } from '../../util';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    model: XViewModel;
    // eslint-disable-next-line vue/prop-name-casing
    failureStateIndexTweets_FailedToRetryAfterRateLimit: boolean;
    // eslint-disable-next-line vue/prop-name-casing
    failureStateIndexLikes_FailedToRetryAfterRateLimit: boolean;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    onRefreshClicked: [],
}>()

// Buttons
const runAgainClicked = async () => {
    // Keep the same review type in localStorage
    emit('setState', State.WizardReview);
};

const nextClicked = async () => {
    if (jobsType.value == 'save') {
        emit('setState', State.WizardStart);
    } else {
        emit('onRefreshClicked');
    }
};

const submitErrorReportClicked = async () => {
    hideErrors.value = true;
    emitter.emit("show-automation-error", props.model.account.id);
};

// Settings
const archivePath = ref('');

const showFailureBoth = ref(false);
const showFailureTweets = ref(false);
const showFailureLikes = ref(false);

const updateArchivePath = async () => {
    const path = await window.electron.getAccountDataPath(props.model.account.id, '');
    archivePath.value = path ? path : '';
};

const hideErrors = ref(false);
const jobsType = ref('');

onMounted(async () => {
    jobsType.value = getJobsType(props.model.account.id) || '';
    console.log(jobsType.value);

    await props.model.reloadAccount();
    await updateArchivePath();

    // See if we need to show any of the failure alerts
    if (props.failureStateIndexTweets_FailedToRetryAfterRateLimit && props.failureStateIndexLikes_FailedToRetryAfterRateLimit && jobsType.value == 'save' && props.model.account.xAccount?.archiveTweets && props.model.account.xAccount?.archiveLikes) {
        showFailureBoth.value = true;
        showFailureTweets.value = false;
        showFailureLikes.value = false;
    }
    if (props.failureStateIndexTweets_FailedToRetryAfterRateLimit && (jobsType.value == 'save' && props.model.account.xAccount?.archiveTweets)) {
        showFailureTweets.value = true;
        showFailureLikes.value = false;
        showFailureBoth.value = false;
    } if (props.failureStateIndexLikes_FailedToRetryAfterRateLimit && (jobsType.value == 'save' && props.model.account.xAccount?.archiveLikes)) {
        showFailureLikes.value = true;
        showFailureTweets.value = false;
        showFailureBoth.value = false;
    }

    // Reset failure states
    await window.electron.X.setConfig(props.model.account?.id, FailureState.indexTweets_FailedToRetryAfterRateLimit, "false");
    await window.electron.X.setConfig(props.model.account?.id, FailureState.indexLikes_FailedToRetryAfterRateLimit, "false");
});
</script>

<template>
    <div class="finished">
        <div v-if="jobsType == 'save'" class="container mt-3">
            <div class="finished">
                <h2>You just saved:</h2>
                <ul>
                    <li v-if="(model.progress.newTweetsArchived ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.newTweetsArchived.toLocaleString() }}</strong> tweets
                        saved as HTML archives
                    </li>
                    <li v-if="model.account.xAccount?.archiveTweets || (model.progress.tweetsIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.tweetsIndexed.toLocaleString() }}</strong> tweets
                    </li>
                    <li v-if="model.account.xAccount?.archiveTweets || (model.progress.retweetsIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.retweetsIndexed.toLocaleString() }}</strong> retweets
                    </li>
                    <li v-if="model.account.xAccount?.archiveLikes || (model.progress.likesIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.likesIndexed.toLocaleString() }}</strong> likes
                    </li>
                    <li v-if="model.account.xAccount?.archiveBookmarks || (model.progress.bookmarksIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.bookmarksIndexed.toLocaleString() }}</strong> bookmarks
                    </li>
                    <li v-if="(model.progress.unknownIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.unknownIndexed.toLocaleString() }}</strong> other tweets
                        <span class="ms-3 small text-muted">
                            (<a href="#" @click="openURL('https://cyd.social/docs-other-tweets');">what's
                                this?</a>)
                        </span>
                    </li>
                    <li
                        v-if="model.account.xAccount?.archiveDMs || (model.progress.conversationsIndexed ?? 0) > 0 || (model.progress.messagesIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.conversationsIndexed.toLocaleString() }}</strong>
                        conversations,
                        including <strong>{{ model.progress.messagesIndexed.toLocaleString() }}</strong>
                        messages
                    </li>
                </ul>

                <p>
                    Your X archive is stored locally on your computer at
                    <code>{{ archivePath }}</code>.
                </p>
            </div>
        </div>
        <div v-if="jobsType == 'archive'" class="container mt-3">
            <div class="finished">
                <h2>You just archived:</h2>
                <ul>
                    <li v-if="model.account.xAccount?.archiveTweetsHTML">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.newTweetsArchived.toLocaleString() }}</strong> tweets
                        saved as HTML archives
                    </li>
                    <li
                        v-if="model.account.xAccount?.archiveDMs || (model.progress.conversationsIndexed ?? 0) > 0 || (model.progress.messagesIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ model.progress.conversationsIndexed.toLocaleString() }}</strong>
                        conversations,
                        including <strong>{{ model.progress.messagesIndexed.toLocaleString() }}</strong>
                        messages
                    </li>
                </ul>

                <p>
                    Your X archive is stored locally on your computer at
                    <code>{{ archivePath }}</code>.
                </p>
            </div>
        </div>
        <div v-if="jobsType == 'delete'" class="container mt-3">
            <div class="finished">
                <h2>You just deleted:</h2>
                <ul>
                    <li v-if="model.account.xAccount?.deleteTweets || (model.progress.tweetsDeleted ?? 0) > 0">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ model.progress.tweetsDeleted.toLocaleString() }}</strong> tweets
                    </li>
                    <li v-if="model.account.xAccount?.deleteRetweets || (model.progress.retweetsDeleted ?? 0) > 0">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ model.progress.retweetsDeleted.toLocaleString() }}</strong> retweets
                    </li>
                    <li v-if="model.account.xAccount?.deleteLikes || (model.progress.likesDeleted ?? 0) > 0">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ model.progress.likesDeleted.toLocaleString() }}</strong> likes
                    </li>
                    <li v-if="model.account.xAccount?.deleteBookmarks || (model.progress.bookmarksDeleted ?? 0) > 0">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ model.progress.bookmarksDeleted.toLocaleString() }}</strong> bookmarks
                    </li>
                    <li v-if="model.account.xAccount?.deleteDMs">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ model.progress.conversationsDeleted.toLocaleString() }}</strong> direct
                        message conversations
                    </li>
                    <li v-if="model.account.xAccount?.unfollowEveryone">
                        <i class="fa-solid fa-fire delete-bullet" />
                        Unfollowed <strong>{{ model.progress.accountsUnfollowed.toLocaleString() }}</strong> accounts
                    </li>
                </ul>
            </div>
        </div>

        <div v-if="jobsType == 'migrateBluesky'" class="container mt-3">
            <div class="finished">
                <h2>You just migrated:</h2>
                <ul>
                    <li>
                        <i class="fa-brands fa-bluesky bluesky-bullet" />
                        <strong>{{ model.progress.migrateTweetsCount.toLocaleString() }}</strong> tweets to
                        Bluesky
                    </li>
                </ul>
            </div>
        </div>

        <div v-if="jobsType == 'migrateBlueskyDelete'" class="container mt-3">
            <div class="finished">
                <h2>You just deleted:</h2>
                <ul>
                    <li>
                        <i class="fa-brands fa-bluesky bluesky-bullet" />
                        <strong>{{ model.progress.migrateDeletePostsCount.toLocaleString() }}</strong> posts that were
                        migrated to Bluesky
                    </li>
                </ul>
            </div>
        </div>

        <div v-if="!hideErrors && model.progress.errorsOccured > 0" class="alert alert-danger mt-4" role="alert">
            <p>
                <strong>Uh oh, Cyd encountered {{ model.progress.errorsOccured.toLocaleString() }} errors.</strong>
                Please submit an error report so we can fix the problems you encountered.
            </p>
            <button class="btn btn-primary" @click="submitErrorReportClicked">
                Submit Error Report
            </button>
        </div>

        <div v-if="showFailureBoth || showFailureTweets || showFailureLikes" class="alert alert-danger mt-4"
            role="alert">
            <p v-if="showFailureBoth" class="fw-bold mb-0">
                Cyd wasn't able to scroll through all of your tweets and likes this time.
            </p>
            <p v-if="showFailureTweets" class="fw-bold mb-0">
                Cyd wasn't able to scroll through all of your tweets this time.
            </p>
            <p v-if="showFailureLikes" class="fw-bold mb-0">
                Cyd wasn't able to scroll through all of your likes this time.
            </p>
            <p class="alert-details mb-0">
                Run Cyd again with the same settings to try again from the beginning.
            </p>
        </div>

        <div class="buttons">
            <template v-if="(
                failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                (
                    (jobsType == 'save' && model.account.xAccount?.archiveTweets) ||
                    (jobsType == 'delete' && model.account.xAccount?.deleteTweets))
            ) || (
                    failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                    ((jobsType == 'save' && model.account.xAccount?.archiveLikes) || (jobsType == 'delete' && model.account.xAccount?.deleteLikes))
                )">
                <button type="submit" class="btn btn-primary text-nowrap m-1" @click="runAgainClicked">
                    <i class="fa-solid fa-repeat" />
                    Run Again with Same Settings
                </button>

                <button class="btn btn-secondary" @click="nextClicked">
                    Continue
                </button>
            </template>
            <template v-else>
                <button class="btn btn-primary" @click="nextClicked">
                    Continue
                </button>
            </template>
        </div>
    </div>
</template>

<style scoped>
.delete-bullet {
    color: rgb(218, 82, 41);
    margin-right: 5px;
}

.archive-bullet {
    color: rgb(50, 164, 164);
    margin-right: 5px;
}

.bluesky-bullet {
    color: #0091ff;
    margin-right: 5px;
}

.finished ul,
.finished ul,
.finished ul {
    list-style-type: none;
    padding-left: 0;
    margin-left: 1.5em;
}

.finished li,
.finished li,
.finished li {
    margin-bottom: 0.2rem;
}
</style>