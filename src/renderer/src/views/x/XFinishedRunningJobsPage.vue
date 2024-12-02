<script setup lang="ts">
import {
    ref,
    onMounted,
    getCurrentInstance,
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'
import { openURL } from '../../util';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    model: AccountXViewModel;
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
    emit('setState', State.WizardReview);
};

const nextClicked = async () => {
    if (props.model.account.xAccount?.saveMyData) {
        emit('setState', State.WizardStart);
    } else {
        emit('onRefreshClicked');
    }
};

const submitErrorReportClicked = async () => {
    hideErrors.value = true;
    emitter.emit("show-automation-error");
};

// Settings
const archivePath = ref('');

const updateArchivePath = async () => {
    const path = await window.electron.getAccountDataPath(props.model.account.id, '');
    archivePath.value = path ? path : '';
};

const hideErrors = ref(false);

onMounted(async () => {
    await props.model.reloadAccount();
    await updateArchivePath();
});
</script>

<template>
    <div class="finished">
        <div v-if="model.account.xAccount?.saveMyData" class="container mt-3">
            <div class="finished-archive">
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
        <div v-if="model.account.xAccount?.deleteMyData" class="container mt-3">
            <div class="finished-delete">
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

        <div v-if="!hideErrors && model.progress.errorsOccured > 0" class="alert alert-danger mt-4" role="alert">
            <p>
                <strong>Uh oh, Cyd encountered {{ model.progress.errorsOccured.toLocaleString() }} errors.</strong>
                Please submit an error report so we can fix the problems you encountered.
            </p>
            <button class="btn btn-primary" @click="submitErrorReportClicked">
                Submit Error Report
            </button>
        </div>

        <div v-if="(
            failureStateIndexTweets_FailedToRetryAfterRateLimit &&
            ((model.account.xAccount?.saveMyData && model.account.xAccount?.archiveTweets) || (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets))) ||
            (
                failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                ((model.account.xAccount?.saveMyData && model.account.xAccount?.archiveLikes) || (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteLikes))
            )" class="alert alert-danger mt-4" role="alert">
            <p v-if="(
                failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                (model.account.xAccount?.archiveTweets || model.account.xAccount?.deleteTweets)) &&
                (
                    failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                    (model.account.xAccount?.archiveLikes || model.account.xAccount?.deleteLikes)
                )" class="fw-bold mb-0">
                Cyd wasn't able to scroll through all of your tweets and likes this time.
            </p>
            <p v-if="(
                failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                (
                    (model.account.xAccount?.saveMyData && model.account.xAccount?.archiveTweets) ||
                    (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets)
                )
            ) && !(
                failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                ((model.account.xAccount?.saveMyData && model.account.xAccount?.archiveLikes) || (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteLikes))
            )" class="fw-bold mb-0">
                Cyd wasn't able to scroll through all of your tweets this time.
            </p>
            <p v-if="!(
                failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                ((model.account.xAccount?.saveMyData && model.account.xAccount?.archiveTweets) || (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets))
            ) && (
                    failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                    ((model.account.xAccount?.saveMyData && model.account.xAccount?.archiveLikes) || (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteLikes))
                )" class="fw-bold mb-0">
                Cyd wasn't able to scroll through all of your likes this time.
            </p>
            <p v-if="model.account.xAccount?.deleteMyData && (model.account.xAccount?.deleteTweets || model.account.xAccount?.deleteLikes)"
                class="alert-details mb-0">
                Run Cyd again with the same settings to delete more.
            </p>
            <p v-else class="alert-details mb-0">
                Run Cyd again with the same settings to try again from the beginning.
            </p>
        </div>

        <div class="buttons">
            <template v-if="(
                failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                (
                    (model.account.xAccount?.saveMyData && model.account.xAccount?.archiveTweets) ||
                    (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets))
            ) || (
                    failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                    ((model.account.xAccount?.saveMyData && model.account.xAccount?.archiveLikes) || (model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteLikes))
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

.finished-archive ul,
.finished-delete ul {
    list-style-type: none;
    padding-left: 0;
    margin-left: 1.5em;
}

.finished-archive li,
.finished-delete li {
    margin-bottom: 0.2rem;
}
</style>