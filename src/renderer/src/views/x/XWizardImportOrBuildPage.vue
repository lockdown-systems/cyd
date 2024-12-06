<script setup lang="ts">
import {
    ref,
    onMounted
} from 'vue';
import {
    AccountXViewModel,
    State
} from '../../view_models/AccountXViewModel'
import { openURL } from '../../util';

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

enum RecommendedState {
    ImportArchive,
    BuildFromScratch,
    Unknown
}
const recommendedState = ref(RecommendedState.Unknown);

onMounted(() => {
    // If the user has a lot of data, recommend importing the archive
    if (props.model.account && props.model.account.xAccount) {
        if (
            props.model.account.xAccount.tweetsCount == -1 ||
            props.model.account.xAccount.likesCount == -1
        ) {
            recommendedState.value = RecommendedState.Unknown;
        } else if (
            props.model.account.xAccount.tweetsCount >= 2000 ||
            props.model.account.xAccount.likesCount >= 2000
        ) {
            recommendedState.value = RecommendedState.ImportArchive;
        } else {
            recommendedState.value = RecommendedState.BuildFromScratch;
        }
    }
    if (recommendedState.value == RecommendedState.ImportArchive || recommendedState.value == RecommendedState.Unknown) {
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
                :button-text-no-data="'Skip to Delete Options'" :button-state="State.WizardDeleteOptions"
                @set-state="emit('setState', $event)" />

            <form @submit.prevent>
                <!-- import archive recommended -->
                <template v-if="recommendedState == RecommendedState.ImportArchive">
                    <div class="mb-3">
                        <div class="form-check">
                            <input id="importArchive" v-model="buildDatabaseStrategy" type="radio" value="importArchive"
                                class="form-check-input">
                            <label class="form-check-label" for="importArchive">
                                Import X archive
                                <span class="ms-2 text-muted">(recommended)</span>
                            </label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                You have a lot of data so importing your X archive is definitely the way to go.
                            </small>
                        </div>
                    </div>

                    <div class="mb-3 mt-3">
                        <div class="form-check">
                            <input id="buildFromScratch" v-model="buildDatabaseStrategy" type="radio"
                                value="buildFromScratch" class="form-check-input">
                            <label class="form-check-label" for="buildFromScratch">
                                Build database from scratch
                            </label>
                        </div>
                        <div class="indent">
                            <small class="form-text text-muted">
                                X restricts how much of your data you can access. You likely won't get all of your data
                                if you have Cyd build it from scratch. Building from scratch is a great way to backup
                                your direct messages, though.
                                <a href="#" @click="openURL('https://cyd.social/docs-building-database-limits/')">
                                    Read more
                                </a>.
                            </small>
                        </div>
                    </div>
                </template>

                <!-- build from scratch recommended -->
                <template v-else-if="recommendedState == RecommendedState.BuildFromScratch">
                    <div class="mb-3">
                        <div class="form-check">
                            <input id="buildFromScratch" v-model="buildDatabaseStrategy" type="radio"
                                value="buildFromScratch" class="form-check-input">
                            <label class="form-check-label" for="buildFromScratch">
                                Build database from scratch
                                <span class="ms-2 text-muted">(recommended)</span>
                            </label>
                        </div>
                        <div class="indent">
                            <small>
                                You don't have a lot of data in your X account, so having Cyd scroll through your
                                profile will be faster. Building from scratch is also a great way to backup your direct
                                messages.
                                <a href="#" @click="openURL('https://cyd.social/docs-building-database-limits/')">
                                    Read more
                                </a>.
                            </small>
                        </div>
                    </div>

                    <div class="mb-3 mt-3">
                        <div class="form-check">
                            <input id="importArchive" v-model="buildDatabaseStrategy" type="radio" value="importArchive"
                                class="form-check-input">
                            <label class="form-check-label" for="importArchive">
                                Import X archive
                            </label>
                        </div>
                        <div class="indent">
                            <small>
                                Importing your X archive will work great, but you'll need to wait at least a day for X
                                to send it to you if you don't already have it.
                            </small>
                        </div>
                    </div>
                </template>

                <!-- unknown which is better -->
                <template v-else>
                    <div class="mb-3 mt-3">
                        <div class="form-check">
                            <input id="importArchive" v-model="buildDatabaseStrategy" type="radio" value="importArchive"
                                class="form-check-input">
                            <label class="form-check-label" for="importArchive">
                                Import X archive
                                <span class="ms-2 text-muted">(recommended)</span>
                            </label>
                        </div>
                        <div class="indent">
                            <small>
                                Importing your X archive will work great, but you'll need to wait at least a day for X
                                to send it to you if you don't already have it.
                            </small>
                        </div>
                    </div>

                    <div class="mb-3">
                        <div class="form-check">
                            <input id="buildFromScratch" v-model="buildDatabaseStrategy" type="radio"
                                value="buildFromScratch" class="form-check-input">
                            <label class="form-check-label" for="buildFromScratch">
                                Build database from scratch
                            </label>
                        </div>
                        <div class="indent">
                            <small>
                                Having Cyd scroll through your profile is faster than importing your X archive, but it
                                only works if you have less than about 2,000 tweets or likes. Building from scratch is a
                                great way to backup your direct messages, though.
                                <a href="#" @click="openURL('https://cyd.social/docs-building-database-limits/')">
                                    Read more
                                </a>.
                            </small>
                        </div>
                    </div>
                </template>
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