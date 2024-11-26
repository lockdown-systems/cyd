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
import { openPreventSleepURL } from '../util';

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
    updateAccount: []
    setState: [value: State]
    startStateLoop: []
}>()

// Buttons
const nextClicked = async () => {
    await saveSettings();
    if (saveMyData.value) {
        emit('setState', State.WizardSaveOptions);
    } else if (deleteMyData.value) {
        emit('setState', State.WizardDeleteOptions);
    }
    emit('startStateLoop');
};

// Settings
const saveMyData = ref(true);
const deleteMyData = ref(true);

const loadSettings = async () => {
    if (props.model && props.model.account.xAccount !== null) {
        saveMyData.value = props.model.account.xAccount.saveMyData;
        deleteMyData.value = props.model.account.xAccount.deleteMyData;
    }
};

const saveSettings = async () => {
    if (props.model?.account.xAccount == null) {
        console.error('saveSettings', 'Account is null');
        return;
    }
    const updatedAccount: Account = {
        ...props.model.account,
        xAccount: {
            ...props.model.account.xAccount,
            saveMyData: saveMyData.value,
            deleteMyData: deleteMyData.value
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
    <div class="wizard container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                It's time to claw back your data from X
            </h2>
            <p class="text-muted">
                Before you can delete your data from X, Cyd needs a local database of it.
            </p>
        </div>

        <form @submit.prevent>
            <div class="mb-3">
                <div class="form-check">
                    <input id="saveMyData" v-model="saveMyData" type="checkbox" class="form-check-input">
                    <label class="form-check-label" for="saveMyData">
                        Save my data
                    </label>
                </div>
            </div>
            <div class="mb-3">
                <div class="form-check">
                    <input id="deleteMyData" v-model="deleteMyData" type="checkbox" class="form-check-input">
                    <label class="form-check-label" for="deleteMyData">
                        Delete my data
                    </label>
                    <span class="premium badge badge-primary">Premium</span>
                </div>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-primary text-nowrap m-1" :disabled="!(saveMyData || deleteMyData)"
                    @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="saveMyData">
                        Continue to Save Options
                    </template>
                    <template v-else-if="deleteMyData">
                        Continue to Delete Options
                    </template>
                    <template v-else>
                        Choose Save or Delete to Continue
                    </template>
                </button>
            </div>

            <div v-if="(
                failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                (model?.account.xAccount?.archiveTweets ||
                    model?.account.xAccount?.deleteTweets)) ||
                (failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                    (model?.account.xAccount?.archiveLikes ||
                        model?.account.xAccount?.deleteLikes))" class="alert alert-danger mt-4" role="alert">
                <p v-if="(
                    failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                    (model?.account.xAccount?.archiveTweets ||
                        model?.account.xAccount?.deleteTweets)) &&
                    (failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                        (model?.account.xAccount?.archiveLikes ||
                            model?.account.xAccount?.deleteLikes))" class="fw-bold mb-0">
                    During a recent run, Cyd wasn't able to scroll through all of your tweets and likes.
                </p>
                <p v-if="(
                    failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                    (model.account.xAccount?.archiveTweets ||
                        model.account.xAccount?.deleteTweets)) &&
                    !(failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                        (model.account.xAccount?.archiveLikes ||
                            model.account.xAccount?.deleteLikes))" class="fw-bold mb-0">
                    During a recent run, Cyd wasn't able to scroll through all of your tweets.
                </p>
                <p v-if="!(
                    failureStateIndexTweets_FailedToRetryAfterRateLimit &&
                    (model.account.xAccount?.archiveTweets ||
                        model.account.xAccount?.deleteTweets)) &&
                    (failureStateIndexLikes_FailedToRetryAfterRateLimit &&
                        (model.account.xAccount?.archiveLikes ||
                            model.account.xAccount?.deleteLikes))" class="fw-bold mb-0">
                    During a recent run, Cyd wasn't able to scroll through all of your likes.
                </p>
                <p class="alert-details mb-0">
                    Sorry, X can be annoying sometimes. Run Cyd again to try again.
                </p>
            </div>

            <div class="alert alert-info mt-4" role="alert">
                <p class="fw-bold mb-0">
                    X restricts how fast you can access your data using <span class="fst-italic">rate
                        limits</span>.
                </p>
                <p class="alert-details mb-0">
                    If you have much data in your account, you will probably hit rate limits while Cyd
                    works. Cyd will pause and wait for the rate limit to reset before continuing, but
                    it might take a while to finish.
                </p>
            </div>
            <div class="alert alert-info" role="alert">
                <p class="fw-bold mb-0">
                    Your computer needs to be awake to use Cyd.
                </p>
                <p class="alert-details mb-0">
                    Don't close the lid, keep it plugged in, and disable sleep while plugged in.
                    <a href="#" @click="openPreventSleepURL()">Learn more.</a>
                </p>
            </div>
        </form>
    </div>
</template>

<style scoped></style>