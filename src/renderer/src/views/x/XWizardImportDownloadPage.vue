<script setup lang="ts">
import {
    State
} from '../../view_models/XViewModel'

// Emits
const emit = defineEmits<{
    setState: [value: State]
}>()

// Buttons

const backClicked = async () => {
    emit('setState', State.WizardStart);
};
</script>

<template>
    <div class="wizard-content container mb-4 mt-3 mx-auto">
        <h2>
            Import your X archive
        </h2>
        <p class="text-muted">
            Run Cyd again after you've downloaded your X archive.
        </p>

        <p>
            Eventually X should send you an email with a link to download your archive. Hopefully this
            will be within 24 hours, but it might take a few days (sorry).
        </p>
        <p>
            When you get it, download it, unzip it, and then run Cyd again to import it.
        </p>

        <div class="buttons">
            <button type="submit" class="btn btn-outline-secondary text-nowrap m-1" @click="backClicked">
                <i class="fa-solid fa-backward" />
                Back to Start
            </button>
        </div>
    </div>
</template>

<style scoped></style>