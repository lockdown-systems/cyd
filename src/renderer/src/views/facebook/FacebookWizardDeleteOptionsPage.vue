<script setup lang="ts">
import {
    ref,
    onMounted,
    computed,
} from 'vue';
import {
    FacebookViewModel,
    State
} from '../../view_models/FacebookViewModel'
import { facebookHasSomeData } from '../../util_facebook';
import { setJobsType } from '../../util';

// Props
const props = defineProps<{
    model: FacebookViewModel;
    userAuthenticated: boolean;
    userPremium: boolean;
}>();

// Emits
const emit = defineEmits<{
    updateAccount: []
    setState: [value: State]
}>()

// Buttons
const backClicked = async () => {
    await saveSettings();
    emit('setState', State.WizardImporting);
};

const nextClicked = async () => {
    await saveSettings();
    setJobsType(props.model.account.id, 'delete');
    emit('setState', State.WizardReview);
};

// Show more
const deletePostsShowMore = ref(false);
const deletePostsShowMoreButtonText = computed(() => deletePostsShowMore.value ? 'Hide more options' : 'Show more options');
const deletePostsShowMoreClicked = () => {
    deletePostsShowMore.value = !deletePostsShowMore.value;
};

const deleteRepostsShowMore = ref(false);
const deleteRepostsShowMoreButtonText = computed(() => deleteRepostsShowMore.value ? 'Hide more options' : 'Show more options');
const deleteRepostsShowMoreClicked = () => {
    deleteRepostsShowMore.value = !deleteRepostsShowMore.value;
};

// Settings
// TODO: Add more deletion options here based on available data
const deletePosts = ref(false);
const deletePostsDaysOldEnabled = ref(false);
const deletePostsDaysOld = ref(0);
const deleteReposts = ref(false);
const deleteRepostsDaysOldEnabled = ref(false);
const deleteRepostsDaysOld = ref(0);


const loadSettings = async () => {
    console.log('FacebookWizardDeleteOptionsPage', 'loadSettings');
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.facebookAccount) {
        deletePosts.value = account.facebookAccount.deletePosts;
        deletePostsDaysOld.value = account.facebookAccount.deletePostsDaysOld;
        deletePostsDaysOldEnabled.value = account.facebookAccount.deletePostsDaysOldEnabled;
        deleteReposts.value = account.facebookAccount.deleteReposts;
        deleteRepostsDaysOld.value = account.facebookAccount.deleteRepostsDaysOld;
        deleteRepostsDaysOldEnabled.value = account.facebookAccount.deleteRepostsDaysOldEnabled;
    }

    // Should delete posts show more options?
    if (
        deletePosts.value &&
        (
            deletePostsDaysOldEnabled.value ||
            deleteRepostsDaysOldEnabled.value
        )
    ) {
        deletePostsShowMore.value = true;
    }

    // Should delete reposts show more options?
    if (deleteReposts.value && deleteRepostsDaysOldEnabled.value) {
        deleteRepostsShowMore.value = true;
    }
};

const saveSettings = async () => {
    console.log('FacebookWizardDeleteOptionsPage', 'saveSettings');
    if (!props.model.account) {
        console.error('FacebookWizardDeleteOptionsPage', 'saveSettings', 'account is null');
        return;
    }
    const account = await window.electron.database.getAccount(props.model.account?.id);
    if (account && account.facebookAccount) {
        // account.facebookAccount.saveMyData = false;
        // account.facebookAccount.deleteMyData = true;
        // account.facebookAccount.archiveMyData = false;

        account.facebookAccount.deletePosts = deletePosts.value;
        account.facebookAccount.deletePostsDaysOldEnabled = deletePostsDaysOldEnabled.value;
        account.facebookAccount.deletePostsDaysOld = deletePostsDaysOld.value;
        account.facebookAccount.deleteReposts = deleteReposts.value;
        account.facebookAccount.deleteRepostsDaysOldEnabled = deleteRepostsDaysOldEnabled.value;
        account.facebookAccount.deleteRepostsDaysOld = deleteRepostsDaysOld.value;

        await window.electron.database.saveAccount(JSON.stringify(account));
        emit('updateAccount');
    }
};

const hasSomeData = ref(false);

