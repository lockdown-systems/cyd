<script setup lang="ts">
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'

// Props
defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="dashboard row">
            <div class="col-12 col-md-6 col-lg-6">
                <div class="card m-2" @click="emit('setState', State.WizardDatabase)">
                    <div class="card-body align-items-center">
                        <img src="/assets/icon-database.png" alt="Local Database">
                        <h1>Local Database</h1>
                        <p class="small text-muted">
                            Make or update your local backup of X data. Cyd references this data when you delete from X
                            or migrate to Bluesky.
                        </p>
                    </div>
                </div>
            </div>
            <div class="col-12 col-md-6 col-lg-6">
                <div class="card m-2" @click="emit('setState', State.WizardDeleteOptions)">
                    <div class="card-body align-items-center">
                        <img src="/assets/icon-delete.png" alt="Delete from X">
                        <h1>Delete from X</h1>
                        <p class="small text-muted">
                            Delete your tweets, retweets, likes, bookmarks, or DMs from your X account, or unfollow
                            everyone.
                        </p>
                    </div>
                </div>
            </div>
            <div class="col-12 col-md-6 col-lg-6">
                <div class="card m-2" @click="emit('setState', State.WizardMigrateToBluesky)">
                    <div class="card-body align-items-center">
                        <img src="/assets/icon-bluesky.png" alt="Migrate to Bluesky">
                        <h1>Migrate to Bluesky</h1>
                        <p class="small text-muted">
                            Migrate your tweets from your X account to a Bluesky account.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.dashboard .card {
    text-align: center;
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}

.dashboard .card:hover,
.dashboard .card:focus {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10), 0 1.5px 6px rgba(0, 0, 0, 0.08);
    border-color: #0d6efd;
    transform: translateY(-4px) scale(1.02);
    background-color: #f8fafd;
}

.dashboard .card img {
    width: 96px;
    height: 96px;
    margin-bottom: 1rem;
}

.dashboard .card p {
    margin-bottom: 0;
    text-align: left;
}
</style>
