<script setup lang="ts">
import { getCurrentInstance } from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    model: AccountXViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    startJobsJustSave: []
}>()

// Buttons
const signInClicked = async () => {
    localStorage.setItem('manageAccountMode', 'premium');
    localStorage.setItem('manageAccountRedirectAccountID', props.model.account?.id.toString());
    emitter?.emit("show-sign-in");
};

const manageAccountClicked = async () => {
    localStorage.setItem('manageAccountMode', 'premium');
    localStorage.setItem('manageAccountRedirectAccountID', props.model.account?.id.toString());
    emitter?.emit("show-manage-account");
};

const backClicked = async () => {
    emit('setState', State.WizardReview);
};
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
        <h2 v-if="userAuthenticated && userPremium">
            Thanks for upgrading to Premium
            <i class="fa-solid fa-heart" />
        </h2>
        <h2 v-else>
            You need to upgrade to Premium to do the following:
        </h2>
        <ul v-if="!userAuthenticated || !userPremium">
            <li
                v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsDaysOldEnabled">
                Deleting tweets older than a set number of days
            </li>
            <li
                v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsRetweetsThresholdEnabled">
                Deleting tweets unless they have at least a certain number of retweets
            </li>
            <li
                v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsLikesThresholdEnabled">
                Deleting tweets unless they have at least a certain number of likes
            </li>
            <li
                v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteRetweets && model.account.xAccount?.deleteRetweetsDaysOldEnabled">
                Deleting retweets older than a set number of days
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.unfollowEveryone">
                Unfollowing everyone
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteLikes">
                Deleting likes
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteBookmarks">
                Deleting bookmarks
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteDMs">
                Deleting direct messages
            </li>
        </ul>

        <template v-if="!userAuthenticated">
            <p>First, sign in to your Cyd account.</p>
        </template>
        <template v-else-if="userAuthenticated && !userPremium">
            <p>Manage your account to upgrade to Premium.</p>
        </template>
        <template v-else>
            <p>Ready to delete your data from X? <em>Let's go!</em></p>
        </template>

        <form @submit.prevent>
            <div class="buttons">
                <button v-if="!userAuthenticated" type="submit" class="btn btn-lg btn-primary text-nowrap m-1"
                    @click="signInClicked">
                    <i class="fa-solid fa-user-ninja" />
                    Sign In
                </button>

                <button v-else-if="userAuthenticated && !userPremium" type="submit"
                    class="btn btn-lg btn-primary text-nowrap m-1" @click="manageAccountClicked">
                    <i class="fa-solid fa-user-ninja" />
                    Manage My Account
                </button>

                <button v-else type="submit" class="btn btn-lg btn-primary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-user-ninja" />
                    Review Your Choices
                </button>
            </div>

            <div v-if="!userPremium" class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Review
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped></style>