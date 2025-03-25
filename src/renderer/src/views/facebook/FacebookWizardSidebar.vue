<script setup lang="ts">
import {
    ref,
    onMounted,
} from 'vue';
import {
    State,
    FacebookViewModel,
} from '../../view_models/FacebookViewModel'
import SidebarArchive from '../shared_components/SidebarArchive.vue';

// Props
defineProps<{
    model: FacebookViewModel;
}>();

// Emits
const emit = defineEmits<{
    setState: [value: State]
    setDebugAutopauseEndOfStep: [value: boolean]
}>()


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
        <ul class="wizard-nav">
            <li>
                <button class="btn btn-light" @click="emit('setState', State.WizardDatabase)">
                    <i class="fa-solid fa-database" />
                    Local Database
                </button>
            </li>
            <li>
                <button class="btn btn-light" @click="emit('setState', State.WizardDeleteOptions)">
                    <i class="fa-solid fa-fire" />
                    Delete from FB
                </button>
            </li>
        </ul>

        <SidebarArchive :account-i-d="model.account.id" :account-type="model.account.type" />

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