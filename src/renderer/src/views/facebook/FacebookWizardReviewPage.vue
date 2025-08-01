<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
    FacebookViewModel,
    State
} from '../../view_models/FacebookViewModel'
import { getJobsType } from '../../util';
import { facebookHasSomeData } from '../../util_facebook';
import LoadingComponent from '../shared_components/LoadingComponent.vue';
import AlertStayAwake from '../shared_components/AlertStayAwake.vue';

// Props
const props = defineProps<{
    model: FacebookViewModel;
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
    if (jobsType.value == 'save') {
        emit('setState', State.WizardBuildOptions);
    } else if (jobsType.value == 'delete') {
        emit('setState', State.WizardDeleteOptions);
    } else {
        // Display error
        console.error('Unknown review type:', jobsType.value);
        await window.electron.showError("Oops, this is awkward. You clicked back, but I'm not sure where to go.");
    }
};

// Settings
// const deleteReviewStats = ref<XDeleteReviewStats>(emptyXDeleteReviewStats());
const hasSomeData = ref(false);

onMounted(async () => {
    loading.value = true;

    jobsType.value = getJobsType(props.model.account.id) || '';
    hasSomeData.value = await facebookHasSomeData(props.model.account.id);

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
                        <li v-if="model.account?.facebookAccount?.savePosts">
                            Save posts
                            <ul>
                                <li v-if="model.account?.facebookAccount?.savePostsHTML">
                                    Save HTML versions of posts
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>

                <div v-if="jobsType == 'delete'">
                    <h3>
                        <i class="fa-solid fa-fire me-1" />
                        Delete my data
                    </h3>
                    <ul>
                        <li v-if="hasSomeData && model.account?.facebookAccount?.deleteTweets">
                            <b>{{ deleteReviewStats.tweetsToDelete.toLocaleString() }} tweets</b>
                        </li>
                    </ul>
                </div>

                <div class="buttons">
                    <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                        <i class="fa-solid fa-backward" />
                        <template v-if="jobsType == 'save'">
                            Back to Build Options
                        </template>
                        <template v-else-if="jobsType == 'delete'">
                            Back to Delete Options
                        </template>
                    </button>

                    <button type="submit" class="btn btn-primary text-nowrap m-1"
                        :disabled="!(model.account?.facebookAccount?.savePosts)" @click="nextClicked">
                        <i class="fa-solid fa-forward" />
                        <template v-if="jobsType == 'save'">
                            Build Database
                        </template>
                        <template v-else-if="jobsType == 'delete' || jobsType == 'migrateBlueskyDelete'">
                            Start Deleting
                        </template>
                    </button>
                </div>
            </form>

            <AlertStayAwake />
        </template>
    </div>
</template>

<style scoped></style>
