<script setup lang="ts">
import { ref, getCurrentInstance, onMounted } from 'vue';
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

const checkReason = ref<string>('');
const tasks = ref<string[]>([]);

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
    if (checkReason.value == 'deleteData') {
        emit('setState', State.WizardReview);
    } else if (checkReason.value == 'migrateTweetsToBluesky') {
        emit('setState', State.WizardMigrate);
    }
};

onMounted(async () => {
    // Load the reason for this check
    const premiumCheckReason = localStorage.getItem(`premiumCheckReason-${props.model.account.id}`);
    console.log(`premiumCheckReason-${props.model.account.id}`, premiumCheckReason);
    if (premiumCheckReason) {
        checkReason.value = premiumCheckReason;
        localStorage.removeItem(`premiumCheckReason-${props.model.account.id}`);
    }

    // See if there are any premium tasks in localStorage
    const premiumTasks = localStorage.getItem(`premiumTasks-${props.model.account.id}`);
    console.log(`premiumTasks-${props.model.account.id}`, premiumTasks);
    if (premiumTasks) {
        tasks.value = JSON.parse(premiumTasks);
        localStorage.removeItem(`premiumTasks-${props.model.account.id}`);
    }
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto wizard-review">
        <h2 v-if="userAuthenticated && userPremium">
            Thanks for upgrading to Premium
            <i class="fa-solid fa-heart" />
        </h2>
        <h2 v-else>
            The following features require a Premium account:
        </h2>
        <ul v-if="!userAuthenticated || !userPremium" class="features-list">
            <!-- X tasks -->
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsDaysOldEnabled"
                class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-calendar-alt me-2" />
                        Delete tweets older than a set number of days
                    </small>
                </div>
            </li>
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsRetweetsThresholdEnabled"
                class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-retweet me-2" />
                        Delete tweets unless they have at least a certain number of retweets
                    </small>
                </div>
            </li>
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.deleteTweets && model.account.xAccount?.deleteTweetsLikesThresholdEnabled"
                class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-heart me-2" />
                        Delete tweets unless they have at least a certain number of likes
                    </small>
                </div>
            </li>
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.deleteRetweets && model.account.xAccount?.deleteRetweetsDaysOldEnabled"
                class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-calendar-alt me-2" />
                        Delete retweets older than a set number of days
                    </small>
                </div>
            </li>
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.unfollowEveryone" class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-user-minus me-2" />
                        Unfollow everyone
                    </small>
                </div>
            </li>
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.deleteLikes" class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-heart-broken me-2" />
                        Delete likes
                    </small>
                </div>
            </li>
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.deleteBookmarks" class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-bookmark me-2" />
                        Delete bookmarks
                    </small>
                </div>
            </li>
            <li v-if="checkReason == 'deleteData' && model.account.xAccount?.deleteDMs" class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-envelope me-2" />
                        Delete direct messages
                    </small>
                </div>
            </li>
            <!-- other tasks -->
            <li v-for="task in tasks" :key="task" class="mb-1">
                <div class="card">
                    <small class="card-body">
                        <i class="fa-solid fa-tasks me-2" />
                        {{ task }}
                    </small>
                </div>
            </li>
        </ul>

        <template v-if="!userAuthenticated">
            <p>To get started, sign in to your Cyd account.</p>
        </template>
        <template v-else-if="userAuthenticated && !userPremium">
            <p>Manage your account to upgrade to Premium.</p>
        </template>
        <template v-else>
            <p v-if="checkReason == 'deleteData'">
                Ready to delete your data from X? <em>Let's go!</em>
            </p>
            <p v-if="checkReason == 'migrateTweetsToBluesky'">
                Ready to migrate your tweets into Bluesky? <em>Let's go!</em>
            </p>
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
                <button v-if="checkReason == 'deleteData'" type="submit"
                    class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Review
                </button>
                <button v-if="checkReason == 'migrateTweetsToBluesky'" type="submit"
                    class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Migrate to Bluesky
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
ul.features-list {
    list-style-type: none;
    padding-left: 0;
}
</style>