onMounted(async () => {
    await loadSettings();
    hasSomeData.value = await facebookHasSomeData(props.model.account.id);

    if (!hasSomeData.value) {
        deletePosts.value = false;
        deleteReposts.value = false;
    }
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Delete from Facebook
            </h2>
            <p class="text-muted">
                Delete your data from Facebook, except for what you want to keep.
            </p>
        </div>

        <FacebookLastImportOrBuildComponent :account-i-d="model.account.id" :show-button="true" :show-no-data-warning="true"
            :button-text="'Build Your Local Database'" :button-state="State.WizardDatabase"
            @set-state="emit('setState', $event)" />

        <form @submit.prevent>
            <!-- deletePosts -->
            <div class="mb-3">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="form-check">
                        <input id="deletePosts" v-model="deletePosts" type="checkbox" class="form-check-input"
                            :disabled="!hasSomeData">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteTweets">
                            Delete my posts
                        </label>
                        <span class="ms-2 text-muted">(recommended)</span>
                        <button class="btn btn-sm btn-link" @click="deletePostsShowMoreClicked">
                            {{ deletePostsShowMoreButtonText }}
                        </button>
                    </div>
                </div>
                <div v-if="deletePostsShowMore" class="indent">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center flex-nowrap">
                            <div class="form-check">
                                <input id="deletePostsDaysOldEnabled" v-model="deletePostsDaysOldEnabled"
                                    type="checkbox" class="form-check-input" :disabled="!deletePosts || !hasSomeData">
                                <label class="form-check-label mr-1 text-nowrap" for="deletePostsDaysOldEnabled">
                                    older than
                                </label>
                            </div>
                            <div class="d-flex align-items-center">
                                <label class="form-check-label mr-1 sr-only" for="deletePostsDaysOld">
                                    days
                                </label>
                                <div class="input-group flex-nowrap">
                                    <input id="deletePostsDaysOld" v-model="deletePostsDaysOld" type="text"
                                        class="form-control form-short small"
                                        :disabled="!deletePosts || !deletePostsDaysOldEnabled || !hasSomeData">
                                    <div class="input-group-append">
                                        <span class="input-group-text small">days</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span v-if="!userAuthenticated || !userPremium"
                            class="premium badge badge-primary">Premium</span>
                    </div>
                </div>
            </div>

            <!--     -->
            <div class="mb-3">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="form-check">
                        <input id="deleteReposts" v-model="deleteReposts" type="checkbox" class="form-check-input"
                            :disabled="!hasSomeData">
                        <label class="form-check-label mr-1 text-nowrap" for="deleteReposts">
                            Delete my reposts
                        </label>
                        <span class="ms-2 text-muted">(recommended)</span>
                        <button class="btn btn-sm btn-link" @click="deleteRepostsShowMoreClicked">
                            {{ deleteRepostsShowMoreButtonText }}
                        </button>
                    </div>
                </div>
                <div v-if="deleteRepostsShowMore" class="indent">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center flex-nowrap">
                            <div class="form-check">
                                <input id="deleteRepostsDaysOldEnabled" v-model="deleteRepostsDaysOldEnabled"
                                    type="checkbox" class="form-check-input"
                                    :disabled="!deleteReposts || !hasSomeData">
                                <label class="form-check-label mr-1 text-nowrap" for="deleteRepostsDaysOldEnabled">
                                    older than
                                </label>
                            </div>
                            <div class="d-flex align-items-center">
                                <label class="form-check-label mr-1 sr-only" for="deleteRepostsDaysOld">
                                    days
                                </label>
                                <div class="input-group flex-nowrap">
                                    <input id="deleteRepostsDaysOld" v-model="deleteRepostsDaysOld" type="text"
                                        class="form-control form-short small"
                                        :disabled="!deleteReposts || !deleteRepostsDaysOldEnabled">
                                    <div class="input-group-append">
                                        <span class="input-group-text small">days</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span v-if="!userAuthenticated || !userPremium"
                            class="premium badge badge-primary">Premium</span>
                    </div>
                </div>
            </div>

            <div class="buttons">
                <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                    <i class="fa-solid fa-backward" />
                    Back to Import or Build Database
                </button>

                <button type="submit" class="btn btn-primary text-nowrap m-1"
                    :disabled="(hasSomeData && !(deletePosts || deleteReposts))"
                    @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    Continue to Review
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.form-short {
    width: 55px;
}

.small {
    font-size: 0.9rem;
}
</style>