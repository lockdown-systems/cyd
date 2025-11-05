<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  State,
  FacebookViewModel,
} from "../../../view_models/FacebookViewModel";
import SidebarArchive from "../../shared_components/SidebarArchive.vue";
import DebugModeComponent from "../../shared_components/DebugModeComponent.vue";

// Props
defineProps<{
  model: FacebookViewModel;
}>();

// Emits
const emit = defineEmits<{
  setState: [value: State];
  setDebugAutopauseEndOfStep: [value: boolean];
}>();
</script>

<template>
  <div class="wizard-sidebar">
    <ul class="wizard-nav">
      <li>
        <button
          class="btn btn-light"
          @click="emit('setState', State.WizardBuildOptions)"
        >
          <i class="fa-solid fa-database" />
          Local Database
        </button>
      </li>
      <li>
        <button
          class="btn btn-light"
          @click="emit('setState', State.WizardDeleteOptions)"
        >
          <i class="fa-solid fa-fire" />
          Delete from FB
        </button>
      </li>
    </ul>

    <SidebarArchive
      :account-i-d="model.account.id"
      :account-type="model.account.type"
    />

    <DebugModeComponent :emit="emit" :debug-state="State.Debug" />
  </div>
</template>

<style scoped></style>
