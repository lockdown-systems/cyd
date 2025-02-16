<script setup lang="ts">
import {
    ref,
    onMounted,
    getCurrentInstance,
} from 'vue';
import {
    State,
    XViewModel,
} from '../../view_models/XViewModel'
import {
    XDatabaseStats, emptyXDatabaseStats
} from '../../../../shared_types';
import SidebarArchive from '../shared_components/SidebarArchive.vue';

// Get the global emitter
const vueInstance = getCurrentInstance();
const emitter = vueInstance?.appContext.config.globalProperties.emitter;

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    setDebugAutopauseEndOfStep: [value: boolean]
}>()

// Buttons
const reloadUserStats = async () => {
    await window.electron.X.setConfig(props.model.account?.id, 'reloadUserStats', 'true');
    emit('setState', State.WizardPrestart);
};

// Util
function formatStatsNumber(num: number): string {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Keep databaseStats in sync
const databaseStats = ref<XDatabaseStats>(emptyXDatabaseStats());
emitter?.on(`x-update-database-stats-${props.model.account.id}`, async () => {
    databaseStats.value = await window.electron.X.getDatabaseStats(props.model.account.id);
});

// Debug
const shouldOpenDevtools = ref(false);
const debugAutopauseEndOfStep = ref(false);

const debugAutopauseEndOfStepChanged = async () => {
    emit('setDebugAutopauseEndOfStep', debugAutopauseEndOfStep.value);
};

const enableDebugMode = async () => {
    emit('setState', State.Debug);
};

onMounted(async () => {
    shouldOpenDevtools.value = await window.electron.shouldOpenDevtools();
});
</script>

<template>
    <div class="wizard-sidebar">
        <p v-if="model.account && model.account.xAccount" class="p-3 small text-muted">
            <template v-if="model.account?.xAccount?.tweetsCount == -1 || model.account?.xAccount?.likesCount == -1">
                Cyd could not detect how many likes and tweets you have.
                <a href="#" @click="reloadUserStats">
                    Try again.
                </a>
            </template>
            <template v-else>
                According to X, your account has <strong class="text-nowrap">{{
                    model.account?.xAccount?.tweetsCount.toLocaleString() }}
                    tweets</strong> and <strong class="text-nowrap">{{
                        model.account?.xAccount?.likesCount.toLocaleString()
                    }} likes</strong>. These numbers aren't always accurate.
                <a href="#" @click="reloadUserStats">
                    Refresh the stats.
                </a>
            </template>
        </p>

        <SidebarArchive :account-i-d="model.account.id" :account-type="model.account.type" />

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
                <div v-if="databaseStats.bookmarksSaved > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Bookmarks Saved
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.bookmarksSaved) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.bookmarksDeleted > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Bookmarks Deleted
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.bookmarksDeleted) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.conversationsDeleted > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Conversations Deleted
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.conversationsDeleted) }}</h1>
                        </div>
                    </div>
                </div>
                <div v-if="databaseStats.accountsUnfollowed > 0" class="col-12 col-md-6">
                    <div class="card text-center">
                        <div class="card-header">
                            Accounts Unfollowed
                        </div>
                        <div class="card-body">
                            <h1>{{ formatStatsNumber(databaseStats.accountsUnfollowed) }}</h1>
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