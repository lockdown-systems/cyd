<script setup lang="ts">
import {
    ref,
    onMounted
} from 'vue';
import {
    XViewModel,
    State
} from '../../view_models/XViewModel'
import { xHasSomeData } from '../../util_x';

// Props
const props = defineProps<{
    model: XViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

const hasSomeData = ref(false);

onMounted(async () => {
    hasSomeData.value = await xHasSomeData(props.model.account.id);
});
</script>

<template>
    <div class="wizard-content">
        <div class="wizard-scroll-content">
            <div class="dashboard row align-items-stretch g-3">
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card h-100" @click="emit('setState', State.WizardDatabase)">
                        <span v-if="!hasSomeData" class="start-here-badge badge bg-primary">Start Here</span>
                        <div class="card-body align-items-center">
                            <img src="/assets/icon-database.png" alt="Local Database">
                            <h2>Local Database</h2>
                            <p class="small text-muted">
                                Make or update your local backup of X data. Cyd references this data when you delete
                                from X
                                or migrate to Bluesky.
                            </p>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card h-100" @click="emit('setState', State.WizardDeleteOptions)">
                        <div class="card-body align-items-center">
                            <img src="/assets/icon-delete.png" alt="Delete from X">
                            <h2>Delete from X</h2>
                            <p class="small text-muted">
                                Delete your tweets, retweets, likes, bookmarks, or DMs from your X account, or unfollow
                                everyone.
                            </p>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card h-100" @click="emit('setState', State.WizardMigrateToBluesky)">
                        <div class="card-body align-items-center">
                            <img src="/assets/icon-bluesky.png" alt="Migrate to Bluesky">
                            <h2>Migrate to Bluesky</h2>
                            <p class="small text-muted">
                                Migrate your tweets from your X account to a Bluesky account.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.wizard-scroll-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 100%;
    height: 100%;
}

.dashboard {
    width: 100%;
}

.dashboard {
    padding: 1rem 2rem;
}

.dashboard .card {
    padding: 0.5rem;
    text-align: center;
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
    position: relative;
}

.start-here-badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 2;
    transform: rotate(18deg);
    font-size: 0.85rem;
    padding: 0.5em 1.1em;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
    font-weight: 600;
    letter-spacing: 0.03em;
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
