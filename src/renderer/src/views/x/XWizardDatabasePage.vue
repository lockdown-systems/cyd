<script setup lang="ts">
import {
    ref,
    onMounted
} from 'vue';
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'
import { openURL } from '../../util';
import { xHasSomeData } from '../../util_x';

import XLastImportOrBuildComponent from './XLastImportOrBuildComponent.vue';

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

// Buttons
const nextClicked = async () => {
    if (buildDatabaseStrategy.value == 'importArchive') {
        emit('setState', State.WizardImportStart);
    } else if (buildDatabaseStrategy.value == 'buildFromScratch') {
        emit('setState', State.WizardBuildOptions);
    } else {
        emit('setState', State.WizardArchiveOptions);
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

const hasSomeData = ref(false);

onMounted(async () => {
    hasSomeData.value = await xHasSomeData(props.model.account.id);

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
                Build your local database
            </h2>
            <p class="text-muted">
                There are different ways to get data from your X account. How would you like to proceed?
            </p>

            <XLastImportOrBuildComponent :account-i-d="model.account.id" :show-button="false"
                :show-no-data-warning="false" @set-state="emit('setState', $event)" />

            <!-- import archive recommended -->
            <template v-if="recommendedState == RecommendedState.ImportArchive">
                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'importArchive' }"
                    @click="buildDatabaseStrategy = 'importArchive'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Import X archive
                                <span class="ms-2 text-muted">(recommended)</span>
                            </div>
                            <small class="info text-muted">
                                You have a lot of data so importing your X archive is definitely the way to go.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'buildFromScratch' }"
                    @click="buildDatabaseStrategy = 'buildFromScratch'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Build database from scratch
                            </div>
                            <small class="info text-muted">
                                X restricts how much of your data you can access. You likely won't get all of your data
                                if you have Cyd build it from scratch. Building from scratch is a great way to backup
                                your direct messages, though.
                                <a href="#" @click="openURL('https://docs.cyd.social/docs/x/local-database/build')">
                                    Read more</a>.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'archiveData' }"
                    @click="buildDatabaseStrategy = 'archiveData'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Save HTML tweets, direct messages, and/or bookmarks
                            </div>
                            <small class="info text-muted">
                                Cyd can save an HTML version of each tweet, and detailed backup of your direct messages,
                                and your bookmarks.
                            </small>
                        </div>
                    </div>
                </div>
            </template>

            <!-- build from scratch recommended -->
            <template v-else-if="recommendedState == RecommendedState.BuildFromScratch">
                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'buildFromScratch' }"
                    @click="buildDatabaseStrategy = 'buildFromScratch'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Build database from scratch
                                <span class="ms-2 text-muted">(recommended)</span>
                            </div>
                            <small class="info text-muted">
                                You don't have a lot of data in your X account, so having Cyd scroll through your
                                profile will be faster. Building from scratch is also a great way to backup your direct
                                messages.
                                <a href="#" @click="openURL('https://docs.cyd.social/docs/x/local-database/build')">
                                    Read more</a>.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'importArchive' }"
                    @click="buildDatabaseStrategy = 'importArchive'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Import X archive
                            </div>
                            <small class="info text-muted">
                                Importing your X archive will work great, but you'll need to wait at least a day for X
                                to send it to you if you don't already have it.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'archiveData' }"
                    @click="buildDatabaseStrategy = 'archiveData'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Save HTML tweets, direct messages, and/or bookmarks
                            </div>
                            <small class="info text-muted">
                                Cyd can save an HTML version of each tweet, and detailed backup of your direct messages,
                                and your bookmarks.
                            </small>
                        </div>
                    </div>
                </div>
            </template>

            <!-- unknown which is better -->
            <template v-else>
                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'importArchive' }"
                    @click="buildDatabaseStrategy = 'importArchive'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Import X archive
                                <span class="ms-2 text-muted">(recommended)</span>
                            </div>
                            <small class="info text-muted">
                                Importing your X archive will work great, but you'll need to wait at least a day for X
                                to send it to you if you don't already have it.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'buildFromScratch' }"
                    @click="buildDatabaseStrategy = 'buildFromScratch'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Build database from scratch
                            </div>
                            <small class="info text-muted">
                                Having Cyd scroll through your profile is faster than importing your X archive, but it
                                only works if you have less than about 2,000 tweets or likes. Building from scratch is a
                                great way to backup your direct messages, though.
                                <a href="#" @click="openURL('https://docs.cyd.social/docs/x/local-database/build')">
                                    Read more</a>.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="option-card card mb-3" :class="{ selected: buildDatabaseStrategy === 'archiveData' }"
                    @click="buildDatabaseStrategy = 'archiveData'">
                    <div class="card-body d-flex align-items-center">
                        <div>
                            <div>
                                Save HTML tweets, direct messages, and/or bookmarks
                            </div>
                            <small class="info text-muted">
                                Cyd can save an HTML version of each tweet, and detailed backup of your direct messages,
                                and your bookmarks.
                            </small>
                        </div>
                    </div>
                </div>
            </template>

            <div class="buttons">
                <button type="submit" class="btn btn-primary text-nowrap m-1" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="buildDatabaseStrategy == 'importArchive'">
                        Continue to Import Archive
                    </template>
                    <template v-else-if="buildDatabaseStrategy == 'buildFromScratch'">
                        Continue to Build Options
                    </template>
                    <template v-else>
                        Continue to Archive Options
                    </template>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped></style>