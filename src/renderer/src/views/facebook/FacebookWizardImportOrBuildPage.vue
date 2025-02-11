<script setup lang="ts">
import {
    ref,
    onMounted
} from 'vue';
import {
    FacebookViewModel,
    State
} from '../../view_models/FacebookViewModel';

// Props
defineProps<{
    model: FacebookViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

// Buttons
const nextClicked = async () => {
    emit('setState', State.WizardBuildOptions);
};

// Settings
const buildDatabaseStrategy = ref('buildFromScratch');

onMounted(() => {
});
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <div class="mb-4">
            <h2>
                Build a database of your Facebook data
            </h2>
            <p class="text-muted">
                How would you like to proceed?
            </p>

            <form @submit.prevent>
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
                            Cyd will scroll through all of your posts and save a local copy of your data.
                        </small>
                    </div>
                </div>
            </form>

            <div class="buttons">
                <button type="submit" class="btn btn-primary text-nowrap m-1" @click="nextClicked">
                    <i class="fa-solid fa-forward" />
                    <template v-if="buildDatabaseStrategy == 'buildFromScratch'">
                        Continue to Build Options
                    </template>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped></style>