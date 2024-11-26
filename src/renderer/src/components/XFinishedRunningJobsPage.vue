<script setup lang="ts">
import {
    ref,
    onMounted,
    watch,
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../view_models/AccountXViewModel'
import type { XProgress } from '../../../shared_types';
import { openURL } from '../util';

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
    startStateLoop: []
}>()

// Keep progress updated
const progress = ref<XProgress | null>(null);
watch(
    () => props.model.progress,
    (newProgress) => { if (newProgress) progress.value = newProgress; },
    { deep: true, }
);

// Buttons
const runAgainClicked = async () => {
    emit('setState', State.WizardReview);
    emit('startStateLoop');
};

const resetClicked = async () => {
    await props.model.reset()
    emit('startStateLoop');
};

// Settings
const archivePath = ref('');

const updateArchivePath = async () => {
    const path = await window.electron.getAccountDataPath(props.model.account.id, '');
    archivePath.value = path ? path : '';
};

onMounted(async () => {
    await updateArchivePath();
});
</script>

<template>
    <div class="finished">
        <div v-if="model.account.xAccount?.saveMyData" class="container mt-3">
            <div class="finished-archive">
                <h2>You just saved:</h2>
                <ul>
                    <li v-if="(progress?.newTweetsArchived ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ progress?.newTweetsArchived.toLocaleString() }}</strong> tweets
                        saved as HTML archives
                    </li>
                    <li v-if="model.account.xAccount?.archiveTweets || (progress?.tweetsIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ progress?.tweetsIndexed.toLocaleString() }}</strong> tweets
                    </li>
                    <li v-if="model.account.xAccount?.archiveTweets || (progress?.retweetsIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ progress?.retweetsIndexed.toLocaleString() }}</strong> retweets
                    </li>
                    <li v-if="model.account.xAccount?.archiveLikes || (progress?.likesIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ progress?.likesIndexed.toLocaleString() }}</strong> likes
                    </li>
                    <li v-if="(progress?.unknownIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ progress?.unknownIndexed.toLocaleString() }}</strong> other tweets
                        <span class="ms-3 small text-muted">
                            (<a href="#" @click="openURL('https://cyd.social/docs-other-tweets');">what's
                                this?</a>)
                        </span>
                    </li>
                    <li
                        v-if="model.account.xAccount?.archiveDMs || (progress?.conversationsIndexed ?? 0) > 0 || (progress?.messagesIndexed ?? 0) > 0">
                        <i class="fa-solid fa-floppy-disk archive-bullet" />
                        <strong>{{ progress?.conversationsIndexed.toLocaleString() }}</strong>
                        conversations,
                        including <strong>{{ progress?.messagesIndexed.toLocaleString() }}</strong>
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
                <template
                    v-if="!model.account.xAccount?.saveMyData &&
                        (model.account.xAccount?.deleteTweets || model.account.xAccount?.deleteRetweets || model.account.xAccount?.deleteLikes)">
                    <h2>You just saved:</h2>
                    <ul>
                        <li v-if="(progress?.newTweetsArchived ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.newTweetsArchived.toLocaleString() }}</strong> tweets
                            saved
                            as HTML archives
                        </li>
                        <li
                            v-if="(model.account.xAccount?.deleteTweets || model.account.xAccount?.deleteRetweets) || (progress?.tweetsIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.tweetsIndexed.toLocaleString() }}</strong> tweets
                        </li>
                        <li
                            v-if="(model.account.xAccount?.deleteTweets || model.account.xAccount?.deleteRetweets) || (progress?.retweetsIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.retweetsIndexed.toLocaleString() }}</strong> retweets
                        </li>
                        <li v-if="model.account.xAccount?.deleteLikes || (progress?.likesIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.likesIndexed.toLocaleString() }}</strong> likes
                        </li>
                        <li v-if="(progress?.unknownIndexed ?? 0) > 0">
                            <i class="fa-solid fa-floppy-disk archive-bullet" />
                            <strong>{{ progress?.unknownIndexed.toLocaleString() }}</strong> other
                            tweets (<a href="#">learn more</a>)
                        </li>
                    </ul>
                </template>

                <h2>You just deleted:</h2>
                <ul>
                    <li v-if="model.account.xAccount?.deleteTweets || (progress?.tweetsDeleted ?? 0) > 0">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ progress?.tweetsDeleted.toLocaleString() }}</strong> tweets
                    </li>
                    <li v-if="model.account.xAccount?.deleteRetweets || (progress?.retweetsDeleted ?? 0) > 0">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ progress?.retweetsDeleted.toLocaleString() }}</strong> retweets
                    </li>
                    <li v-if="model.account.xAccount?.deleteLikes || (progress?.likesDeleted ?? 0) > 0">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ progress?.likesDeleted.toLocaleString() }}</strong> likes
                    </li>
                    <li v-if="model.account.xAccount?.deleteDMs">
                        <i class="fa-solid fa-fire delete-bullet" />
                        <strong>{{ progress?.conversationsDeleted.toLocaleString() }}</strong> direct
                        message conversations
                    </li>
                </ul>
            </div>
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

                <button class="btn btn-secondary" @click="resetClicked">
                    Back to Start
                </button>
            </template>
            <template v-else>
                <button class="btn btn-primary" @click="resetClicked">
                    Back to Start
                </button>
            </template>
        </div>
    </div>
</template>

<style scoped></style>