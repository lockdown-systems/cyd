<script setup lang="ts">
import { ref, getCurrentInstance } from 'vue';
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    model: XViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    startJobsJustSave: [],
    updateUserPremium: [],
}>()

// Buttons
const signInClicked = async () => {
    emitter?.emit("show-sign-in");
};

const manageAccountClicked = async () => {
    emitter?.emit("show-manage-account");
};

const iveUpgradedClicked = async () => {
    emit('updateUserPremium');
};

const showNoPremiumError = ref(false);

emitter?.on(`x-premium-check-failed-${props.model.account.id}`, async () => {
    showNoPremiumError.value = true;
    setTimeout(() => {
        showNoPremiumError.value = false;
    }, 5000);
});

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
                Delete tweets older than a set number of days
            </li>
            <li
                v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsRetweetsThresholdEnabled">
                Delete tweets unless they have at least a certain number of retweets
            </li>
            <li
                v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsLikesThresholdEnabled">
                Delete tweets unless they have at least a certain number of likes
            </li>
            <li
                v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteRetweets && model.account.xAccount?.deleteRetweetsDaysOldEnabled">
                Delete retweets older than a set number of days
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.unfollowEveryone">
                Unfollow everyone
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteLikes">
                Delete likes
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteBookmarks">
                Delete bookmarks
            </li>
            <li v-if="model.account.xAccount?.deleteMyData && model.account.xAccount?.deleteDMs">
                Delete direct messages
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

                <div v-else-if="userAuthenticated && !userPremium">
                    <button type="submit" class="btn btn-primary text-nowrap m-1" @click="manageAccountClicked">
                        <i class="fa-solid fa-user-ninja" />
                        Manage My Account
                    </button>

                    <button type="submit" class="btn btn-success text-nowrap m-1" @click="iveUpgradedClicked">
                        <i class="fa-solid fa-star" />
                        I've Upgraded
                    </button>

                    <div v-if="showNoPremiumError" class="alert alert-warning mt-4" role="alert">
                        You haven't upgraded to Premium yet. Please try again.
                    </div>
                </div>

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