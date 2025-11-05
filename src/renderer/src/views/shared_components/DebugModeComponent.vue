<script setup lang="ts">
import { ref, onMounted } from "vue";
// Props
const props = defineProps<{
  emit: Function;
  debugState: string;
}>();

// Debug
const shouldOpenDevtools = ref(false);
const debugAutopauseEndOfStep = ref(false);

const debugAutopauseEndOfStepChanged = async () => {
  props.emit("setDebugAutopauseEndOfStep", debugAutopauseEndOfStep.value);
};

const enableDebugMode = async () => {
  props.emit("setState", props.debugState);
};

onMounted(async () => {
  shouldOpenDevtools.value = await window.electron.shouldOpenDevtools();
});

</script>

<template>
  <!-- Debug mode -->
  <div v-if="shouldOpenDevtools" class="p-3 small">
    <hr />

    <div class="mb-3">
      <button class="btn btn-sm btn-danger" @click="enableDebugMode">
        Debug Mode
      </button>
    </div>

    <div class="form-check">
      <input
        id="debugAutopauseEndOfStep"
        v-model="debugAutopauseEndOfStep"
        type="checkbox"
        class="form-check-input"
        @change="debugAutopauseEndOfStepChanged"
      />
      <label class="form-check-label" for="debugAutopauseEndOfStep">
        Automatically pause before finishing each step
      </label>
    </div>
  </div>
</template>
