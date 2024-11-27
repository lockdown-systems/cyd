<script setup lang="ts">
import {
    ref,
    onMounted
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';

// Props
const props = defineProps<{
    model: AccountXViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

// Buttons
const nextClicked = async () => {
    if (buildDatabaseStrategy.value == 'importArchive') {
        emit('setState', State.WizardImportStart);
    } else {
        emit('setState', State.WizardBuildOptions);
    }
};

// Settings
const buildDatabaseStrategy = ref('importArchive');
const importArchiveRecommended = ref(true);

onMounted(() => {
    // If the user has a lot of data, recommend importing the archive
    if (props.model.account && props.model.account.xAccount) {
        importArchiveRecommended.value = (
            props.model.account.xAccount.tweetsCount >= 1800 ||
            props.model.account.xAccount.likesCount >= 1800
        );
    }
    if (importArchiveRecommended.value) {
        buildDatabaseStrategy.value = 'importArchive';
    } else {
        buildDatabaseStrategy.value = 'buildFromScratch';
    }
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Build a database of your X data
            </h2>
            <p class="text-muted">
                How would you like to proceed?
            </p>

            <XLastImportOrBuildComponent :account-i-d="model.account.id" :button-text="'Go to Delete Options'"
                :button-state="State.WizardDeleteOptions" @set-state="emit('setState', $event)" />

            <form @submit.prevent>
                <div class="mb-3">
                    <div class="form-check">
                        <input id="importArchive" v-model="buildDatabaseStrategy" type="radio" value="importArchive"
                            class="form-check-input">
                        <label class="form-check-label" for="importArchive">
                            Import X archive
                            <span v-if="importArchiveRecommended" class="ms-2 text-muted">(recommended)</span>
                        </label>
                    </div>
                    <div class="indent">
                        <small v-if="importArchiveRecommended" class="form-text text-muted">
                            You have a lot of data so importing your X archive is definitely the way to go.
                        </small>
                        <small v-else>
                            Importing your X archive will work great, but you'll need to wait at least a day for X to
                            send it to you if you don't already have it.
                        </small>
                    </div>
                </div>

                <div class="mb-3">
                    <div class="form-check">
                        <input id="buildFromScratch" v-model="buildDatabaseStrategy" type="radio"
                            value="buildFromScratch" class="form-check-input">
                        <label class="form-check-label" for="buildFromScratch">
                            Build database from scratch
                            <span v-if="!importArchiveRecommended" class="ms-2 text-muted">(recommended)</span>
                        </label>
                    </div>
                    <div class="indent">
                        <small v-if="importArchiveRecommended" class="form-text text-muted">
                            X restricts how much of your data you can access. You likely won't get all of your data if
                            you have Cyd build it from scratch. Read more.
                        </small>
                        <small v-else>
                            You don't have a lot of data in your X account, so having Cyd scroll through your profile
                            will be faster. Read more.
                        </small>
                    </div>
                </div>
            </form>

            <div class="buttons">
                <button type="submit" class="btn btn-primary text-nowrap m-1" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="buildDatabaseStrategy == 'importArchive'">
                        Continue to Import Archive
                    </template>
                    <template v-else>
                        Continue to Build Options
                    </template>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped></style>