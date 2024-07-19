<script setup lang="ts">
import type { XProgress } from '../../../shared_types';

defineProps<{
    progress: XProgress | null;
}>();
</script>

<template>
    <template v-if="progress">
        <div class="progress-wrapper">
            <!-- Index -->
            <template v-if="progress.currentJob == 'index'">
                <p>
                    Indexed
                    <b>{{ progress.tweetsIndexed.toLocaleString() }} tweets</b> and
                    <b>{{ progress.retweetsIndexed.toLocaleString() }} retweets</b>.
                    <template v-if="progress.isIndexFinished">
                        Indexing complete!
                    </template>
                </p>
            </template>
        </div>
    </template>
</template>

<style scoped>
.progress-wrapper {
    text-align: center;
    font-size: 0.8em;
    padding-bottom: 10px;
}

.progress-wrapper p {
    margin: 0;
}
</style>