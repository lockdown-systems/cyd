<script setup lang="ts">
import {
    ref,
    onMounted,
    watch,
} from 'vue';
import {
    State,
    AccountXViewModel,
} from '../../view_models/AccountXViewModel'
import type {
    XArchiveInfo,
    XDatabaseStats
} from '../../../../shared_types';
import {
    emptyXArchiveInfo,
    emptyXDatabaseStats
} from '../../../../shared_types';

// Props
const props = defineProps<{
    model: AccountXViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    startStateLoop: []
    setDebugAutopauseEndOfStep: [value: boolean]
}>()


// Buttons
const openArchiveFolder = async () => {
    await window.electron.X.openFolder(props.model.account?.id, "");
};

const openArchive = async () => {
    await window.electron.X.openFolder(props.model.account?.id, "index.html");
};

// Util
function formatStatsNumber(num: number): string {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Keep archiveInfo in sync
const archiveInfo = ref<XArchiveInfo>(emptyXArchiveInfo());
watch(
    () => props.model.archiveInfo,
    (newArchiveInfo) => {
        if (newArchiveInfo) {
            archiveInfo.value = newArchiveInfo as XArchiveInfo;
        }
    },
    { deep: true, }
);

// Keep databaseStats in sync
const databaseStats = ref<XDatabaseStats>(emptyXDatabaseStats());
watch(
    () => props.model.databaseStats,
    (newDatabaseStats) => {
        if (newDatabaseStats) {
            databaseStats.value = newDatabaseStats as XDatabaseStats;
        }
    },
    { deep: true, }
);

// Debug
const shouldOpenDevtools = ref(false);
const debugAutopauseEndOfStep = ref(false);

const debugAutopauseEndOfStepChanged = async () => {
    emit('setDebugAutopauseEndOfStep', debugAutopauseEndOfStep.value);
};

const enableDebugMode = async () => {
    emit('setState', State.Debug);
    emit('startStateLoop');
};

onMounted(async () => {
    shouldOpenDevtools.value = await window.electron.shouldOpenDevtools();
});
</script>

<template>
    <div class="wizard-sidebar">
        <p v-if="model.account && model.account.xAccount" class="p-3 small text-muted">
            According to X, your account has <strong class="text-nowrap">{{
                model.account?.xAccount?.tweetsCount.toLocaleString() }}
                tweets</strong> and <strong class="text-nowrap">{{ model.account?.xAccount?.likesCount.toLocaleString()
                }} likes</strong>.
        </p>
        <p v-if="archiveInfo.indexHTMLExists" class="d-flex gap-2 justify-content-center">
            <button class="btn btn-outline-success btn-sm" @click="openArchive">
                Browse Archive
            </button>

            <button class="btn btn-outline-secondary btn-sm" @click="openArchiveFolder">
                Open Folder
            </button>
        </p>

        <div class="stats container mt-4">
            <div class="row g-2">
                <div v-if="databaseStats.tweetsSaved > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Tweets Saved
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.tweetsSaved) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.tweetsDeleted > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Tweets Deleted
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.tweetsDeleted) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.retweetsSaved > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Retweets Saved
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.retweetsSaved) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.retweetsDeleted > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Retweets Deleted
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.retweetsDeleted) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.likesSaved > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Likes Saved
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.likesSaved) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.likesDeleted > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Likes Deleted
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.likesDeleted) }}</h1>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Debug mode -->
        <div v-if="shouldOpenDevtools" class="p-3 small">
            <hr>

            <div class="mb-3">
                <button class="btn btn-sm btn-danger" @click="enableDebugMode">
                    Debug Mode
                </button>
            </div>

            <div class="form-check">
                <input id="debugAutopauseEndOfStep" v-model="debugAutopauseEndOfStep" type="checkbox"
                    class="form-check-input" @change="debugAutopauseEndOfStepChanged">
                <label class="form-check-label" for="debugAutopauseEndOfStep">
                    Automatically pause before finishing each step
                </label>
            </div>
        </div>
    </div>
</template>

<style scoped></style>